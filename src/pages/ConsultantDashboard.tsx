import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Briefcase, Activity, Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import KpiCard from "@/components/KpiCard";
import BudgetBar from "@/components/BudgetBar";
import { PeriodSelector, PERIOD_LABELS_THIS, defaultPeriodValue, type PeriodValue } from "@/components/PeriodSelector";
import { useConsultantDashboard } from "@/hooks/useConsultantDashboard";

const ConsultantDashboard = () => {
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriodValue("week"));
  const periodLabel = PERIOD_LABELS_THIS[period.period];
  const { data, isLoading } = useConsultantDashboard(period);

  if (isLoading || !data) {
    return (
      <AppLayout role="consultant">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-secondary" size={32} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout role="consultant">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-heading font-semibold text-primary">Mon tableau de bord</h2>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={<Clock size={18} />} label={`Heures ${periodLabel}`} value={`${data.hoursThisWeek}h`} />
        <KpiCard
          icon={<Activity size={18} />}
          label={`Charge client (${data.chargeClient}%)`}
          value={`${data.clientHoursThisWeek}h`}
        />
        <KpiCard
          icon={<Activity size={18} />}
          label={`Charge interne (${data.chargeInternal}%)`}
          value={`${data.internalHoursThisWeek}h`}
        />
        <KpiCard icon={<Briefcase size={18} />} label="Missions actives" value={`${data.activeMissionsCount}`} />
      </div>

      {/* Répartition charge cette semaine */}
      <div className="bg-card rounded-lg border border-border p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="label-uppercase">Charge {periodLabel} (base {data.weeklyBase}h)</span>
          <span className="text-xs text-muted-foreground">{data.charge}% — {data.hoursThisWeek}h / {data.weeklyBase}h</span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-muted">
          <div
            className="bg-secondary"
            style={{ width: `${Math.min(data.chargeClient, 100)}%` }}
            title={`Client ${data.clientHoursThisWeek}h (${data.chargeClient}%)`}
          />
          <div
            className="bg-primary"
            style={{ width: `${Math.min(data.chargeInternal, Math.max(0, 100 - data.chargeClient))}%` }}
            title={`Interne ${data.internalHoursThisWeek}h (${data.chargeInternal}%)`}
          />
        </div>
        <div className="flex gap-4 mt-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-secondary" /> Client {data.clientHoursThisWeek}h
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Interne {data.internalHoursThisWeek}h
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Historique récent */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="label-uppercase">Historique récent</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 label-uppercase">{period.period === "week" ? "Semaine" : period.period === "year" ? "Année" : "Mois"}</th>
                <th className="text-right px-4 py-2 label-uppercase">Heures</th>
                <th className="text-right px-4 py-2 label-uppercase">Missions</th>
              </tr>
            </thead>
            <tbody>
              {data.recentWeeks.map((w, i) => (
                <tr key={i} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2.5 text-sm">{w.label}</td>
                  <td className="px-4 py-2.5 text-sm text-right font-semibold text-primary">{w.hours}h</td>
                  <td className="px-4 py-2.5 text-sm text-right text-muted-foreground">{w.missions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Missions en cours */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="label-uppercase">Missions en cours</h3>
          </div>
          {data.missions.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground text-center">
              Aucune mission active assignée pour le moment.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.missions.map((m) => (
                <Link
                  key={m.id}
                  to={`/missions/${m.id}`}
                  className="block px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <div className="text-sm font-medium">{m.client}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.project}{m.nature ? ` · ${m.nature}` : ""}
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${m.budget >= 80 ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"}`}>
                      {m.status}
                    </span>
                  </div>
                  <BudgetBar percent={m.budget} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Missions terminées */}
      <div className="bg-card rounded-lg border border-border overflow-hidden mt-6">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="label-uppercase">Missions terminées</h3>
          <span className="text-xs text-muted-foreground">{data.missionsCompleted.length}</span>
        </div>
        {data.missionsCompleted.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground text-center">
            Aucune mission terminée pour le moment.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data.missionsCompleted.map((m) => (
              <Link
                key={m.id}
                to={`/missions/${m.id}`}
                className="block px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <div className="text-sm font-medium">{m.client}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.project}{m.nature ? ` · ${m.nature}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {m.consumed}j / {m.budgetDays}j ({m.budget}%)
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      Terminé
                    </span>
                  </div>
                </div>
                <BudgetBar percent={Math.min(m.budget, 100)} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ConsultantDashboard;
