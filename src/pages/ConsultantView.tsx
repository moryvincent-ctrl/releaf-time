import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Plus, MessageSquare } from "lucide-react";
import AppLayout from "@/components/AppLayout";

const initialMissions = [
  { client: "EcoTech Solutions", project: "Bilan Carbone 2025", type: "mission" as const },
  { client: "Ville de Lyon", project: "Plan Climat Territorial", type: "mission" as const },
  { client: "AgroVert", project: "Audit Biodiversité", type: "mission" as const },
  { client: "TransportPlus", project: "Mobilité Durable", type: "mission" as const },
];

const internalCategories = [
  "Sales / Biz Dev",
  "Administratif",
  "R&D",
  "Structuration interne",
  "Formation",
  "Communication",
];

const days = ["Lun", "Mar", "Mer", "Jeu", "Ven"];

type Row = { label: string; sublabel?: string; type: "mission" | "internal" };

const ConsultantView = () => {
  const [rows, setRows] = useState<Row[]>([
    ...initialMissions.map((m) => ({ label: m.client, sublabel: m.project, type: "mission" as const })),
    ...internalCategories.map((c) => ({ label: c, type: "internal" as const })),
  ]);

  const [hours, setHours] = useState<number[][]>(rows.map(() => [0, 0, 0, 0, 0]));
  const [comments, setComments] = useState<string[][]>(rows.map(() => ["", "", "", "", ""]));
  const [showComment, setShowComment] = useState<{ row: number; col: number } | null>(null);

  const updateHour = (row: number, col: number, val: string) => {
    const num = val === "" ? 0 : parseFloat(val);
    if (isNaN(num)) return;
    setHours((prev) => {
      const copy = prev.map((r) => [...r]);
      copy[row][col] = num;
      return copy;
    });
  };

  const updateComment = (row: number, col: number, val: string) => {
    setComments((prev) => {
      const copy = prev.map((r) => [...r]);
      copy[row][col] = val;
      return copy;
    });
  };

  const rowTotal = (row: number) => hours[row].reduce((a, b) => a + b, 0);
  const colTotal = (col: number) => hours.reduce((a, r) => a + r[col], 0);
  const grandTotal = hours.reduce((a, r) => a + r.reduce((b, c) => b + c, 0), 0);

  const missionRows = rows.filter((r) => r.type === "mission");
  const internalRows = rows.filter((r) => r.type === "internal");

  const getRowIndex = (row: Row) => rows.indexOf(row);

  const renderRow = (row: Row) => {
    const ri = getRowIndex(row);
    return (
      <tr key={ri} className="border-b border-border last:border-b-0">
        <td className="px-4 py-3">
          <div className="font-medium text-sm text-foreground">{row.label}</div>
          {row.sublabel && <div className="text-xs text-muted-foreground">{row.sublabel}</div>}
        </td>
        {days.map((_, ci) => (
          <td key={ci} className="text-center px-1 py-2">
            <div className="relative group">
              <Input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={hours[ri][ci] || ""}
                onChange={(e) => updateHour(ri, ci, e.target.value)}
                className="w-14 h-8 text-center mx-auto bg-card border-input text-sm rounded-md"
              />
              <button
                onClick={() => setShowComment(showComment?.row === ri && showComment?.col === ci ? null : { row: ri, col: ci })}
                className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MessageSquare size={12} className={comments[ri][ci] ? "text-secondary" : "text-muted-foreground"} />
              </button>
            </div>
            {showComment?.row === ri && showComment?.col === ci && (
              <Input
                value={comments[ri][ci]}
                onChange={(e) => updateComment(ri, ci, e.target.value)}
                placeholder="Commentaire..."
                className="w-28 h-6 text-xs mt-1 mx-auto border-input"
              />
            )}
          </td>
        ))}
        <td className="text-center px-3 py-3 font-semibold text-sm text-primary">
          {rowTotal(ri)}h
        </td>
      </tr>
    );
  };

  return (
    <AppLayout role="consultant">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="rounded-lg border-input h-8 w-8">
            <ChevronLeft size={16} />
          </Button>
          <h2 className="text-lg font-heading font-semibold text-primary">
            Semaine du 24 au 28 mars 2025
          </h2>
          <Button variant="outline" size="icon" className="rounded-lg border-input h-8 w-8">
            <ChevronRight size={16} />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-lg">
            Total : {grandTotal}h
          </span>
          <Button className="rounded-lg">Sauvegarder</Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 label-uppercase w-1/3">Mission / Catégorie</th>
              {days.map((d) => (
                <th key={d} className="text-center px-2 py-3 label-uppercase w-16">{d}</th>
              ))}
              <th className="text-center px-3 py-3 label-uppercase w-16">Total</th>
            </tr>
          </thead>
          <tbody>
            {/* Mission rows */}
            {missionRows.length > 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-2 label-uppercase text-secondary bg-muted/30">
                  Missions
                </td>
              </tr>
            )}
            {missionRows.map(renderRow)}

            {/* Internal rows */}
            {internalRows.length > 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-2 label-uppercase text-secondary bg-muted/30">
                  Temps internes
                </td>
              </tr>
            )}
            {internalRows.map(renderRow)}
          </tbody>
          <tfoot>
            <tr className="bg-muted/50">
              <td className="px-4 py-3 font-semibold text-sm text-primary">Total quotidien</td>
              {days.map((_, ci) => (
                <td key={ci} className="text-center px-2 py-3 font-semibold text-sm text-primary">
                  {colTotal(ci)}h
                </td>
              ))}
              <td className="text-center px-3 py-3 font-bold text-sm text-secondary">
                {grandTotal}h
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3">
        <Button variant="ghost" size="sm" className="text-muted-foreground text-xs">
          <Plus size={14} className="mr-1" /> Ajouter une ligne
        </Button>
      </div>
    </AppLayout>
  );
};

export default ConsultantView;
