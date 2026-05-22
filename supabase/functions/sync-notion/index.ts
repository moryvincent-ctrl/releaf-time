import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function getRichText(prop: any): string {
  return prop?.rich_text?.[0]?.plain_text ?? "";
}

function getSelect(prop: any): string {
  // Supporte les types Notion `select` ET `status` (badge natif).
  return prop?.select?.name ?? prop?.status?.name ?? "";
}

function getNumber(prop: any): number {
  return prop?.number ?? 0;
}

function getDate(prop: any): string | null {
  if (!prop) return null;
  // Date directe : { date: { start: "..." } }
  if (prop.date?.start) return prop.date.start;
  // Formule retournant une date : { formula: { date: { start: "..." } } }
  if (prop.formula?.date?.start) return prop.formula.date.start;
  // Rollup d'une date : { rollup: { date: { start: "..." } } }
  if (prop.rollup?.date?.start) return prop.rollup.date.start;
  // Rollup d'un array (depuis une relation) :
  //   { rollup: { type: "array", array: [{ date: { start } }] } }
  //   ou [{ formula: { date: { start } } }]
  if (prop.rollup?.array?.length) {
    for (const item of prop.rollup.array) {
      if (item?.date?.start) return item.date.start;
      if (item?.formula?.date?.start) return item.formula.date.start;
    }
  }
  return null;
}

function getPeople(prop: any): NotionPerson[] {
  return prop?.people ?? [];
}

// ─── Mapping Notion → notre schéma ───────────────────────────────────────────

const POLE_MAP: Record<string, string> = {
  "Releaf Carbon":       "Releaf Carbon",
  "Carbon":              "Releaf Carbon",
  "Releaf LCA":          "Releaf LCA",
  "LCA":                 "Releaf LCA",
  "Releaf Energy":       "Releaf Energy",
  "Energy":              "Releaf Energy",
  "Releaf Water":        "Releaf Water",
  "Water":               "Releaf Water",
  "Releaf Biodiversity": "Releaf Biodiversity",
  "Biodiversity":        "Releaf Biodiversity",
  "Releaf Campus":       "Releaf Campus",
  "Campus":              "Releaf Campus",
};

const STATUS_MAP: Record<string, string> = {
  "En cours":    "active",
  "Active":      "active",
  "Actif":       "active",
  "SAUR":        "active", // client groupé : plein de petites missions traitées comme actives
  "Terminée":    "completed",
  "Terminé":     "completed",
  "Completed":   "completed",
  "En pause":    "on_hold",
  "On hold":     "on_hold",
  "En attente":  "on_hold",
  "Attente":     "on_hold",
  "Pending":     "on_hold",
};

function mapPage(page: NotionPage, propNames: PropertyNames) {
  const props = page.properties;
  const pole = POLE_MAP[getSelect(props[propNames.pole])] ?? "Releaf Carbon";
  // Seul "En cours" (et alias) fait apparaître la mission. Tout statut inconnu/vide → on_hold.
  const status = STATUS_MAP[getSelect(props[propNames.status])] ?? "on_hold";
  const nature_mission = getSelect(props[propNames.nature_mission]) || getRichText(props[propNames.nature_mission]) || null;

  return {
    notion_id:      page.id,
    name:           getTitle(props[propNames.name]),
    client:         getRichText(props[propNames.client]) || getTitle(props[propNames.client]),
    pole,
    nature_mission,
    budget_days:    getNumber(props[propNames.budget_days]),
    start_date:     getDate(props[propNames.start_date]),
    end_date:       getDate(props[propNames.end_date]),
    status,
    manager_people:    getPeople(props[propNames.manager]),
    consultant_people: getPeople(props[propNames.consultants]),
  };
}

// ─── Noms de propriétés configurables ────────────────────────────────────────

interface PropertyNames {
  name:           string;
  client:         string;
  pole:           string;
  budget_days:    string;
  start_date:     string;
  end_date:       string;
  status:         string;
  manager:        string;
  consultants:    string;
  nature_mission: string;
}

const DEFAULT_PROP_NAMES: PropertyNames = {
  name:           "Nom du projet",
  client:         "Nom du client",
  pole:           "Pôle",
  budget_days:    "Budget jours",
  start_date:     "émission facture acompte",
  end_date:       "émission facture finale",
  status:         "État",
  manager:        "Manager",
  consultants:    "Consultants",
  nature_mission: "Nature_mission",
};

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // La clé API Notion est désormais stockée comme secret d'Edge Function
    // (Dashboard Supabase > Edge Functions > Manage secrets, ou via `supabase secrets set`).
    const notionApiKey = Deno.env.get("NOTION_API_KEY");
    if (!notionApiKey) {
      return new Response(
        JSON.stringify({ error: "NOTION_API_KEY non configurée côté Edge Function (supabase secrets set NOTION_API_KEY=...)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // database_id et prop_names restent dans la table (non sensibles)
    const { data: settings, error: settingsError } = await supabase
      .from("notion_settings")
      .select("database_id, prop_names")
      .single();

    if (settingsError || !settings?.database_id) {
      return new Response(
        JSON.stringify({ error: `database_id manquant dans notion_settings: ${JSON.stringify(settingsError)}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const databaseId = settings.database_id as string;
    const propNames: PropertyNames = { ...DEFAULT_PROP_NAMES, ...(settings.prop_names ?? {}) };

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
          JSON.stringify({ error: `Erreur Notion API (${res.status}): ${err}`, api_key_preview: notionApiKey.slice(0, 10) + "..." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();
      pages.push(...data.results);
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    // ── 2. Charger tous les profils (pour matcher par email) ──────────────────
    const { data: profiles } = await supabase.from("profiles").select("id, email");
    const profileByEmail = new Map((profiles ?? []).map((p: any) => [p.email.toLowerCase(), p.id]));

    // ── 3. Synchroniser chaque mission ────────────────────────────────────────
    let synced = 0;
    let skipped = 0;
    const assignmentErrors: string[] = [];

    for (const page of pages) {
      const mapped = mapPage(page, propNames);

      if (!mapped.name) { skipped++; continue; }

      // Upsert mission (basé sur notion_id)
      const { data: mission, error: missionError } = await supabase
        .from("missions")
        .upsert(
          {
            notion_id:      mapped.notion_id,
            name:           mapped.name,
            client:         mapped.client || "—",
            pole:           mapped.pole,
            nature_mission: mapped.nature_mission,
            budget_days:    mapped.budget_days,
            start_date:     mapped.start_date,
            end_date:       mapped.end_date,
            status:         mapped.status,
          },
          { onConflict: "notion_id" }
        )
        .select("id")
        .single();

      if (missionError || !mission) {
        skipped++;
        continue;
      }

      const missionId = mission.id;

      // Mémorise la répartition budget par consultant avant de supprimer
      // (sera restaurée après pour ne pas écraser une saisie manuelle)
      const { data: prevAssignments } = await supabase
        .from("assignments")
        .select("user_id, budget_days_allocated")
        .eq("mission_id", missionId);
      const prevBudgetByUser = new Map<string, number>(
        (prevAssignments ?? [])
          .filter((a: any) => a.budget_days_allocated != null)
          .map((a: any) => [a.user_id, Number(a.budget_days_allocated)]),
      );

      // Supprime les anciennes affectations pour recréer depuis Notion
      await supabase.from("assignments").delete().eq("mission_id", missionId);

      // Manager
      for (const person of mapped.manager_people) {
        const email = person.person?.email?.toLowerCase();
        const userId = email ? profileByEmail.get(email) : null;
        if (userId) {
          await supabase.from("assignments").upsert(
            {
              mission_id: missionId,
              user_id: userId,
              role_on_mission: "Manager",
              budget_days_allocated: prevBudgetByUser.get(userId) ?? null,
            },
            { onConflict: "mission_id,user_id" }
          );
        } else {
          assignmentErrors.push(`Manager "${person.name}" (${email ?? "email inconnu"}) non trouvé dans les profils`);
        }
      }

      // Consultants
      for (const person of mapped.consultant_people) {
        const email = person.person?.email?.toLowerCase();
        const userId = email ? profileByEmail.get(email) : null;
        if (userId) {
          await supabase.from("assignments").upsert(
            {
              mission_id: missionId,
              user_id: userId,
              role_on_mission: "Consultant",
              budget_days_allocated: prevBudgetByUser.get(userId) ?? null,
            },
            { onConflict: "mission_id,user_id" }
          );
        } else {
          assignmentErrors.push(`Consultant "${person.name}" (${email ?? "email inconnu"}) non trouvé dans les profils`);
        }
      }

      synced++;
    }

    // Met à jour le timestamp de dernière sync (lisible dans Settings)
    await supabase
      .from("notion_settings")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", 1);

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        skipped,
        total: pages.length,
        warnings: assignmentErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message, stack: err.stack }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
