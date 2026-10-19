import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";

// Contrôle d'accès commun aux Edge Functions.
//
// La clé anon est publique (elle est servie dans le bundle du front) et passe la
// vérification JWT par défaut de Supabase : elle ne prouve donc rien sur l'appelant.
// Deux appelants sont légitimes :
//   • les crons pg_cron, qui envoient l'en-tête x-cron-secret (secret CRON_SECRET,
//     aussi stocké dans le Vault sous le nom `cron_secret`) ;
//   • un admin connecté qui déclenche une sync depuis Paramètres
//     (supabase.functions.invoke envoie son JWT utilisateur).
export async function authorize(
  req: Request,
  supabase: SupabaseClient,
): Promise<{ ok: true; via: "cron" | "admin" } | { ok: false; status: number; error: string }> {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const sent = req.headers.get("x-cron-secret");
  if (cronSecret && sent && timingSafeEqual(sent, cronSecret)) {
    return { ok: true, via: "cron" };
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401, error: "Non authentifié" };

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401, error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { ok: false, status: 403, error: "Réservé aux admins" };

  return { ok: true, via: "admin" };
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
