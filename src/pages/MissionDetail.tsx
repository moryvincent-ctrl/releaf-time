import { useParams } from "react-router-dom";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import BudgetBar from "@/components/BudgetBar";
import { useMissionDetail } from "@/hooks/useMissionsData";
import { supabase } from "@/lib/supabase";

const poleColors: Record<string, string> = {
  "Releaf Carbon": "bg-primary/10 text-primary",
  "Releaf LCA": "bg-secondary/10 text-secondary",
  "Releaf Energy": "bg-[hsl(38,80%,50%)]/10 text-[hsl(38,80%,40%)]",
  "Releaf Water": "bg-[hsl(200,70%,50%)]/10 text-[hsl(200,70%,35%)]",
  "Releaf Biodiversity": "bg-accent text-accent-foreground",
  "Releaf Campus": "bg-[hsl(270,60%,55%)]/10 text-[hsl(270,60%,45%)]",
};

const statusLabel: Record<string, string> = {
  active: "En cours",
  completed: "Terminée",
  on_hold: "En pause",
};

const MissionDetail = () => {
  const { id } = useParams();
  const { data: mission, isLoading } = useMissionDetail(id);
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const updateBudget = useMutation({
    mutationFn: async ({ assignmentId, value }: { assignmentId: string; value: number | null }) => {
      const { error } = await supabase
        .from("assignments")
        .update({ budget_days_allocated: value })
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Budget consultant mis à jour");
      queryClient.invalidateQueries({ queryKey: ["mission_detail", id] });
      queryClient.invalidateQueries({ queryKey: ["all_missions"] });
      setEditingId(null);
    },
    onError: (err: any) => toast.error(err.message ?? "Erreur"),
  });

  if (isLoading) {
    return (
      <AppLayout role="admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-secondary" size={32} />
        </div>
      </AppLayout>
    );
  }

  if (!mission) {
    return (
      <AppLayout role="admin">
        <div className="bg-card rounded-lg border border-border p-12 text-center text-muted-foreground">
          Mission introuvable.
        </div>
      </AppLayout>
    );
  }

  const percent = mission.budgetTotal > 0
    ? Math.round((mission.consumed / mission.budgetTotal) * 100)
    : 0;

  return (
    <AppLayout role="admin">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-xl font-heading font-semibold text-primary">{mission.client}</h2>
          <span className="bg-accent text-accent-foreground text-xs font-medium px-2.5 py-1 rounded">
            {statusLabel[mission.status] ?? mission.status}
          </span>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${poleColors[mission.pole] || "bg-muted text-muted-foreground"}`}>
            {mission.pole}
          </span>
        </div>
        <div className="text-sm text-muted-foreground mb-3">
          {mission.project} · Manager : {mission.manager} · {mission.startDate} → {mission.endDate}
        </div>
        <div className="flex items-center gap-2">
          <span className="label-uppercase">Consultants :</span>
          <div className="flex -space-x-2">
            {mission.consultants.map((c, i) => (
              c.avatarUrl ? (
                <img
                  key={i}
                  src={c.avatarUrl}
                  alt={c.name}
                  title={c.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-card"
                />
              ) : (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-semibold border-2 border-card"
                  title={c.name}
                >
                  {c.initial}
                </div>
              )
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-1">
            {mission.consultants.map((c) => c.name).join(", ")}
          </span>
        </div>
      </div>

      <Tabs defaultValue="budget">
        <TabsList className="mb-4">
          <TabsTrigger value="budget">Vue budget</TabsTrigger>
          <TabsTrigger value="consultants">Temps par consultant</TabsTrigger>
          <TabsTrigger value="history">Historique saisies</TabsTrigger>
        </TabsList>

        <TabsContent value="budget">
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="label-uppercase mb-1">Budget prévu</div>
                <div className="text-2xl font-heading font-bold text-primary">{mission.budgetTotal}j</div>
              </div>
              <div>
                <div className="label-uppercase mb-1">Budget consommé</div>
                <div className="text-2xl font-heading font-bold text-secondary">{mission.consumed}j</div>
              </div>
              <div>
                <div className="label-uppercase mb-1">Reste</div>
                <div className={`text-2xl font-heading font-bold ${mission.budgetTotal - mission.consumed < 0 ? "text-destructive" : "text-primary"}`}>
                  {Math.round((mission.budgetTotal - mission.consumed) * 10) / 10}j
                </div>
              </div>
            </div>
            <BudgetBar percent={percent} />
            {percent >= 80 && percent < 100 && (
              <div className="mt-3 text-sm text-[hsl(38,92%,50%)] flex items-center gap-2">
                🟡 Attention : {percent}% du budget consommé
              </div>
            )}
            {percent >= 100 && (
              <div className="mt-3 text-sm text-destructive flex items-center gap-2">
                🔴 Budget dépassé de {Math.round((mission.consumed - mission.budgetTotal) * 10) / 10}j
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="consultants">
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            {mission.consultants.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Aucun consultant assigné.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 label-uppercase">Consultant</th>
                    <th className="text-right px-4 py-3 label-uppercase">Heures saisies</th>
                    <th className="text-right px-4 py-3 label-uppercase">Budget alloué</th>
                    <th className="text-right px-4 py-3 label-uppercase">% consommé</th>
                    <th className="px-4 py-3 label-uppercase w-40">Progression</th>
                  </tr>
                </thead>
                <tbody>
                  {mission.consultants.map((c, i) => {
                    const cp = c.budget > 0 ? Math.round((c.consumed / c.budget) * 100) : 0;
                    return (
                      <tr key={i} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-3 text-sm font-medium flex items-center gap-2">
                          {c.avatarUrl ? (
                            <img
                              src={c.avatarUrl}
                              alt={c.name}
                              className="w-9 h-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-semibold">
                              {c.initial}
                            </div>
                          )}
                          {c.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-primary">{c.hours}h</td>
                        <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                          {editingId === c.assignmentId ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Input
                                type="number"
                                step={0.25}
                                min={0}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 h-7 text-right text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const v = parseFloat(editValue);
                                    updateBudget.mutate({ assignmentId: c.assignmentId, value: isNaN(v) ? null : v });
                                  } else if (e.key === "Escape") {
                                    setEditingId(null);
                                  }
                                }}
                              />
                              <button
                                onClick={() => {
                                  const v = parseFloat(editValue);
                                  updateBudget.mutate({ assignmentId: c.assignmentId, value: isNaN(v) ? null : v });
                                }}
                                className="p-1 text-secondary hover:bg-secondary/10 rounded"
                                title="Valider"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1 text-muted-foreground hover:bg-muted rounded"
                                title="Annuler"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingId(c.assignmentId);
                                setEditValue(String(c.budget));
                              }}
                              className={`px-2 py-0.5 rounded hover:bg-muted transition-colors ${c.budgetOverride == null ? "italic" : "font-medium text-primary"}`}
                              title={c.budgetOverride == null ? "Cliquer pour fixer un budget personnalisé (actuellement part égale)" : "Cliquer pour modifier"}
                            >
                              {c.budget}j
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">{cp}%</td>
                        <td className="px-4 py-3"><BudgetBar percent={cp} /></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {(() => {
                    const totalAllocated = mission.consultants.reduce((s, c) => s + c.budget, 0);
                    const totalAllocatedRounded = Math.round(totalAllocated * 10) / 10;
                    const delta = Math.round((totalAllocated - mission.budgetTotal) * 10) / 10;
                    const status: "ok" | "under" | "over" = Math.abs(delta) < 0.05 ? "ok" : (delta < 0 ? "under" : "over");
                    return (
                      <tr className="bg-muted/40 border-t border-border">
                        <td className="px-4 py-3 text-sm font-semibold text-primary">Total alloué</td>
                        <td></td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-primary">
                          {totalAllocatedRounded}j / {mission.budgetTotal}j
                        </td>
                        <td colSpan={2} className="px-4 py-3 text-sm">
                          {status === "ok" && (
                            <span className="text-secondary font-medium">✓ Répartition cohérente</span>
                          )}
                          {status === "under" && (
                            <span className="text-[hsl(38,92%,40%)] font-medium">
                              🟡 Sous-allocation : il reste {Math.abs(delta)}j à répartir
                            </span>
                          )}
                          {status === "over" && (
                            <span className="text-destructive font-medium">
                              🔴 Sur-allocation : {delta}j de trop par rapport au budget mission
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            {mission.entries.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Aucune saisie de temps sur cette mission.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 label-uppercase">Date</th>
                    <th className="text-left px-4 py-3 label-uppercase">Consultant</th>
                    <th className="text-right px-4 py-3 label-uppercase">Heures</th>
                    <th className="text-left px-4 py-3 label-uppercase">Commentaire</th>
                  </tr>
                </thead>
                <tbody>
                  {mission.entries.map((e, i) => (
                    <tr key={i} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3 text-sm text-muted-foreground">{e.date}</td>
                      <td className="px-4 py-3 text-sm">{e.consultant}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-primary">{e.hours}h</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{e.comment || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default MissionDetail;
