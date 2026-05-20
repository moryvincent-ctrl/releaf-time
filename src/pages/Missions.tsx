import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import BudgetBar from "@/components/BudgetBar";
import { useAllMissions } from "@/hooks/useMissionsData";

const poleColors: Record<string, string> = {
  "Releaf Carbon": "bg-primary/10 text-primary",
  "Releaf LCA": "bg-secondary/10 text-secondary",
  "Releaf Energy": "bg-[hsl(38,80%,50%)]/10 text-[hsl(38,80%,40%)]",
  "Releaf Water": "bg-[hsl(200,70%,50%)]/10 text-[hsl(200,70%,35%)]",
  "Releaf Biodiversity": "bg-accent text-accent-foreground",
  "Releaf Campus": "bg-[hsl(270,60%,55%)]/10 text-[hsl(270,60%,45%)]",
};

const Missions = () => {
  const { data: missions = [], isLoading } = useAllMissions();

  if (isLoading) {
    return (
      <AppLayout role="admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-secondary" size={32} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout role="admin">
      <h2 className="text-xl font-heading font-semibold text-primary mb-6">Missions</h2>

      {missions.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center text-muted-foreground">
          Aucune mission — configure la sync Notion dans Settings puis lance-la.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {missions.map((m) => (
            <Link
              key={m.id}
              to={`/missions/${m.id}`}
              className="bg-card rounded-lg border border-border p-5 hover:border-secondary transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-heading font-semibold text-primary">{m.client}</div>
                  <div className="text-sm text-muted-foreground">{m.project}</div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${poleColors[m.pole] || "bg-muted text-muted-foreground"}`}>
                  {m.pole}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-3">
                <div>
                  <span className="label-uppercase block">Manager</span>
                  <span className="text-foreground">{m.manager}</span>
                </div>
                <div>
                  <span className="label-uppercase block">Dates</span>
                  <span className="text-foreground">{m.startDate} — {m.endDate}</span>
                </div>
                <div>
                  <span className="label-uppercase block">Budget</span>
                  <span className="text-foreground">{m.consumed}j / {m.budgetTotal}j</span>
                </div>
              </div>

              <BudgetBar percent={m.percent} />

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-1.5">
                  <span className="label-uppercase">Consultants</span>
                  <div className="flex -space-x-2 ml-1">
                    {m.consultants.map((c, i) => (
                      <div
                        key={i}
                        className="w-7 h-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-medium border-2 border-card"
                        title={c.name}
                      >
                        {c.initials}
                      </div>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {m.consultants.length} consultant{m.consultants.length > 1 ? "s" : ""}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default Missions;
