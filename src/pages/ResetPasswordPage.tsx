import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, ArrowLeft, Leaf, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { parseRecoveryLink } from "@/lib/authRecovery";

const MIN_LENGTH = 6;

/** Traduit les erreurs renvoyées par `auth.updateUser`. */
function passwordErrorMessage(message: string): string {
  if (/should be different/i.test(message))
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (/at least|too short|weak/i.test(message))
    return `Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`;
  if (/session|jwt|expired/i.test(message))
    return "Ta session de réinitialisation a expiré. Demande un nouveau lien.";
  return message;
}

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Établit la session de récupération à partir du lien reçu par email.
  useEffect(() => {
    let cancelled = false;

    const finish = (next: "ready" | "invalid", message?: string) => {
      if (cancelled) return;
      if (message) setLinkError(message);
      setStatus(next);
    };

    (async () => {
      const link = parseRecoveryLink(window.location.href);
      if (link.kind === "error") {
        finish("invalid", link.message);
        return;
      }

      // `getSession()` attend l'initialisation du client, qui consomme lui-même
      // le lien quand il est valide : dans ce cas il n'y a plus rien à échanger.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        finish("ready");
        return;
      }

      if (link.kind === "otp") {
        const { error } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: link.tokenHash,
        });
        finish(error ? "invalid" : "ready", error?.message);
        return;
      }

      if (link.kind === "pkce") {
        const { error } = await supabase.auth.exchangeCodeForSession(link.code);
        finish(
          error ? "invalid" : "ready",
          error &&
            "Ce lien doit être ouvert dans le navigateur depuis lequel tu l'as demandé."
        );
        return;
      }

      if (link.kind === "implicit") {
        const { error } = await supabase.auth.setSession({
          access_token: link.accessToken,
          refresh_token: link.refreshToken,
        });
        finish(error ? "invalid" : "ready", error?.message);
        return;
      }

      finish("invalid");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`);
      return;
    }
    if (password !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      setError(passwordErrorMessage(error.message));
      return;
    }

    toast.success("Mot de passe mis à jour");
    navigate("/consultant", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-xl border border-border p-8">
          <div className="flex items-center justify-center gap-2 mb-8">
            <Leaf size={28} className="text-secondary" />
            <span className="font-heading font-semibold text-xl text-primary">
              Releaf <span className="font-normal">Time</span>
            </span>
          </div>

          {status === "checking" && (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-secondary" size={24} />
            </div>
          )}

          {status === "invalid" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 px-3 py-3 rounded-lg">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>
                  {linkError ??
                    "Ce lien de réinitialisation est invalide ou a expiré. Demande un nouveau lien."}
                </span>
              </div>
              <Button asChild className="w-full rounded-lg">
                <Link to="/forgot-password">Demander un nouveau lien</Link>
              </Button>
              <Link
                to="/"
                className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft size={14} />
                Retour à la connexion
              </Link>
            </div>
          )}

          {status === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h1 className="font-heading font-semibold text-primary mb-1">
                  Nouveau mot de passe
                </h1>
                <p className="text-sm text-muted-foreground">
                  Choisis un mot de passe d'au moins {MIN_LENGTH} caractères.
                </p>
              </div>

              <div>
                <label className="label-uppercase block mb-1.5">Nouveau mot de passe</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-card border-input focus:ring-ring"
                  required
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <div>
                <label className="label-uppercase block mb-1.5">Confirmation</label>
                <Input
                  type="password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="••••••••"
                  className="bg-card border-input focus:ring-ring"
                  required
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full rounded-lg" disabled={saving}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Enregistrement…
                  </span>
                ) : (
                  "Enregistrer le mot de passe"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
