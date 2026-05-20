import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Briefcase, TrendingUp, PieChart, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import KpiCard from "@/components/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useMyStats } from "@/hooks/useMyStats";

const roleLabels: Record<string, string> = {
  consultant: "Consultant·e",
  manager: "Manager",
  admin: "Administrateur·trice",
};

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

const MyAccount = () => {
  const { profile, user, refreshProfile } = useAuth();
  const { data: stats, isLoading } = useMyStats();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [newPassword, setNewPassword] = useState("");

  const updateName = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Nom mis à jour");
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Erreur"),
  });

  const updatePassword = useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mot de passe mis à jour");
      setNewPassword("");
    },
    onError: (err: any) => toast.error(err.message ?? "Erreur"),
  });

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-secondary" size={32} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h2 className="text-xl font-heading font-semibold text-primary mb-6">Mon compte</h2>

      {/* Header profil */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-heading font-semibold">
          {initialsOf(profile.full_name)}
        </div>
        <div className="flex-1">
          <div className="text-lg font-heading font-semibold text-primary">{profile.full_name}</div>
          <div className="text-sm text-muted-foreground">{profile.email}</div>
          <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded bg-accent text-accent-foreground">
            {roleLabels[profile.role] ?? profile.role}
          </span>
        </div>
      </div>

      {/* Stats */}
      <h3 className="label-uppercase mb-3">Mes statistiques</h3>
      {isLoading || !stats ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-secondary" size={24} />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <KpiCard icon={<Clock size={18} />} label="Heures ce mois" value={`${stats.monthHours}h`} />
          <KpiCard icon={<TrendingUp size={18} />} label="Heures totales" value={`${stats.totalHours}h`} />
          <KpiCard icon={<Briefcase size={18} />} label="Missions actives" value={`${stats.activeAssignments}`} />
          <KpiCard icon={<PieChart size={18} />} label="% temps client" value={`${stats.percentClient}%`} />
        </div>
      )}

      {stats && (
        <div className="bg-card rounded-lg border border-border p-5 mb-8">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="label-uppercase mb-1">Heures client (total)</div>
              <div className="text-lg font-heading font-semibold text-primary">{stats.clientHours}h</div>
            </div>
            <div>
              <div className="label-uppercase mb-1">Heures interne (total)</div>
              <div className="text-lg font-heading font-semibold text-primary">{stats.internalHours}h</div>
            </div>
            <div>
              <div className="label-uppercase mb-1">Missions touchées</div>
              <div className="text-lg font-heading font-semibold text-primary">{stats.distinctMissions}</div>
            </div>
          </div>
        </div>
      )}

      {/* Édition infos */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border border-border p-5">
          <h3 className="label-uppercase mb-4">Modifier mes informations</h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile.email} disabled className="mt-1 bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">
                L'email ne peut pas être modifié ici. Contacte un admin.
              </p>
            </div>
            <div>
              <Label htmlFor="fullName">Nom complet</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button
              onClick={() => updateName.mutate(fullName)}
              disabled={updateName.isPending || !fullName.trim() || fullName === profile.full_name}
              className="rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              {updateName.isPending ? (
                <Loader2 className="animate-spin mr-2" size={16} />
              ) : (
                <Save size={16} className="mr-2" />
              )}
              Sauvegarder
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-5">
          <h3 className="label-uppercase mb-4">Changer mon mot de passe</h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                className="mt-1"
              />
            </div>
            <Button
              onClick={() => updatePassword.mutate(newPassword)}
              disabled={updatePassword.isPending || newPassword.length < 6}
              className="rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              {updatePassword.isPending ? (
                <Loader2 className="animate-spin mr-2" size={16} />
              ) : (
                <Save size={16} className="mr-2" />
              )}
              Mettre à jour
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default MyAccount;
