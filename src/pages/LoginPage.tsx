import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ReleafLogo from "@/components/ReleafLogo";

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/consultant");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="w-full max-w-md bg-card rounded-lg border border-border p-8">
        <div className="flex justify-center mb-8">
          <ReleafLogo size="lg" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="label-uppercase">
              Adresse e-mail
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-card border-input focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="label-uppercase">
              Mot de passe
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-card border-input focus-visible:ring-ring"
            />
          </div>

          <Button type="submit" className="w-full rounded-lg">
            Se connecter
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Mot de passe oublié ?{" "}
          <a href="#" className="text-secondary hover:underline">
            Réinitialiser
          </a>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
