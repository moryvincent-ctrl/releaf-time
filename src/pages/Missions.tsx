import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import BudgetBar from "@/components/BudgetBar";

const poles = ["Releaf Carbon", "Releaf LCA", "Releaf Energy", "Releaf Water", "Releaf Biodiversity"];

const poleColors: Record<string, string> = {
  "Releaf Carbon": "bg-primary/10 text-primary",
  "Releaf LCA": "bg-secondary/10 text-secondary",
  "Releaf Energy": "bg-[hsl(38,80%,50%)]/10 text-[hsl(38,80%,40%)]",
  "Releaf Water": "bg-[hsl(200,70%,50%)]/10 text-[hsl(200,70%,35%)]",
  "Releaf Biodiversity": "bg-accent text-accent-foreground",
};

const missions = [
  {
    id: 1,
    client: "EcoTech Solutions",
    project: "Bilan Carbone 2025",
    pole: "Releaf Carbon",
    manager: "Claire Moreau",
    startDate: "01/01/2025",
    endDate: "30/06/2025",
    budgetTotal: 120,
    consumed: 78,
    consultants: [
      { initials: "MD", name: "Marie Dupont" },
      { initials: "LM", name: "Luc Martin" },
    ],
  },
  {
    id: 2,
    client: "Ville de Lyon",
    project: "Plan Climat Territorial",
    pole: "Releaf Energy",
    manager: "Sophie Bernard",
    startDate: "15/02/2025",
    endDate: "15/09/2025",
    budgetTotal: 200,
    consumed: 185,
    consultants: [
      { initials: "SB", name: "Sophie Bernard" },
      { initials: "AP", name: "Antoine Petit" },
    ],
  },
  {
    id: 3,
    client: "AgroVert",
    project: "Audit Biodiversité",
    pole: "Releaf Biodiversity",
    manager: "Claire Moreau",
    startDate: "01/03/2025",
    endDate: "31/07/2025",
    budgetTotal: 80,
    consumed: 92,
    consultants: [
      { initials: "CM", name: "Claire Moreau" },
      { initials: "JL", name: "Julie Lambert" },
    ],
  },
  {
    id: 4,
    client: "TransportPlus",
    project: "Mobilité Durable",
    pole: "Releaf LCA",
    manager: "Luc Martin",
    startDate: "10/03/2025",
    endDate: "10/12/2025",
    budgetTotal: 150,
    consumed: 45,
    consultants: [
      { initials: "MD", name: "Marie Dupont" },
      { initials: "LM", name: "Luc Martin" },
    ],
  },
];

const Missions = () => {
  return (
    <AppLayout role="admin">
      <h2 className="text-xl font-heading font-semibold text-primary mb-6">Missions</h2>

      <div className="grid grid-cols-2 gap-4">
        {missions.map((m) => {
          const percent = Math.round((m.consumed / m.budgetTotal) * 100);
          return (
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

              <BudgetBar percent={percent} />

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
          );
        })}
      </div>
    </AppLayout>
  );
};

export default Missions;
