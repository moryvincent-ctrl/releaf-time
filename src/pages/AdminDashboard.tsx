import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Users, Briefcase, Clock, PieChart, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import AppLayout from "@/components/AppLayout";
import KpiCard from "@/components/KpiCard";
import { useAdminStats, useAdminEntries } from "@/hooks/useAdminData";
import { format } from "date-fns";

const AdminDashboard = () => {
  const [filterConsultant, setFilterConsultant] = useState("");
  const [filterMission, setFilterMission] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const { data: stats, isLoading: loadingStats } = useAdminStats();
  const { data: entries = [], isLoading: loadingEntries } = useAdminEntries({
    consultant: filterConsultant,
    mission: filterMission,
    date: filterDate,
  });

  return (
    <AppLayout role="admin">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-heading font-semibold text-primary">Vue globale</h2>
        <Button variant="outline" className="rounded-lg border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground">
          <Download size={16} className="mr-2" /> Exporter CSV
        </Button>
      </div>

      {loadingStats ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-secondary" size={24} />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard icon={<Clock size={18} />} label="Heures ce mois" value={`${stats?.totalHours ?? 0}h`} />
          <KpiCard icon={<Users size={18} />} label="Consultants actifs" value={`${stats?.activeConsultants ?? 0}`} />
          <KpiCard icon={<Briefcase size={18} />} label="Missions actives" value={`${stats?.activeMissions ?? 0}`} />
          <KpiCard icon={<PieChart size={18} />} label="% temps client" value={`${stats?.percentClient ?? 0}%`} />
        </div>
      )}

      {/* Graphique semaine */}
      <div className="bg-card rounded-lg border border-border p-5 mb-6">
        <h3 className="label-uppercase mb-4">Heures par consultant cette semaine</h3>
        {(stats?.weekByConsultant ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune saisie cette semaine</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats?.weekByConsultant ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 25%, 91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#1C1C1C" }} />
              <YAxis tick={{ fontSize: 12, fill: "#1C1C1C" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#fff", border: "1px solid hsl(150, 25%, 91%)", borderRadius: "8px", fontSize: "13px" }}
              />
              <Bar dataKey="hours" fill="#52B788" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
                  <td className="px-4 py-3 text-sm">{e.mission?.name ?? e.internal_category ?? "—"}</td>
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
