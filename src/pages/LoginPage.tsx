import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Leaf, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const roleRedirect: Record<string, string> = {
  consultant: "/consultant",
  manager: "/manager",
  admin: "/admin",
};

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, profile, session } = useAuth();
  const navigate = useNavigate();

  // Redirige si déjà connecté
  useEffect(() => {
    if (session && profile) {
      navigate(roleRedirect[profile.role] ?? "/consultant", { replace: true });
    }
  }, [session, profile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
    }
    // La redirection se fait via useEffect quand profile est chargé
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-xl border border-border p-8">
          <div className="flex items-center justify-center gap-2 mb-8">
            <Leaf size={28} className="text-secondary" />
            <span className="font-heading font-semibold text-xl text-primary">
              Releaf <span className="font-normal">Time</span>
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label-uppercase block mb-1.5">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom@releaf.fr"
                className="bg-card border-input focus:ring-ring"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label-uppercase block mb-1.5">Mot de passe</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-card border-input focus:ring-ring"
                required
                autoComplete="current-password"
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
                  Connexion…
                </span>
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
