import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, Zap, TrendingUp } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import KpiCard from "@/components/KpiCard";
import BudgetBar from "@/components/BudgetBar";

const missions = [
  {
    client: "EcoTech Solutions",
    project: "Bilan Carbone 2025",
    budgetTotal: 120,
    consumed: 78,
    consultants: [
      { name: "Marie Dupont", hours: 38, percent: 32 },
      { name: "Luc Martin", hours: 40, percent: 33 },
    ],
    alerts: ["warning"],
  },
  {
    client: "Ville de Lyon",
    project: "Plan Climat Territorial",
    budgetTotal: 200,
    consumed: 185,
    consultants: [
      { name: "Sophie Bernard", hours: 95, percent: 47 },
      { name: "Antoine Petit", hours: 90, percent: 45 },
    ],
    alerts: ["critical"],
  },
  {
    client: "AgroVert",
    project: "Audit Biodiversité",
    budgetTotal: 80,
    consumed: 92,
    consultants: [
      { name: "Claire Moreau", hours: 52, percent: 65 },
      { name: "Jules Laurent", hours: 40, percent: 50 },
    ],
    alerts: ["exceeded", "velocity"],
  },
  {
    client: "TransportPlus",
    project: "Mobilité Durable",
    budgetTotal: 150,
    consumed: 45,
    consultants: [
      { name: "Marie Dupont", hours: 25, percent: 17 },
      { name: "Luc Martin", hours: 20, percent: 13 },
    ],
    alerts: [],
  },
];

const ManagerDashboard = () => {
  const totalBudget = missions.reduce((a, m) => a + m.budgetTotal, 0);
  const totalConsumed = missions.reduce((a, m) => a + m.consumed, 0);
  const alertCount = missions.filter((m) => m.alerts.length > 0).length;

  return (
    <AppLayout role="manager">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-heading font-semibold text-primary">Mes missions</h2>
        <Button variant="outline" className="rounded-lg border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground">
          <Download size={16} className="mr-2" /> Exporter CSV
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard icon={<TrendingUp size={18} />} label="Budget total" value={`${totalBudget}j`} />
        <KpiCard icon={<TrendingUp size={18} />} label="Temps consommé" value={`${totalConsumed}j`} />
        <KpiCard icon={<AlertTriangle size={18} />} label="Alertes actives" value={`${alertCount}`} />
      </div>

      <div className="space-y-4">
        {missions.map((m, i) => {
          const percent = Math.round((m.consumed / m.budgetTotal) * 100);
          return (
            <div key={i} className="bg-card rounded-lg border border-border p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-heading font-semibold text-primary">{m.client}</div>
                  <div className="text-sm text-muted-foreground">{m.project}</div>
                </div>
                <div className="flex gap-2">
                  {m.alerts.includes("warning") && (
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-[hsl(38,92%,50%)]/10 text-[hsl(38,92%,50%)]">
                      🟡 80% budget
                    </span>
                  )}
                  {m.alerts.includes("critical") && (
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-destructive/10 text-destructive">
                      🔴 Dépassement
                    </span>
                  )}
                  {m.alerts.includes("exceeded") && (
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-destructive/10 text-destructive">
                      🔴 Budget dépassé
                    </span>
                  )}
                  {m.alerts.includes("velocity") && (
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-[hsl(38,92%,50%)]/10 text-[hsl(38,92%,50%)]">
                      ⚡ Consommation rapide
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{m.consumed}j / {m.budgetTotal}j</span>
                  <span>{percent}%</span>
                </div>
                <BudgetBar percent={percent} showLabel={false} />
              </div>

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
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
};

export default ManagerDashboard;
