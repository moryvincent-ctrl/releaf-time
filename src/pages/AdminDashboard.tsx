import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Users, Briefcase, Clock, PieChart as PieChartIcon, Loader2, Network, Layers, FileText, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import AppLayout from "@/components/AppLayout";
import KpiCard from "@/components/KpiCard";
import { useAdminStats, useAdminEntries } from "@/hooks/useAdminData";
import { PeriodSelector, PERIOD_LABELS_THIS, defaultPeriodValue, type PeriodValue } from "@/components/PeriodSelector";
import { format } from "date-fns";

// Couleurs des 4 familles — alignées sur ConsultantDashboard
const COLOR_CLIENT = "#007F5F";     // secondary
const COLOR_TRANSVERSE = "#C8A7EE"; // mint-dark / lavande (ring)
const COLOR_PROPOSAL = "#F59E0B";   // warning orange
const COLOR_INTERNAL_DEFAULT = "#002E22"; // ink (par défaut pour internal_category)

// Palette pour la pie des catégories internes (réutilisée hors des 4 familles)
const INTERNAL_COLORS = [
  COLOR_INTERNAL_DEFAULT,
  "#689B87", // sage
  "#F0D7FF", // mint pâle
  "#D4A373", // ocre
  "#E07A5F", // terracotta
  "#8E94A8", // gris bleu
  "#B5838D", // rosé
];

function sliceColor(slice: { isClient: boolean; isTransverse: boolean; isProposal: boolean }, fallbackIndex: number): string {
  if (slice.isClient) return COLOR_CLIENT;
  if (slice.isTransverse) return COLOR_TRANSVERSE;
  if (slice.isProposal) return COLOR_PROPOSAL;
  return INTERNAL_COLORS[fallbackIndex % INTERNAL_COLORS.length];
}

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
        <div className="grid grid-cols-5 gap-4 mb-6">
          <KpiCard icon={<Clock size={18} />} label={`Heures ${periodLabel}`} value={`${stats?.totalHours ?? 0}h`} />
          <KpiCard icon={<Users size={18} />} label="Consultants actifs" value={`${stats?.activeConsultants ?? 0}`} />
          <KpiCard icon={<Briefcase size={18} />} label="Missions actives" value={`${stats?.activeMissions ?? 0}`} />
          <KpiCard icon={<PieChartIcon size={18} />} label="% temps client" value={`${stats?.percentClient ?? 0}%`} />
          <KpiCard
            icon={<Network size={18} />}
            label={`Charge transverse (${stats?.percentTransverse ?? 0}%)`}
            value={`${stats?.transverseHours ?? 0}h`}
          />
        </div>
      )}

      {/* Répartition client / transverse / propale / interne sur la période */}
      <div className="bg-card rounded-lg border border-border p-5 mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="card-title">Répartition {periodLabel}</h3>
          <div className="text-xs text-muted-foreground">
            Client {stats?.clientHours ?? 0}h · Transverses {stats?.transverseHours ?? 0}h · Propales {stats?.proposalHours ?? 0}h · Interne {stats?.internalHours ?? 0}h
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
                    <Cell key={i} fill={sliceColor(slice, i)} />
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
                    style={{ backgroundColor: sliceColor(slice, i) }}
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
        <h3 className="card-title mb-4">Charge par consultant {periodLabel}</h3>
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
                <Bar dataKey="client"     stackId="a" fill={COLOR_CLIENT}           name="Client" />
                <Bar dataKey="transverse" stackId="a" fill={COLOR_TRANSVERSE}       name="Transverses" />
                <Bar dataKey="proposal"   stackId="a" fill={COLOR_PROPOSAL}         name="Propales" />
                <Bar dataKey="internal"   stackId="a" fill={COLOR_INTERNAL_DEFAULT} name="Interne" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="flex flex-wrap gap-4 mt-3 mb-2 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLOR_CLIENT }} /> Client</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLOR_TRANSVERSE }} /> Projets transverses</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLOR_PROPOSAL }} /> Propales</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLOR_INTERNAL_DEFAULT }} /> Interne</span>
            </div>

            <table className="w-full mt-4">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-2 label-uppercase">Consultant</th>
                  <th className="text-right px-2 py-2 label-uppercase">Total</th>
                  <th className="text-right px-2 py-2 label-uppercase">Client</th>
                  <th className="text-right px-2 py-2 label-uppercase">Transverse</th>
                  <th className="text-right px-2 py-2 label-uppercase">Propale</th>
                  <th className="text-right px-2 py-2 label-uppercase">Interne</th>
                  <th className="text-right px-2 py-2 label-uppercase">% client</th>
                  <th className="px-2 py-2 label-uppercase w-32">Répartition</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.byConsultant ?? []).map((c) => {
                  const t = c.total > 0 ? c.total : 1;
                  const pc = (c.client / t) * 100;
                  const pt = (c.transverse / t) * 100;
                  const pp = (c.proposal / t) * 100;
                  const pi = (c.internal / t) * 100;
                  return (
                    <tr key={c.fullName} className="border-b border-border last:border-b-0">
                      <td className="px-2 py-2 text-sm">{c.fullName}</td>
                      <td className="px-2 py-2 text-sm text-right font-semibold text-primary">{c.total}h</td>
                      <td className="px-2 py-2 text-sm text-right">{c.client}h</td>
                      <td className="px-2 py-2 text-sm text-right">{c.transverse}h</td>
                      <td className="px-2 py-2 text-sm text-right">{c.proposal}h</td>
                      <td className="px-2 py-2 text-sm text-right">{c.internal}h</td>
                      <td className="px-2 py-2 text-sm text-right text-muted-foreground">{c.percentClient}%</td>
                      <td className="px-2 py-2">
                        <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                          <div style={{ width: `${pc}%`, backgroundColor: COLOR_CLIENT }} />
                          <div style={{ width: `${pt}%`, backgroundColor: COLOR_TRANSVERSE }} />
                          <div style={{ width: `${pp}%`, backgroundColor: COLOR_PROPOSAL }} />
                          <div style={{ width: `${pi}%`, backgroundColor: COLOR_INTERNAL_DEFAULT }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Temps internes + Projets transverses + Propales (agrégés sur la période) */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Activity size={16} className="text-muted-foreground" />
            <h3 className="card-title">Temps internes</h3>
            <span className="ml-auto text-xs text-muted-foreground">{(stats?.internalByCategory ?? []).length}</span>
          </div>
          {(stats?.internalByCategory ?? []).length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground text-center">Aucun temps interne {periodLabel}</div>
          ) : (
            <div className="divide-y divide-border">
              {(stats?.internalByCategory ?? []).map((c) => (
                <div key={c.name} className="px-4 py-3 flex justify-between items-center">
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs font-semibold text-primary">{c.hours}h</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Layers size={16} className="text-muted-foreground" />
            <h3 className="card-title">Projets transverses</h3>
            <span className="ml-auto text-xs text-muted-foreground">{(stats?.transverseProjects ?? []).length}</span>
          </div>
          {(stats?.transverseProjects ?? []).length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground text-center">Aucun projet transverse {periodLabel}</div>
          ) : (
            <div className="divide-y divide-border">
              {(stats?.transverseProjects ?? []).map((p) => (
                <div key={p.name} className="px-4 py-3 flex justify-between items-center">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs font-semibold text-primary">{p.hours}h</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <FileText size={16} className="text-muted-foreground" />
            <h3 className="card-title">Propales</h3>
            <span className="ml-auto text-xs text-muted-foreground">{(stats?.proposals ?? []).length}</span>
          </div>
          {(stats?.proposals ?? []).length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground text-center">Aucune propale {periodLabel}</div>
          ) : (
            <div className="divide-y divide-border">
              {(stats?.proposals ?? []).map((p) => (
                <div key={p.name} className="px-4 py-3 flex justify-between items-center">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs font-semibold text-primary">{p.hours}h</div>
                </div>
              ))}
            </div>
          )}
        </div>
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
                    ) : e.transverse_project_id ? (
                      e.transverse_project?.name ?? "—"
                    ) : e.proposal_id ? (
                      e.proposal?.name ?? "—"
                    ) : (
                      e.internal_category ?? "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {e.mission?.nature_mission
                      ?? (e.transverse_project_id ? "Projet transverse" : null)
                      ?? (e.proposal_id ? (e.proposal?.mission_type ?? "Propale") : null)
                      ?? "—"}
                  </td>
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
