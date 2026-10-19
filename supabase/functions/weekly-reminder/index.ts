import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
import { authorize, serviceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// URL de l'app (overridable via env). Le repli pointe sur la prod actuelle (VPS
// Scaleway) — l'ancienne URL Vercel n'est plus servie et renvoyait les destinataires
// du rappel hebdo vers une page morte si APP_URL n'était pas défini.
const APP_URL = Deno.env.get("APP_URL") ?? "https://time.releafcarbon.com";
// Adresse expéditrice — utilise resend.dev par défaut si aucun domaine vérifié
const FROM_EMAIL = Deno.env.get("REMINDER_FROM") ?? "Releaf Time <onboarding@resend.dev>";

function previousMonday(now: Date): Date {
  // Renvoie le lundi 00:00 UTC de la semaine qui vient de se terminer.
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0 = dimanche, 1 = lundi, etc.
  // On veut le lundi de la semaine précédente (donc 7 jours avant le lundi actuel)
  const diffToMonday = (day === 0 ? 6 : day - 1);
  d.setUTCDate(d.getUTCDate() - diffToMonday - 7);
  return d;
}

async function sendEmail(apiKey: string, to: string, fullName: string) {
  const firstName = fullName.split(" ")[0] ?? "";
  const subject = "⏳ Pense à valider ta feuille de temps";

  // Palette Releaf
  const INK = "#002E22";
  const ACCENT = "#007F5F";
  const SAGE = "#689B87";
  const CREAM = "#FFFFEB";
  const MINT = "#F0D7FF";

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Releaf Time</title>
</head>
<body style="margin:0; padding:0; background:${MINT}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${MINT}; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 2px 8px rgba(0,46,34,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:${INK}; padding:24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:22px; font-weight:600; color:${CREAM}; letter-spacing:-0.2px;">
                    ⏳ Releaf <span style="font-weight:400;">Time</span>
                  </td>
                  <td align="right" style="font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:${MINT};">
                    Rappel hebdomadaire
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Corps -->
          <tr>
            <td style="padding:36px 32px 8px;">
              <h1 style="margin:0 0 16px; font-size:22px; font-weight:600; color:${INK}; line-height:1.3;">
                Salut ${firstName} 👋
              </h1>
              <p style="margin:0 0 12px; font-size:15px; line-height:1.55; color:${INK};">
                Petit rappel : tu n'as pas validé ta feuille de temps de la semaine dernière sur Releaf Time.
              </p>
              <p style="margin:0 0 24px; font-size:15px; line-height:1.55; color:${INK};">
                Prends 2 minutes pour la remplir, puis clique sur <strong style="color:${ACCENT};">Sauvegarder</strong> en haut à droite.
              </p>
              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px;">
                <tr>
                  <td style="background:${ACCENT}; border-radius:10px;">
                    <a href="${APP_URL}/consultant"
                       style="display:inline-block; padding:14px 28px; font-size:15px; font-weight:600; color:${CREAM}; text-decoration:none; letter-spacing:0.2px;">
                      Remplir ma feuille de temps →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px; font-size:13px; line-height:1.5; color:${SAGE};">
                Saisir tes temps régulièrement permet à toute l'équipe de suivre les budgets missions et de mieux planifier la suite.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px; border-top:1px solid ${MINT}; background:#FBF3FF;">
              <p style="margin:0; font-size:11px; line-height:1.5; color:${SAGE};">
                Tu reçois ce message car aucune sauvegarde n'a été enregistrée sur ton compte Releaf Time depuis la semaine du
                ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.
                <br>
                Releaf Carbon · <a href="${APP_URL}" style="color:${ACCENT}; text-decoration:none;">${APP_URL.replace(/^https?:\/\//, "")}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend ${res.status}: ${err}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY non configurée (supabase secrets set RESEND_API_KEY=...)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mode test : si ?test_to=foo@bar.com, tous les envois sont redirigés vers cette adresse
    const url = new URL(req.url);
    const testTo = url.searchParams.get("test_to");
    // Mode dry-run : ?dry=1 → ne fait pas l'envoi, retourne juste la liste
    const dry = url.searchParams.get("dry") === "1";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, last_save_at");
    if (error) throw error;

    const threshold = previousMonday(new Date());
    const toRemind = (profiles ?? []).filter((p: any) => {
      if (!p.email) return false;
      if (!p.last_save_at) return true;
      return new Date(p.last_save_at) < threshold;
    });

    if (dry) {
      return new Response(
        JSON.stringify({
          success: true,
          dry_run: true,
          threshold: threshold.toISOString(),
          would_remind: toRemind.map((p: any) => ({ email: p.email, full_name: p.full_name, last_save_at: p.last_save_at })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const p of toRemind) {
      const recipient = testTo ?? p.email;
      try {
        await sendEmail(resendKey, recipient, p.full_name ?? "");
        results.push({ email: recipient, ok: true });
      } catch (e: any) {
        results.push({ email: recipient, ok: false, error: e.message });
      }
      // Resend : 5 req/s max → on espace les envois (250ms entre chaque)
      await sleep(250);
    }

    return new Response(
      JSON.stringify({
        success: true,
        test_mode: testTo ? `Tous les envois redirigés vers ${testTo}` : null,
        threshold: threshold.toISOString(),
        total_profiles: profiles?.length ?? 0,
        reminded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
