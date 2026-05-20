import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Plus, MessageSquare, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AppLayout from "@/components/AppLayout";
import {
  useTimeEntries,
  useAssignedMissions,
  useUpsertTimeEntry,
  getWeekStart,
  getWeekDays,
  formatWeekLabel,
} from "@/hooks/useTimeEntries";
import type { InternalCategory } from "@/lib/database.types";
import { toast } from "sonner";

const INTERNAL_CATEGORIES: InternalCategory[] = [
  "Sales / Biz Dev",
  "Administratif",
  "R&D",
  "Structuration interne",
  "Formation",
  "Communication",
];

const DAYS_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];

const POLE_COLORS: Record<string, string> = {
  "Releaf Carbon":       "bg-primary/10 text-primary",
  "Releaf LCA":          "bg-secondary/10 text-secondary",
  "Releaf Energy":       "bg-[hsl(38,80%,50%)]/10 text-[hsl(38,80%,40%)]",
  "Releaf Water":        "bg-[hsl(200,70%,50%)]/10 text-[hsl(200,70%,35%)]",
  "Releaf Biodiversity": "bg-accent text-accent-foreground",
};

type GridCell = { hours: number; comment: string };
type GridState = Record<string, Record<string, GridCell>>;

function buildKey(missionId: string | null, category: string | null) {
  return missionId ? `mission:${missionId}` : `internal:${category}`;
}

const ConsultantView = () => {
  const today = new Date();
  const [weekStart, setWeekStart] = useState(getWeekStart(today));
  const weekDays = getWeekDays(weekStart);

  const { data: entries = [], isLoading: loadingEntries } = useTimeEntries(weekStart);
  const { data: assignedMissions = [], isLoading: loadingMissions } = useAssignedMissions();
  const upsert = useUpsertTimeEntry();

  const [grid, setGrid] = useState<GridState>({});
  const [showComment, setShowComment] = useState<{ key: string; date: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Initialise la grille depuis les entrées Supabase
  useEffect(() => {
    const newGrid: GridState = {};
    for (const entry of entries) {
      const key = buildKey(entry.mission_id, entry.internal_category);
      if (!newGrid[key]) newGrid[key] = {};
      newGrid[key][entry.entry_date] = {
        hours: Number(entry.hours),
        comment: entry.comment ?? "",
      };
    }
    setGrid(newGrid);
  }, [entries]);

  const getCell = (key: string, date: string): GridCell =>
    grid[key]?.[date] ?? { hours: 0, comment: "" };

  const setCell = (key: string, date: string, patch: Partial<GridCell>) => {
    setGrid((prev) => ({
      ...prev,
      [key]: { ...prev[key], [date]: { ...getCell(key, date), ...patch } },
    }));
  };

  const rowTotal = (key: string) =>
    weekDays.reduce((sum, d) => sum + (getCell(key, d).hours || 0), 0);

  const colTotal = (date: string) => {
    const allKeys = [
      ...assignedMissions.map((m: any) => buildKey(m.id, null)),
      ...INTERNAL_CATEGORIES.map((c) => buildKey(null, c)),
    ];
    return allKeys.reduce((sum, k) => sum + (getCell(k, date).hours || 0), 0);
  };

  const grandTotal = weekDays.reduce((sum, d) => sum + colTotal(d), 0);

  const prevWeek = () => {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() - 7);
    setWeekStart(getWeekStart(d));
  };

  const nextWeek = () => {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() + 7);
    setWeekStart(getWeekStart(d));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allRows: { key: string; missionId: string | null; category: InternalCategory | null }[] = [
        ...assignedMissions.map((m: any) => ({ key: buildKey(m.id, null), missionId: m.id, category: null })),
        ...INTERNAL_CATEGORIES.map((c) => ({ key: buildKey(null, c), missionId: null, category: c as InternalCategory })),
      ];

      await Promise.all(
        allRows.flatMap((row) =>
          weekDays.map((date) =>
            upsert.mutateAsync({
              mission_id: row.missionId,
              internal_category: row.category,
              entry_date: date,
              hours: getCell(row.key, date).hours,
              comment: getCell(row.key, date).comment,
              week_start: weekStart,
            })
          )
        )
      );
      toast.success("Feuille de temps sauvegardée");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (key: string, label: string, sublabel?: string, pole?: string) => (
    <tr key={key} className="border-b border-border last:border-b-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-foreground">{label}</span>
          {pole && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${POLE_COLORS[pole] ?? "bg-muted text-muted-foreground"}`}>
              {pole}
            </span>
          )}
        </div>
        {sublabel && <div className="text-xs text-muted-foreground">{sublabel}</div>}
      </td>

      {weekDays.map((date) => {
        const cell = getCell(key, date);
        const isActive = showComment?.key === key && showComment?.date === date;
        return (
          <td key={date} className="text-center px-1 py-2">
            <div className="relative group">
              <Input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={cell.hours || ""}
                onChange={(e) => setCell(key, date, { hours: parseFloat(e.target.value) || 0 })}
                className="w-14 h-8 text-center mx-auto bg-card border-input text-sm rounded-md"
              />
              <button
                onClick={() => setShowComment(isActive ? null : { key, date })}
                className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MessageSquare size={12} className={cell.comment ? "text-secondary" : "text-muted-foreground"} />
              </button>
            </div>
            {isActive && (
              <Input
                value={cell.comment}
                onChange={(e) => setCell(key, date, { comment: e.target.value })}
                placeholder="Commentaire..."
                className="w-28 h-6 text-xs mt-1 mx-auto border-input"
              />
            )}
          </td>
        );
      })}

      <td className="text-center px-3 py-3 font-semibold text-sm text-primary">
        {rowTotal(key)}h
      </td>
    </tr>
  );

  if (loadingEntries || loadingMissions) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-secondary" size={32} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="rounded-lg border-input h-8 w-8" onClick={prevWeek}>
            <ChevronLeft size={16} />
          </Button>
          <h2 className="text-lg font-heading font-semibold text-primary">
            Semaine du {formatWeekLabel(weekStart)}
          </h2>
          <Button variant="outline" size="icon" className="rounded-lg border-input h-8 w-8" onClick={nextWeek}>
            <ChevronRight size={16} />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-lg">
            Total : {grandTotal}h
          </span>
          <Button className="rounded-lg" onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 size={14} className="mr-2 animate-spin" />Sauvegarde…</>
              : "Sauvegarder"
            }
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 label-uppercase w-1/3">Mission / Catégorie</th>
              {DAYS_LABELS.map((d) => (
                <th key={d} className="text-center px-2 py-3 label-uppercase w-16">{d}</th>
              ))}
              <th className="text-center px-3 py-3 label-uppercase w-16">Total</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td colSpan={7} className="px-4 py-2 label-uppercase text-secondary bg-muted/30">
                Missions
              </td>
            </tr>
            {assignedMissions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-sm text-muted-foreground text-center">
                  Aucune mission affectée — contacte ton manager
                </td>
              </tr>
            ) : (
              assignedMissions.map((m: any) =>
                renderRow(buildKey(m.id, null), m.client, m.name, m.pole)
              )
            )}
            <tr>
              <td colSpan={7} className="px-4 py-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground text-xs h-7 px-2 hover:text-secondary"
                  onClick={() => setAddDialogOpen(true)}
                >
                  <Plus size={12} className="mr-1" /> Ajouter une mission
                </Button>
              </td>
            </tr>

            <tr>
              <td colSpan={7} className="px-4 py-2 label-uppercase text-secondary bg-muted/30">
                Temps internes
              </td>
            </tr>
            {INTERNAL_CATEGORIES.map((cat) =>
              renderRow(buildKey(null, cat), cat)
            )}
          </tbody>

          <tfoot>
            <tr className="bg-muted/50">
              <td className="px-4 py-3 font-semibold text-sm text-primary">Total quotidien</td>
              {weekDays.map((date) => (
                <td key={date} className="text-center px-2 py-3 font-semibold text-sm text-primary">
                  {colTotal(date)}h
                </td>
              ))}
              <td className="text-center px-3 py-3 font-bold text-sm text-secondary">
                {grandTotal}h
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajouter une mission</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Les missions disponibles sont celles qui te sont affectées par ton manager.
            Contacte-le pour être ajouté à une mission.
          </p>
          <Button onClick={() => setAddDialogOpen(false)} className="mt-2 w-full">Fermer</Button>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default ConsultantView;
