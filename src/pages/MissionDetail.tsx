import { useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppLayout from "@/components/AppLayout";
import BudgetBar from "@/components/BudgetBar";

const poleColors: Record<string, string> = {
  "Releaf Carbon": "bg-primary/10 text-primary",
  "Releaf LCA": "bg-secondary/10 text-secondary",
  "Releaf Energy": "bg-[hsl(38,80%,50%)]/10 text-[hsl(38,80%,40%)]",
  "Releaf Water": "bg-[hsl(200,70%,50%)]/10 text-[hsl(200,70%,35%)]",
  "Releaf Biodiversity": "bg-accent text-accent-foreground",
};

const missionData: Record<string, any> = {
  "1": {
    client: "EcoTech Solutions",
    project: "Bilan Carbone 2025",
    pole: "Releaf Carbon",
    manager: "Claire Moreau",
    startDate: "01/01/2025",
    endDate: "30/06/2025",
    status: "En cours",
    budgetTotal: 120,
    consumed: 78,
    consultants: [
      { name: "Marie Dupont", initials: "MD", hours: 38, budget: 60, consumed: 38 },
      { name: "Luc Martin", initials: "LM", hours: 40, budget: 60, consumed: 40 },
    ],
    entries: [
      { date: "24/03/2025", consultant: "Marie Dupont", hours: 8, comment: "Collecte données" },
      { date: "25/03/2025", consultant: "Marie Dupont", hours: 7.5, comment: "Analyse scope 1" },
      { date: "24/03/2025", consultant: "Luc Martin", hours: 8, comment: "Entretiens fournisseurs" },
      { date: "25/03/2025", consultant: "Luc Martin", hours: 7, comment: "" },
    ],
  },
};

const MissionDetail = () => {
  const { id } = useParams();
  const mission = missionData[id || "1"] || missionData["1"];
  const percent = Math.round((mission.consumed / mission.budgetTotal) * 100);

  return (
    <AppLayout role="admin">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-xl font-heading font-semibold text-primary">{mission.client}</h2>
          <span className="bg-accent text-accent-foreground text-xs font-medium px-2.5 py-1 rounded">
            {mission.status}
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
            {mission.consultants.map((c: any, i: number) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-medium border-2 border-card"
                title={c.name}
              >
                {c.initials}
              </div>
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-1">
            {mission.consultants.map((c: any) => c.name).join(", ")}
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
                  {mission.budgetTotal - mission.consumed}j
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
                🔴 Budget dépassé de {mission.consumed - mission.budgetTotal}j
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="consultants">
          <div className="bg-card rounded-lg border border-border overflow-hidden">
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
                {mission.consultants.map((c: any, i: number) => {
                  const cp = Math.round((c.consumed / c.budget) * 100);
                  return (
                    <tr key={i} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3 text-sm font-medium flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-medium">
                          {c.initials}
                        </div>
                        {c.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-primary">{c.hours}h</td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">{c.budget}j</td>
                      <td className="px-4 py-3 text-sm text-right">{cp}%</td>
                      <td className="px-4 py-3"><BudgetBar percent={cp} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="bg-card rounded-lg border border-border overflow-hidden">
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
                {mission.entries.map((e: any, i: number) => (
                  <tr key={i} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 text-sm text-muted-foreground">{e.date}</td>
                    <td className="px-4 py-3 text-sm">{e.consultant}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-primary">{e.hours}h</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{e.comment || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default MissionDetail;
