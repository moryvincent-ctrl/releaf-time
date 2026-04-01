import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import BudgetBar from "@/components/BudgetBar";

const missions = [
  {
    id: 1,
    client: "EcoTech Solutions",
    project: "Bilan Carbone 2025",
    manager: "Claire Moreau",
    startDate: "01/01/2025",
    endDate: "30/06/2025",
    budgetTotal: 120,
    consumed: 78,
    consultants: ["MD", "LM"],
  },
  {
    id: 2,
    client: "Ville de Lyon",
    project: "Plan Climat Territorial",
    manager: "Sophie Bernard",
    startDate: "15/02/2025",
    endDate: "15/09/2025",
    budgetTotal: 200,
    consumed: 185,
    consultants: ["SB", "AP"],
  },
  {
    id: 3,
    client: "AgroVert",
    project: "Audit Biodiversité",
    manager: "Claire Moreau",
    startDate: "01/03/2025",
    endDate: "31/07/2025",
    budgetTotal: 80,
    consumed: 92,
    consultants: ["CM", "JL"],
  },
  {
    id: 4,
    client: "TransportPlus",
    project: "Mobilité Durable",
    manager: "Luc Martin",
    startDate: "10/03/2025",
    endDate: "10/12/2025",
    budgetTotal: 150,
    consumed: 45,
    consultants: ["MD", "LM"],
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
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-heading font-semibold text-primary">{m.client}</div>
                  <div className="text-sm text-muted-foreground">{m.project}</div>
                </div>
                <div className="flex -space-x-2">
                  {m.consultants.map((c, i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-medium border-2 border-card"
                    >
                      {c}
                    </div>
                  ))}
                </div>
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
            </Link>
          );
        })}
      </div>
    </AppLayout>
  );
};

export default Missions;
