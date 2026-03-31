import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AppLayout from "@/components/AppLayout";

const missions = [
  { client: "EcoTech Solutions", project: "Bilan Carbone 2025" },
  { client: "Ville de Lyon", project: "Plan Climat Territorial" },
  { client: "AgroVert", project: "Audit Biodiversité" },
  { client: "TransportPlus", project: "Mobilité Durable" },
];

const days = ["Lun", "Mar", "Mer", "Jeu", "Ven"];

const ConsultantView = () => {
  const [hours, setHours] = useState<number[][]>(
    missions.map(() => [0, 0, 0, 0, 0])
  );

  const updateHour = (row: number, col: number, val: string) => {
    const num = val === "" ? 0 : parseFloat(val);
    if (isNaN(num)) return;
    setHours((prev) => {
      const copy = prev.map((r) => [...r]);
      copy[row][col] = num;
      return copy;
    });
  };

  const rowTotal = (row: number) => hours[row].reduce((a, b) => a + b, 0);
  const colTotal = (col: number) => hours.reduce((a, r) => a + r[col], 0);
  const grandTotal = hours.reduce((a, r) => a + r.reduce((b, c) => b + c, 0), 0);

  return (
    <AppLayout active="temps">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="rounded-lg border-input">
            <ChevronLeft size={18} />
          </Button>
          <h2 className="text-lg font-heading font-semibold text-primary">
            Semaine du 24 au 28 mars 2025
          </h2>
          <Button variant="outline" size="icon" className="rounded-lg border-input">
            <ChevronRight size={18} />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="bg-muted text-muted-foreground text-sm font-medium px-4 py-2 rounded-lg">
            Total : {grandTotal}h
          </span>
          <Button className="rounded-lg">Sauvegarder</Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 label-uppercase w-1/3">Mission</th>
              {days.map((d) => (
                <th key={d} className="text-center px-3 py-3 label-uppercase w-20">
                  {d}
                </th>
              ))}
              <th className="text-center px-3 py-3 label-uppercase w-20">Total</th>
            </tr>
          </thead>
          <tbody>
            {missions.map((m, ri) => (
              <tr key={ri} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-sm text-foreground">{m.client}</div>
                  <div className="text-xs text-muted-foreground">{m.project}</div>
                </td>
                {days.map((_, ci) => (
                  <td key={ci} className="text-center px-2 py-2">
                    <Input
                      type="number"
                      min={0}
                      max={24}
                      step={0.5}
                      value={hours[ri][ci] || ""}
                      onChange={(e) => updateHour(ri, ci, e.target.value)}
                      className="w-16 h-9 text-center mx-auto bg-card border-input text-sm rounded-md"
                    />
                  </td>
                ))}
                <td className="text-center px-3 py-3 font-semibold text-sm text-primary">
                  {rowTotal(ri)}h
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/50">
              <td className="px-4 py-3 font-semibold text-sm text-primary">Total quotidien</td>
              {days.map((_, ci) => (
                <td key={ci} className="text-center px-3 py-3 font-semibold text-sm text-primary">
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
    </AppLayout>
  );
};

export default ConsultantView;
