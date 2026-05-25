import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types attendus depuis l'API HubSpot Dashboard ────────────────────────────

interface HubspotDeal {
  id: string;
  name: string;
  amount?: number | null;
  stage?: string | null;
  stageId?: string | null;
  probability?: number | null;
  createdate?: string | null;
  closedate?: string | null;
  stageEnteredAt?: string | null;
  description?: string | null;
  metadata?: {
    proposal_nom?: string | null;
    proposal_mission?: string | null;
  } | null;
}

interface ApiResponse {
  count: number;
  fetched_at: string;
  deals: HubspotDeal[];
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const hubspotToken = Deno.env.get("HUBSPOT_DASHBOARD_TOKEN");
    if (!hubspotToken) {
      return new Response(
        JSON.stringify({ error: "HUBSPOT_DASHBOARD_TOKEN non configuré (supabase secrets set HUBSPOT_DASHBOARD_TOKEN=...)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: settings, error: settingsError } = await supabase
      .from("notion_settings")
      .select("proposals_endpoint_url")
      .single();

    if (settingsError || !settings?.proposals_endpoint_url) {
      return new Response(
        JSON.stringify({ error: `proposals_endpoint_url manquant dans notion_settings: ${JSON.stringify(settingsError)}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const endpointUrl = settings.proposals_endpoint_url as string;

    // ── 1. Récupérer la liste des deals ouverts ───────────────────────────────
    const res = await fetch(endpointUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${hubspotToken}`,
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(
        JSON.stringify({ error: `Erreur endpoint HubSpot Dashboard (${res.status}): ${err}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await res.json() as ApiResponse;
    const deals = payload.deals ?? [];

    // ── 2. Upsert chaque deal en 'active' ─────────────────────────────────────
    const now = new Date().toISOString();
    const seenIds: string[] = [];
    let synced = 0;
    let skipped = 0;

    for (const deal of deals) {
      if (!deal.id) { skipped++; continue; }

      // Nom prospect : metadata.proposal_nom en priorité, sinon le nom du deal.
      const name = deal.metadata?.proposal_nom?.trim() || deal.name?.trim() || "";
      if (!name) { skipped++; continue; }

      const { error: upsertError } = await supabase
        .from("proposals")
        .upsert(
          {
            hubspot_id:   deal.id,
            name,
            mission_type: deal.metadata?.proposal_mission ?? null,
            stage:        deal.stage ?? null,
            amount:       deal.amount ?? null,
            probability:  deal.probability ?? null,
            close_date:   deal.closedate ? deal.closedate.slice(0, 10) : null,
            status:       "active",
            last_seen_at: now,
            updated_at:   now,
          },
          { onConflict: "hubspot_id" }
        );

      if (upsertError) { skipped++; continue; }
      seenIds.push(deal.id);
      synced++;
    }

    // ── 3. Marquer comme 'closed' les propales qu'on ne voit plus ─────────────
    // Tout deal qui était 'active' et n'est plus dans la réponse a été gagné/perdu.
    let closed = 0;
    if (seenIds.length > 0) {
      const { count } = await supabase
        .from("proposals")
        .update({ status: "closed", updated_at: now })
        .eq("status", "active")
        .not("hubspot_id", "in", `(${seenIds.map((id) => `"${id}"`).join(",")})`)
        .select("id", { count: "exact", head: true });
      closed = count ?? 0;
    } else {
      // Réponse vide : tous les actifs sont fermés
      const { count } = await supabase
        .from("proposals")
        .update({ status: "closed", updated_at: now })
        .eq("status", "active")
        .select("id", { count: "exact", head: true });
      closed = count ?? 0;
    }

    await supabase
      .from("notion_settings")
      .update({ proposals_last_synced_at: now })
      .eq("id", 1);

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        skipped,
        closed,
        total: deals.length,
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
