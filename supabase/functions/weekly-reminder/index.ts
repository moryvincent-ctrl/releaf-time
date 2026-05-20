import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// URL de l'app (overridable via env)
const APP_URL = Deno.env.get("APP_URL") ?? "https://releaf-time.vercel.app";
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
  const subject = "⏳ N'oublie pas de remplir ton Releaf Time !";
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1c1c1c;">
      <h1 style="font-size: 20px; color: #1B4332; margin: 0 0 16px;">Salut ${firstName} 👋</h1>
      <p style="font-size: 14px; line-height: 1.5;">
        Tu n'as pas encore validé ta feuille de temps de la semaine dernière sur Releaf Time.
      </p>
      <p style="font-size: 14px; line-height: 1.5;">
        Prends 2 minutes pour la remplir : clique sur le lien ci-dessous puis sur le bouton <strong>Sauvegarder</strong> en haut à droite.
      </p>
      <p style="margin: 24px 0;">
        <a href="${APP_URL}/consultant"
           style="background: #52B788; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
          Remplir ma feuille de temps
        </a>
      </p>
      <p style="font-size: 12px; color: #666; margin-top: 32px;">
        Tu reçois ce message car ta dernière sauvegarde Releaf Time date d'avant la semaine écoulée.
      </p>
    </div>
  `;

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY non configurée (supabase secrets set RESEND_API_KEY=...)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Récupère tous les profils
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, last_save_at");
    if (error) throw error;

    const threshold = previousMonday(new Date()); // lundi 00:00 UTC de la semaine écoulée
    const toRemind = (profiles ?? []).filter((p: any) => {
      if (!p.email) return false;
      if (!p.last_save_at) return true; // jamais sauvegardé
      return new Date(p.last_save_at) < threshold;
    });

    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const p of toRemind) {
      try {
        await sendEmail(resendKey, p.email, p.full_name ?? "");
        results.push({ email: p.email, ok: true });
      } catch (e: any) {
        results.push({ email: p.email, ok: false, error: e.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
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
      JSON.stringify({ error: err.message, stack: err.stack }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
