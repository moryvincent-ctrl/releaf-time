import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Leaf } from "lucide-react";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/consultant");
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
              />
            </div>
            <Button type="submit" className="w-full rounded-lg">
              Se connecter
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
