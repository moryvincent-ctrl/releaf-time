import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, ArrowLeft, Leaf, MailCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (error) {
      // Un email inconnu ne renvoie pas d'erreur (Supabase ne révèle pas les
      // comptes existants) : ici c'est un vrai problème d'envoi ou de quota.
      setError("Impossible d'envoyer l'email pour le moment. Réessaie dans quelques minutes.");
      return;
    }
    setSent(true);
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

          {sent ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-sm text-secondary bg-secondary/10 px-3 py-3 rounded-lg">
                <MailCheck size={16} className="mt-0.5 shrink-0" />
                <span>
                  Si un compte existe pour <strong>{email.trim()}</strong>, un email
                  contenant un lien de réinitialisation vient d'être envoyé. Le lien est
                  valable une heure.
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Pense à vérifier tes spams. Tu peux fermer cette page.
              </p>
              <Link
                to="/"
                className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft size={14} />
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h1 className="font-heading font-semibold text-primary mb-1">
                  Mot de passe oublié
                </h1>
                <p className="text-sm text-muted-foreground">
                  Renseigne ton email professionnel : tu recevras un lien pour choisir un
                  nouveau mot de passe.
                </p>
              </div>

              <div>
                <label className="label-uppercase block mb-1.5">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenomnom@releafcarbon.com"
                  className="bg-card border-input focus:ring-ring"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full rounded-lg" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Envoi…
                  </span>
                ) : (
                  "Envoyer le lien"
                )}
              </Button>

              <Link
                to="/"
                className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft size={14} />
                Retour à la connexion
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
