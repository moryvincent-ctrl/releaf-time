import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Users, Briefcase, Clock, PieChart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import AppLayout from "@/components/AppLayout";
import KpiCard from "@/components/KpiCard";

const chartData = [
  { name: "M. Dupont", hours: 38 },
  { name: "L. Martin", hours: 35 },
  { name: "S. Bernard", hours: 40 },
  { name: "A. Petit", hours: 32 },
  { name: "C. Moreau", hours: 37 },
  { name: "J. Laurent", hours: 29 },
];

const entries = [
  { consultant: "Marie Dupont", mission: "Bilan Carbone 2025", date: "24/03/2025", hours: 8, role: "Consultant" },
  { consultant: "Marie Dupont", mission: "Plan Climat Lyon", date: "25/03/2025", hours: 7.5, role: "Consultant" },
  { consultant: "Luc Martin", mission: "Audit Biodiversité", date: "24/03/2025", hours: 8, role: "Consultant" },
  { consultant: "Sophie Bernard", mission: "Mobilité Durable", date: "24/03/2025", hours: 8, role: "Chef de projet" },
  { consultant: "Sophie Bernard", mission: "Mobilité Durable", date: "25/03/2025", hours: 8, role: "Chef de projet" },
  { consultant: "Antoine Petit", mission: "Bilan Carbone 2025", date: "26/03/2025", hours: 6.5, role: "Consultant" },
  { consultant: "Claire Moreau", mission: "Plan Climat Lyon", date: "24/03/2025", hours: 7, role: "Manager" },
  { consultant: "Jules Laurent", mission: "Audit Biodiversité", date: "25/03/2025", hours: 5, role: "Consultant" },
];

const AdminDashboard = () => {
  return (
    <AppLayout role="admin">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-heading font-semibold text-primary">Vue globale</h2>
        <Button variant="outline" className="rounded-lg border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground">
          <Download size={16} className="mr-2" /> Exporter CSV
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={<Clock size={18} />} label="Heures ce mois" value="1 248h" />
        <KpiCard icon={<Users size={18} />} label="Consultants actifs" value="14" />
        <KpiCard icon={<Briefcase size={18} />} label="Missions actives" value="23" />
        <KpiCard icon={<PieChart size={18} />} label="% temps client" value="78%" />
      </div>

      {/* Chart */}
      <div className="bg-card rounded-lg border border-border p-5 mb-6">
        <h3 className="label-uppercase mb-4">Heures par consultant cette semaine</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 25%, 91%)" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#1C1C1C" }} />
            <YAxis tick={{ fontSize: 12, fill: "#1C1C1C" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid hsl(150, 25%, 91%)",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            />
            <Bar dataKey="hours" fill="#52B788" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Input placeholder="Filtrer par consultant..." className="max-w-xs bg-card border-input rounded-md" />
          <Input placeholder="Filtrer par mission..." className="max-w-xs bg-card border-input rounded-md" />
          <Input type="date" className="max-w-[180px] bg-card border-input rounded-md" />
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 label-uppercase">Consultant</th>
              <th className="text-left px-4 py-3 label-uppercase">Mission</th>
              <th className="text-left px-4 py-3 label-uppercase">Date</th>
              <th className="text-left px-4 py-3 label-uppercase">Rôle</th>
              <th className="text-right px-4 py-3 label-uppercase">Heures</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                <td className="px-4 py-3 text-sm">{e.consultant}</td>
                <td className="px-4 py-3 text-sm">{e.mission}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{e.date}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{e.role}</td>
                <td className="px-4 py-3 text-sm text-right font-semibold text-primary">{e.hours}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
