import { Clock, Briefcase, Activity } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import KpiCard from "@/components/KpiCard";
import BudgetBar from "@/components/BudgetBar";

const recentWeeks = [
  { week: "17–21 mars 2025", hours: 38, missions: 3 },
  { week: "10–14 mars 2025", hours: 40, missions: 4 },
  { week: "3–7 mars 2025", hours: 35, missions: 3 },
  { week: "24–28 fév 2025", hours: 37, missions: 3 },
];

const activeMissions = [
  { client: "EcoTech Solutions", project: "Bilan Carbone 2025", budget: 65, status: "En cours" },
  { client: "Ville de Lyon", project: "Plan Climat Territorial", budget: 42, status: "En cours" },
  { client: "AgroVert", project: "Audit Biodiversité", budget: 88, status: "Alerte" },
  { client: "TransportPlus", project: "Mobilité Durable", budget: 20, status: "En cours" },
];

const ConsultantDashboard = () => {
  return (
    <AppLayout role="consultant">
      <h2 className="text-xl font-heading font-semibold text-primary mb-6">Mon tableau de bord</h2>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard icon={<Clock size={18} />} label="Heures cette semaine" value="38h" />
        <KpiCard icon={<Briefcase size={18} />} label="Missions actives" value="4" />
        <KpiCard icon={<Activity size={18} />} label="Charge actuelle" value="95%" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent weeks */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="label-uppercase">Historique récent</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 label-uppercase">Semaine</th>
                <th className="text-right px-4 py-2 label-uppercase">Heures</th>
                <th className="text-right px-4 py-2 label-uppercase">Missions</th>
              </tr>
            </thead>
            <tbody>
              {recentWeeks.map((w, i) => (
                <tr key={i} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2.5 text-sm">{w.week}</td>
                  <td className="px-4 py-2.5 text-sm text-right font-semibold text-primary">{w.hours}h</td>
                  <td className="px-4 py-2.5 text-sm text-right text-muted-foreground">{w.missions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Active missions */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="label-uppercase">Missions en cours</h3>
          </div>
          <div className="divide-y divide-border">
            {activeMissions.map((m, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <div className="text-sm font-medium">{m.client}</div>
                    <div className="text-xs text-muted-foreground">{m.project}</div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${m.budget >= 80 ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"}`}>
                    {m.status}
                  </span>
                </div>
                <BudgetBar percent={m.budget} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ConsultantDashboard;
