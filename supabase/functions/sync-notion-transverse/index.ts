import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
import { authorize, serviceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types Notion ─────────────────────────────────────────────────────────────

interface NotionPerson {
  id: string;
  name: string;
  person?: { email: string };
}

interface NotionPage {
  id: string;
  properties: Record<string, any>;
}

// ─── Helpers pour lire les propriétés Notion ──────────────────────────────────

function getTitle(prop: any): string {
  return prop?.title?.[0]?.plain_text ?? "";
}

function getSelect(prop: any): string {
  // Supporte les types Notion `select` ET `status` (badge natif).
  return prop?.select?.name ?? prop?.status?.name ?? "";
}

function getDate(prop: any): string | null {
  if (!prop) return null;
  if (prop.date?.start) return prop.date.start;
  if (prop.formula?.date?.start) return prop.formula.date.start;
  return null;
}

function getPeople(prop: any): NotionPerson[] {
  return prop?.people ?? [];
}

// ─── Mapping Notion → notre schéma ───────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  "En cours":      "active",
  "Active":        "active",
  "Actif":         "active",
  "Terminé":       "completed",
  "Terminée":      "completed",
  "Completed":     "completed",
  "Pas commencé":  "on_hold",
  "En pause":      "on_hold",
  "On hold":       "on_hold",
};

function mapPage(page: NotionPage, propNames: PropertyNames) {
  const props = page.properties;
  // Statut inconnu/vide → on_hold (donc pas affiché dans la grille).
  const status = STATUS_MAP[getSelect(props[propNames.status])] ?? "on_hold";
  const priority = getSelect(props[propNames.priority]) || null;

  return {
    notion_id:  page.id,
    name:       getTitle(props[propNames.name]),
    status,
    priority,
    start_date: getDate(props[propNames.start_date]),
    end_date:   getDate(props[propNames.end_date]),
    assigned_people: getPeople(props[propNames.assignee]),
  };
}

// ─── Noms de propriétés configurables ────────────────────────────────────────

interface PropertyNames {
  name:       string;
  status:     string;
  priority:   string;
  start_date: string;
  end_date:   string;
  assignee:   string;
}

const DEFAULT_PROP_NAMES: PropertyNames = {
  name:       "Nom du projet",
  status:     "État",
  priority:   "Priorité",
  start_date: "Date de début",
  end_date:   "Date de fin",
  assignee:   "Personnes assignées",
};

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await authorize(req, serviceClient());
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Même secret Notion que pour la sync missions.
    const notionApiKey = Deno.env.get("NOTION_API_KEY");
    if (!notionApiKey) {
      return new Response(
        JSON.stringify({ error: "NOTION_API_KEY non configurée côté Edge Function (supabase secrets set NOTION_API_KEY=...)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: settings, error: settingsError } = await supabase
      .from("notion_settings")
      .select("transverse_database_id, transverse_prop_names")
      .single();

    if (settingsError || !settings?.transverse_database_id) {
      return new Response(
        JSON.stringify({ error: `transverse_database_id manquant dans notion_settings: ${JSON.stringify(settingsError)}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const databaseId = settings.transverse_database_id as string;
    const propNames: PropertyNames = { ...DEFAULT_PROP_NAMES, ...(settings.transverse_prop_names ?? {}) };

    // ── 1. Lire toutes les pages de la DB Notion ──────────────────────────────
    const pages: NotionPage[] = [];
    let cursor: string | undefined;

    do {
      const body: any = { page_size: 100 };
      if (cursor) body.start_cursor = cursor;

      const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${notionApiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        return new Response(
          JSON.stringify({ error: `Erreur Notion API (${res.status}): ${err}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();
      pages.push(...data.results);
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    // ── 2. Charger tous les profils (pour matcher les personnes par email) ───
    const { data: profiles } = await supabase.from("profiles").select("id, email");
    const profileByEmail = new Map((profiles ?? []).map((p: any) => [p.email.toLowerCase(), p.id]));

    // ── 3. Upsert chaque projet transverse + ses assignations ────────────────
    let synced = 0;
    let skipped = 0;
    const assignmentWarnings: string[] = [];

    for (const page of pages) {
      const mapped = mapPage(page, propNames);

      if (!mapped.name) { skipped++; continue; }

      const { data: project, error: upsertError } = await supabase
        .from("transverse_projects")
        .upsert(
          {
            notion_id:  mapped.notion_id,
            name:       mapped.name,
            status:     mapped.status,
            priority:   mapped.priority,
            start_date: mapped.start_date,
            end_date:   mapped.end_date,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "notion_id" }
        )
        .select("id")
        .single();

      if (upsertError || !project) { skipped++; continue; }

      // Resync des assignations : on supprime puis réinsère depuis Notion.
      await supabase
        .from("transverse_project_assignments")
        .delete()
        .eq("transverse_project_id", project.id);

      for (const person of mapped.assigned_people) {
        const email = person.person?.email?.toLowerCase();
        const userId = email ? profileByEmail.get(email) : null;
        if (userId) {
          await supabase.from("transverse_project_assignments").upsert(
            { transverse_project_id: project.id, user_id: userId },
            { onConflict: "transverse_project_id,user_id" }
          );
        } else {
          assignmentWarnings.push(`Projet "${mapped.name}" : personne "${person.name}" (${email ?? "email inconnu"}) non trouvée dans les profils`);
        }
      }

      synced++;
    }

    await supabase
      .from("notion_settings")
      .update({ transverse_last_synced_at: new Date().toISOString() })
      .eq("id", 1);

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        skipped,
        total: pages.length,
        warnings: assignmentWarnings,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
