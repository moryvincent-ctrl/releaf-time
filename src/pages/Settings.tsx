import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, RefreshCw, Link2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";

const users = [
  { name: "Marie Dupont", email: "marie@releaf.fr", role: "Consultant" },
  { name: "Luc Martin", email: "luc@releaf.fr", role: "Consultant" },
  { name: "Sophie Bernard", email: "sophie@releaf.fr", role: "Manager" },
  { name: "Claire Moreau", email: "claire@releaf.fr", role: "Manager" },
  { name: "Antoine Petit", email: "antoine@releaf.fr", role: "Consultant" },
  { name: "Jules Laurent", email: "jules@releaf.fr", role: "Consultant" },
  { name: "Admin Releaf", email: "admin@releaf.fr", role: "Admin" },
];

const Settings = () => {
  const [apiKey, setApiKey] = useState("");
  const [dbId, setDbId] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");

  return (
    <AppLayout role="admin">
      <h2 className="text-xl font-heading font-semibold text-primary mb-6">Paramètres</h2>

      {/* Notion Sync */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Link2 size={20} className="text-secondary" />
          <h3 className="font-heading font-semibold text-primary">Synchronisation Notion</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Connectez votre base Notion pour synchroniser missions, consultants, managers et affectations.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label-uppercase block mb-1.5">Clé API Notion</label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="secret_..."
              className="bg-card border-input"
            />
          </div>
          <div>
            <label className="label-uppercase block mb-1.5">Database ID</label>
            <Input
              value={dbId}
              onChange={(e) => setDbId(e.target.value)}
              placeholder="abc123..."
              className="bg-card border-input"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="rounded-lg border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground"
            onClick={() => setTestStatus("success")}
          >
            <Check size={16} className="mr-2" /> Tester la connexion
          </Button>
          <Button className="rounded-lg">
            <RefreshCw size={16} className="mr-2" /> Synchroniser
          </Button>
          {testStatus === "success" && (
            <span className="text-sm text-secondary font-medium">✓ Connexion réussie</span>
          )}
        </div>

        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
          <strong>Données synchronisées depuis Notion :</strong> missions, consultants, managers, affectations.
          <br />
          <strong>Données stockées en propre :</strong> temps saisis, budgets, alertes, calculs.
        </div>
      </div>

      {/* Users & Roles */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-heading font-semibold text-primary text-sm">Gestion des utilisateurs</h3>
          <Button size="sm" className="rounded-lg text-xs">Ajouter</Button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 label-uppercase">Nom</th>
              <th className="text-left px-4 py-3 label-uppercase">Email</th>
              <th className="text-left px-4 py-3 label-uppercase">Rôle</th>
              <th className="text-right px-4 py-3 label-uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={i} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                <td className="px-4 py-3 text-sm font-medium">{u.name}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    u.role === "Admin"
                      ? "bg-primary/10 text-primary"
                      : u.role === "Manager"
                      ? "bg-secondary/10 text-secondary"
                      : "bg-accent text-accent-foreground"
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                    Modifier
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
};

export default Settings;
