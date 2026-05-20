import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, TrendingUp, Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import KpiCard from "@/components/KpiCard";
import BudgetBar from "@/components/BudgetBar";
import { useManagerMissions } from "@/hooks/useManagerData";

const ManagerDashboard = () => {
  const { data: missions = [], isLoading } = useManagerMissions();

  const totalBudget = missions.reduce((a, m) => a + Number(m.budget_days), 0);
  const totalConsumed = missions.reduce((a, m) => a + m.consumed_days, 0);
  const alertCount = missions.filter((m) => m.alerts.length > 0).length;

  if (isLoading) {
    return (
      <AppLayout role="manager">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-secondary" size={32} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout role="manager">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-heading font-semibold text-primary">Mes missions</h2>
        <Button variant="outline" className="rounded-lg border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground">
          <Download size={16} className="mr-2" /> Exporter CSV
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard icon={<TrendingUp size={18} />} label="Budget total" value={`${Math.round(totalBudget)}j`} />
        <KpiCard icon={<TrendingUp size={18} />} label="Temps consommé" value={`${Math.round(totalConsumed * 10) / 10}j`} />
        <KpiCard icon={<AlertTriangle size={18} />} label="Alertes actives" value={`${alertCount}`} />
      </div>

      {missions.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center text-muted-foreground">
          Aucune mission — assure-toi d'être assigné comme Manager dans Notion puis relance la sync.
        </div>
      ) : (
        <div className="space-y-4">
          {missions.map((m) => (
            <Link
              key={m.id}
              to={`/missions/${m.id}`}
              className="block bg-card rounded-lg border border-border p-5 hover:border-secondary transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-heading font-semibold text-primary">{m.client}</div>
                  {m.nature_mission && (
                    <div className="text-sm font-medium text-secondary">{m.nature_mission}</div>
                  )}
                  <div className="text-xs text-muted-foreground">{m.name}</div>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {m.alerts.includes("warning") && (
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-[hsl(38,92%,50%)]/10 text-[hsl(38,92%,50%)]">
                      🟡 75% budget
                    </span>
                  )}
                  {m.alerts.includes("critical") && (
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-destructive/10 text-destructive">
                      🔴 90% budget
                    </span>
                  )}
                  {m.alerts.includes("exceeded") && (
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-destructive/10 text-destructive">
                      🔴 Budget dépassé
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{m.consumed_days}j / {m.budget_days}j</span>
                  <span>{m.percent}%</span>
                </div>
                <BudgetBar percent={m.percent} showLabel={false} />
              </div>

              {m.consultants.length > 0 && (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 label-uppercase">Consultant</th>
                      <th className="text-right py-2 label-uppercase">Heures</th>
                      <th className="text-right py-2 label-uppercase">% budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.consultants.map((c, ci) => (
                      <tr key={ci} className="border-b border-border last:border-b-0">
                        <td className="py-2 text-sm">{c.name}</td>
                        <td className="py-2 text-sm text-right font-semibold text-primary">{c.hours}h</td>
                        <td className="py-2 text-sm text-right text-muted-foreground">{c.percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default ManagerDashboard;
