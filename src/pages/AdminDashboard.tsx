import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Users, Briefcase, Clock, PieChart as PieChartIcon, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import AppLayout from "@/components/AppLayout";
import KpiCard from "@/components/KpiCard";
import { useAdminStats, useAdminEntries } from "@/hooks/useAdminData";
import { PeriodSelector, PERIOD_LABELS_THIS, defaultPeriodValue, type PeriodValue } from "@/components/PeriodSelector";
import { format } from "date-fns";

// Palette pour les catégories internes (distincte du vert client)
const INTERNAL_COLORS = [
  "#002E22", // ink
  "#689B87", // sage
  "#C8A7EE", // mint-dark (lavande)
  "#F0D7FF", // mint pâle
  "#D4A373", // ocre
  "#E07A5F", // terracotta
  "#8E94A8", // gris bleu
  "#B5838D", // rosé
];

const AdminDashboard = () => {
  const [filterConsultant, setFilterConsultant] = useState("");
  const [filterMission, setFilterMission] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriodValue("month"));
  const periodLabel = PERIOD_LABELS_THIS[period.period];

  const { data: stats, isLoading: loadingStats } = useAdminStats(period);
  const { data: entries = [], isLoading: loadingEntries } = useAdminEntries({
    consultant: filterConsultant,
    mission: filterMission,
    date: filterDate,
  });

  return (
    <AppLayout role="admin">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-heading font-semibold text-primary">Vue globale</h2>
        <div className="flex items-center gap-3">
          <PeriodSelector value={period} onChange={setPeriod} />
          <Button variant="outline" className="rounded-lg border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground">
            <Download size={16} className="mr-2" /> Exporter CSV
          </Button>
        </div>
      </div>

      {loadingStats ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-secondary" size={24} />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard icon={<Clock size={18} />} label={`Heures ${periodLabel}`} value={`${stats?.totalHours ?? 0}h`} />
          <KpiCard icon={<Users size={18} />} label="Consultants actifs" value={`${stats?.activeConsultants ?? 0}`} />
          <KpiCard icon={<Briefcase size={18} />} label="Missions actives" value={`${stats?.activeMissions ?? 0}`} />
          <KpiCard icon={<PieChartIcon size={18} />} label="% temps client" value={`${stats?.percentClient ?? 0}%`} />
        </div>
      )}

      {/* Répartition client vs internes sur la période */}
      <div className="bg-card rounded-lg border border-border p-5 mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="label-uppercase">Répartition client / interne {periodLabel}</h3>
          <div className="text-xs text-muted-foreground">
            Client {stats?.clientHours ?? 0}h · Interne {stats?.internalHours ?? 0}h
          </div>
        </div>
        {(stats?.repartition ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune saisie {periodLabel}</p>
        ) : (
          <div className="grid grid-cols-2 gap-6 items-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={stats?.repartition ?? []}
                  dataKey="hours"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {(stats?.repartition ?? []).map((slice, i) => (
                    <Cell
                      key={i}
                      fill={slice.isClient ? "#007F5F" : INTERNAL_COLORS[i % INTERNAL_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, _name: any, props: any) => [`${value}h (${props.payload.percent}%)`, props.payload.name]}
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid hsl(156, 20%, 88%)", borderRadius: "8px", fontSize: "13px" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5">
              {(stats?.repartition ?? []).map((slice, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: slice.isClient ? "#007F5F" : INTERNAL_COLORS[i % INTERNAL_COLORS.length] }}
                  />
                  <span className="flex-1 truncate">{slice.name}</span>
                  <span className="font-semibold text-primary">{slice.hours}h</span>
                  <span className="text-xs text-muted-foreground w-9 text-right">{slice.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Charge par consultant sur la période */}
      <div className="bg-card rounded-lg border border-border p-5 mb-6">
        <h3 className="label-uppercase mb-4">Charge par consultant {periodLabel}</h3>
        {(stats?.byConsultant ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune saisie {periodLabel}</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats?.byConsultant ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(156, 20%, 88%)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#1C1C1C" }} />
                <YAxis tick={{ fontSize: 12, fill: "#1C1C1C" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid hsl(156, 20%, 88%)", borderRadius: "8px", fontSize: "13px" }}
                  formatter={(value: any, name: any) => [`${value}h`, name]}
                />
                <Bar dataKey="client" stackId="a" fill="#007F5F" name="Client" radius={[0, 0, 0, 0]} />
                <Bar dataKey="internal" stackId="a" fill="#002E22" name="Interne" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <table className="w-full mt-4">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-2 label-uppercase">Consultant</th>
                  <th className="text-right px-2 py-2 label-uppercase">Total</th>
                  <th className="text-right px-2 py-2 label-uppercase">Client</th>
                  <th className="text-right px-2 py-2 label-uppercase">Interne</th>
                  <th className="text-right px-2 py-2 label-uppercase">% client</th>
                  <th className="px-2 py-2 label-uppercase w-32">Répartition</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.byConsultant ?? []).map((c) => (
                  <tr key={c.fullName} className="border-b border-border last:border-b-0">
                    <td className="px-2 py-2 text-sm">{c.fullName}</td>
                    <td className="px-2 py-2 text-sm text-right font-semibold text-primary">{c.total}h</td>
                    <td className="px-2 py-2 text-sm text-right">{c.client}h</td>
                    <td className="px-2 py-2 text-sm text-right">{c.internal}h</td>
                    <td className="px-2 py-2 text-sm text-right text-muted-foreground">{c.percentClient}%</td>
                    <td className="px-2 py-2">
                      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                        <div className="bg-secondary" style={{ width: `${c.percentClient}%` }} />
                        <div className="bg-primary" style={{ width: `${100 - c.percentClient}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Table des saisies */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Input
            placeholder="Filtrer par consultant..."
            value={filterConsultant}
            onChange={(e) => setFilterConsultant(e.target.value)}
            className="max-w-xs bg-card border-input rounded-md"
          />
          <Input
            placeholder="Filtrer par mission..."
            value={filterMission}
            onChange={(e) => setFilterMission(e.target.value)}
            className="max-w-xs bg-card border-input rounded-md"
          />
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="max-w-[180px] bg-card border-input rounded-md"
          />
        </div>

        {loadingEntries ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-secondary" size={20} />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune saisie trouvée</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 label-uppercase">Consultant</th>
                <th className="text-left px-4 py-3 label-uppercase">Mission</th>
                <th className="text-left px-4 py-3 label-uppercase">Nature</th>
                <th className="text-left px-4 py-3 label-uppercase">Date</th>
                <th className="text-right px-4 py-3 label-uppercase">Heures</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e: any) => (
                <tr key={e.id} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm">{e.user?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    {e.mission_id ? (
                      <Link to={`/missions/${e.mission_id}`} className="text-secondary hover:underline">
                        {e.mission?.name ?? "—"}
                      </Link>
                    ) : (
                      e.internal_category ?? "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{e.mission?.nature_mission ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {format(new Date(e.entry_date + "T12:00:00"), "dd/MM/yyyy")}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-primary">{e.hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
