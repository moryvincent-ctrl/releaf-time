import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
import { authorize, serviceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = "https://partner-api.payfit.com";
const INTROSPECT = "https://oauth.payfit.com/introspect";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pickArray(b) {
  return b?.collaborators ?? b?.absences ?? b?.data ?? b?.items ?? b?.results ?? [];
}
function pickToken(b) {
  return b?.nextPageToken ?? b?.meta?.nextPageToken ?? b?.nextPage ?? null;
}

function collabEmail(c) {
  const arr = Array.isArray(c?.emails) ? c.emails : [];
  const pro = arr.find((e) => e?.type === "professional") ?? arr[0];
  const mail = pro?.email ?? c?.email ?? "";
  return typeof mail === "string" ? mail.toLowerCase() : "";
}

function contractCollabId(c) {
  return c?.collaboratorId ?? c?.collaborator?.id ?? c?.employeeId ?? c?.employee?.id ?? null;
}
function contractEmail(c) {
  const mail = c?.email ?? c?.professionalEmail ?? "";
  return typeof mail === "string" && mail.includes("@") ? mail.toLowerCase() : "";
}

function absDate(v) {
  const d = v?.date ?? v;
  return typeof d === "string" ? d.slice(0, 10) : null;
}

async function get(path, key) {
  const res = await fetch(BASE + path, { headers: { Authorization: "Bearer " + key } });
  const txt = await res.text();
  let body = null;
  try { body = JSON.parse(txt); } catch { body = txt; }
  return { ok: res.ok, status: res.status, body };
}

async function getAll(basePath, key) {
  const all = [];
  let token = null;
  let n = 0;
  do {
    const sep = basePath.indexOf("?") >= 0 ? "&" : "?";
    const path = token ? basePath + sep + "nextPageToken=" + encodeURIComponent(token) : basePath;
    const r = await get(path, key);
    if (!r.ok) throw new Error("Payfit " + r.status + ": " + JSON.stringify(r.body));
    for (const x of pickArray(r.body)) all.push(x);
    token = pickToken(r.body);
    n++;
  } while (token && n < 50);
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await authorize(req, serviceClient());
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dryRun") === "1";

    const key = Deno.env.get("PAYFIT_API_KEY");
    if (!key) return json({ error: "PAYFIT_API_KEY manquante" });

    let companyId = Deno.env.get("PAYFIT_COMPANY_ID") ?? "";
    if (!companyId) {
      const res = await fetch(INTROSPECT, {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ token: key }),
      });
      const info = await res.json().catch(() => ({}));
      companyId = info?.company_id ?? info?.companyId ?? "";
      if (!companyId) return json({ error: "company_id introuvable", info });
    }

    const collaborators = await getAll("/companies/" + companyId + "/collaborators?maxResults=50", key);

    const now = new Date();
    const begin = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 14, 0).toISOString().slice(0, 10);
    const absences = await getAll(
      "/companies/" + companyId + "/absences?status=approved&maxResults=50&beginDate=" + begin + "&endDate=" + end,
      key,
    );

    // email par collaborateur (id UUID -> email pro)
    const emailByCollab = new Map();
    for (const c of collaborators) if (c?.id) emailByCollab.set(c.id, collabEmail(c));

    // email par contrat : on récupère chaque contrat unique présent dans les absences
    const contractIds = [...new Set(absences.map((a) => String(a?.contractId ?? "")).filter(Boolean))];
    const emailByContract = new Map();
    let contractSample = null;
    for (const cid of contractIds) {
      const r = await get("/companies/" + companyId + "/contracts/" + cid, key);
      if (!contractSample) contractSample = { status: r.status, body: r.body };
      if (!r.ok) continue;
      let mail = contractEmail(r.body);
      if (!mail) {
        const collabId = contractCollabId(r.body);
        if (collabId) mail = emailByCollab.get(collabId) ?? "";
      }
      if (mail) emailByContract.set(cid, mail);
    }

    if (dryRun) {
      return json({
        dryRun: true,
        companyId,
        counts: { collaborators: collaborators.length, absences: absences.length, contracts: contractIds.length },
        contractSample,
        emailByContractSample: [...emailByContract.entries()].slice(0, 5),
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const { data: profiles } = await supabase.from("profiles").select("id, email");
    const profileByEmail = new Map((profiles ?? []).map((p) => [String(p.email).toLowerCase(), p.id]));

    const rows = absences.map((a) => {
      const cid = String(a?.contractId ?? "");
      const mail = emailByContract.get(cid) ?? "";
      return {
        payfit_id: a?.id ?? null,
        contract_id: cid,
        user_id: profileByEmail.get(mail) ?? null,
        absence_type: a?.type ?? null,
        begin_date: absDate(a?.startDate),
        end_date: absDate(a?.endDate),
        status: a?.status ?? null,
        raw: a,
      };
    });

    await supabase.from("payfit_absences").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (rows.length) {
      const { error } = await supabase.from("payfit_absences").insert(rows);
      if (error) return json({ error: "Insertion: " + error.message });
    }

    const mapped = rows.filter((r) => r.user_id).length;
    return json({
      success: true,
      absences: rows.length,
      mappedToProfiles: mapped,
      unmapped: rows.length - mapped,
    });
  } catch (e) {
    return json({ error: String(e?.message ?? e) });
  }
});
