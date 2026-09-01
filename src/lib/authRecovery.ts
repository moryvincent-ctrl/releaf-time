/**
 * Analyse du lien reçu par email pour réinitialiser un mot de passe.
 *
 * Supabase peut renvoyer l'utilisateur de trois façons selon la configuration du
 * projet et du template d'email :
 *  - flux implicite (celui par défaut ici) : `#access_token=…&refresh_token=…&type=recovery`
 *  - template personnalisé avec `{{ .TokenHash }}` : `?token_hash=…&type=recovery`
 *  - flux PKCE : `?code=…`
 * et, en cas de lien expiré ou déjà utilisé : `#error=…&error_code=…`.
 *
 * Le client Supabase consomme lui-même le lien au démarrage (detectSessionInUrl),
 * mais il laisse l'URL intacte quand elle porte une erreur : c'est ce cas-là qu'on
 * doit savoir relire pour afficher un message utile plutôt qu'un écran vide.
 */
export type RecoveryLink =
  | { kind: "none" }
  | { kind: "error"; message: string }
  | { kind: "implicit"; accessToken: string; refreshToken: string }
  | { kind: "otp"; tokenHash: string }
  | { kind: "pkce"; code: string };

const EXPIRED_MESSAGE =
  "Ce lien a expiré ou a déjà été utilisé. Demande un nouveau lien de réinitialisation.";

/** Traduit les codes d'erreur renvoyés par Supabase dans l'URL. */
export function recoveryErrorMessage(
  code: string | null,
  description: string | null
): string {
  if (code === "otp_expired" || code === "access_denied") return EXPIRED_MESSAGE;
  if (description) {
    const readable = description.replace(/\+/g, " ").trim();
    // Supabase renvoie ce texte quand le lien a été ouvert deux fois.
    if (/expired|invalid/i.test(readable)) return EXPIRED_MESSAGE;
    return readable;
  }
  return "Ce lien de réinitialisation est invalide.";
}

export function parseRecoveryLink(href: string): RecoveryLink {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { kind: "none" };
  }

  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const get = (key: string) => url.searchParams.get(key) ?? hash.get(key);

  const error = get("error") ?? get("error_code") ?? get("error_description");
  if (error) {
    return {
      kind: "error",
      message: recoveryErrorMessage(get("error_code"), get("error_description")),
    };
  }

  const accessToken = get("access_token");
  const refreshToken = get("refresh_token");
  if (accessToken && refreshToken) {
    return { kind: "implicit", accessToken, refreshToken };
  }

  const tokenHash = get("token_hash");
  if (tokenHash) return { kind: "otp", tokenHash };

  const code = get("code");
  if (code) return { kind: "pkce", code };

  return { kind: "none" };
}
