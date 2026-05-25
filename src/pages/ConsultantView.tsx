import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, MessageSquare, Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  useTimeEntries,
  useAssignedMissions,
  useActiveMissions,
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
  "Outils internes",
  "Formation",
  "Communication",
  "Recrutement",
  "Développement SaaS Releaf",
  "Développement site web",
];

const DAYS_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
const MAX_HOURS_PER_DAY = 7;
const MAX_HOURS_PER_WEEK = 35;


type GridCell = { hours: number; comment: string };
type GridState = Record<string, Record<string, GridCell>>;

function buildKey(missionId: string | null, category: string | null) {
  return missionId ? `mission:${missionId}` : `internal:${category}`;
}

const ConsultantView = () => {
  const today = new Date();
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(getWeekStart(today));
  const weekDays = getWeekDays(weekStart);

  const { data: entries = [], isLoading: loadingEntries } = useTimeEntries(weekStart);
  const { data: baseAssignedMissions = [], isLoading: loadingMissions } = useAssignedMissions();
  const { data: allActiveMissions = [] } = useActiveMissions();
  const upsert = useUpsertTimeEntry();

  const [grid, setGrid] = useState<GridState>({});
  const [showComment, setShowComment] = useState<{ key: string; date: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Missions ajoutées ponctuellement (état local pour la session courante)
  const [extraMissionIds, setExtraMissionIds] = useState<Set<string>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Combine missions assignées + missions ponctuelles ajoutées
  const assignedMissions = useMemo(() => {
    const byId = new Map<string, any>();
    for (const m of baseAssignedMissions) byId.set(m.id, m);
    for (const id of extraMissionIds) {
      if (!byId.has(id)) {
        const m = allActiveMissions.find((x: any) => x.id === id);
        if (m) byId.set(id, m);
      }
    }
    return Array.from(byId.values());
  }, [baseAssignedMissions, extraMissionIds, allActiveMissions]);

  // Missions disponibles à l'ajout (actives, non encore dans la grille)
  const availableMissions = useMemo(() => {
    const usedIds = new Set(assignedMissions.map((m: any) => m.id));
    const q = search.trim().toLowerCase();
    return allActiveMissions
      .filter((m: any) => !usedIds.has(m.id))
      .filter((m: any) => {
        if (!q) return true;
        return (
          (m.client ?? "").toLowerCase().includes(q) ||
          (m.name ?? "").toLowerCase().includes(q) ||
          (m.nature_mission ?? "").toLowerCase().includes(q)
        );
      });
  }, [assignedMissions, allActiveMissions, search]);

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
    setDirty(false);
  }, [entries]);

  const getCell = (key: string, date: string): GridCell =>
    grid[key]?.[date] ?? { hours: 0, comment: "" };

  const setCell = (key: string, date: string, patch: Partial<GridCell>) => {
    setGrid((prev) => ({
      ...prev,
      [key]: { ...prev[key], [date]: { ...getCell(key, date), ...patch } },
    }));
    setDirty(true);
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

  const saveGrid = async (opts: { silent?: boolean } = {}) => {
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
      // Marque la sauvegarde (utilisé par le rappel email hebdo)
      if (user?.id) {
        await supabase
          .from("profiles")
          .update({ last_save_at: new Date().toISOString() })
          .eq("id", user.id);
      }
      setDirty(false);
      if (!opts.silent) toast.success("Feuille de temps sauvegardée");
      return true;
    } catch {
      toast.error("Erreur lors de la sauvegarde");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => saveGrid();

  const changeWeek = async (deltaDays: number) => {
    if (dirty) {
      const ok = await saveGrid({ silent: true });
      if (!ok) return; // En cas d'erreur, on reste sur la semaine courante pour ne pas perdre les saisies
    }
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() + deltaDays);
    setWeekStart(getWeekStart(d));
  };

  const prevWeek = () => changeWeek(-7);
  const nextWeek = () => changeWeek(7);

  const renderRow = (key: string, name: string, client?: string, nature?: string, pole?: string) => (
    <tr key={key} className="border-b border-border last:border-b-0">
      <td className="px-4 py-3">
        <div className="font-semibold text-sm text-foreground">{name}</div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {client && <span className="text-xs text-muted-foreground">{client}</span>}
          {nature && client && <span className="text-xs text-muted-foreground">·</span>}
          {nature && <span className="text-xs font-medium text-secondary">{nature}</span>}
          {pole && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{pole}</span>}
        </div>
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
                max={MAX_HOURS_PER_DAY}
                step={0.5}
                value={cell.hours || ""}
                onChange={(e) => {
                  const raw = parseFloat(e.target.value) || 0;
                  const othersOnDay = colTotal(date) - cell.hours;
                  const allowed = Math.max(0, MAX_HOURS_PER_DAY - othersOnDay);
                  const clamped = Math.min(Math.max(raw, 0), allowed);
                  if (raw > allowed && allowed > 0) {
                    toast.warning(`Plafond ${MAX_HOURS_PER_DAY}h/jour : il reste ${allowed}h sur cette journée`);
                  }
                  setCell(key, date, { hours: clamped });
                }}
                className="w-20 h-8 text-center mx-auto bg-card border-input text-sm rounded-md"
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
      <h2 className="text-xl font-heading font-semibold text-primary mb-4">Mes temps passés</h2>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="rounded-lg border-input h-8 w-8" onClick={prevWeek} disabled={saving}>
            <ChevronLeft size={16} />
          </Button>
          <h3 className="text-lg font-heading font-semibold text-primary text-center w-80">
            Semaine du {formatWeekLabel(weekStart)}
          </h3>
          <Button variant="outline" size="icon" className="rounded-lg border-input h-8 w-8" onClick={nextWeek} disabled={saving}>
            <ChevronRight size={16} />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium px-4 py-2 rounded-lg ${grandTotal >= MAX_HOURS_PER_WEEK ? "bg-secondary text-secondary-foreground" : "bg-accent text-accent-foreground"}`}>
            Total : {grandTotal}h / {MAX_HOURS_PER_WEEK}h
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
              <th className="text-left px-4 py-3 text-base font-semibold uppercase tracking-wide text-primary w-1/3">Mission / Catégorie</th>
              {DAYS_LABELS.map((d, i) => {
                const date = new Date(weekDays[i] + "T12:00:00");
                const dayNum = date.getDate();
                const monthShort = date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
                return (
                  <th key={d} className="text-center px-2 py-3 text-base font-semibold uppercase tracking-wide text-primary w-20">
                    <div>{d}</div>
                    <div className="text-xs font-normal normal-case tracking-normal text-muted-foreground mt-0.5">
                      {dayNum} {monthShort}
                    </div>
                  </th>
                );
              })}
              <th className="text-center px-3 py-3 text-base font-semibold uppercase tracking-wide text-primary w-16">Total</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td colSpan={7} className="px-4 py-3 text-base font-heading font-semibold text-secondary bg-muted/30">
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
                renderRow(buildKey(m.id, null), m.name, m.client, m.nature_mission, m.pole)
              )
            )}
            <tr>
              <td colSpan={7} className="px-4 py-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground text-xs h-7 px-2 hover:text-secondary"
                  onClick={() => { setSearch(""); setAddDialogOpen(true); }}
                >
                  <Plus size={12} className="mr-1" /> Ajouter une mission ponctuelle
                </Button>
              </td>
            </tr>
            <tr>
              <td colSpan={7} className="px-4 py-3 text-base font-heading font-semibold text-secondary bg-muted/30">
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
              {weekDays.map((date) => {
                const total = colTotal(date);
                const isFull = total >= MAX_HOURS_PER_DAY;
                return (
                  <td key={date} className={`text-center px-2 py-3 font-semibold text-sm ${isFull ? "text-secondary" : "text-primary"}`}>
                    {total}h / {MAX_HOURS_PER_DAY}h
                  </td>
                );
              })}
              <td className={`text-center px-3 py-3 font-bold text-sm ${grandTotal >= MAX_HOURS_PER_WEEK ? "text-secondary" : "text-primary"}`}>
                {grandTotal}h / {MAX_HOURS_PER_WEEK}h
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter une mission ponctuelle</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Sélectionne une mission en cours sur laquelle tu n'es pas staffé pour pouvoir saisir du temps dessus. Elle restera sur ta grille tant qu'elle contient au moins une saisie.
          </p>
          <Input
            autoFocus
            placeholder="Rechercher par client, projet ou nature…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-2"
          />
          <div className="max-h-72 overflow-auto border border-border rounded-md divide-y divide-border">
            {availableMissions.length === 0 ? (
              <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                Aucune mission disponible.
              </div>
            ) : (
              availableMissions.map((m: any) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setExtraMissionIds((prev) => new Set(prev).add(m.id));
                    setAddDialogOpen(false);
                    toast.success(`"${m.client}" ajoutée à la grille`);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-muted/40 transition-colors"
                >
                  <div className="text-sm font-medium text-foreground">{m.client}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.name}{m.nature_mission ? ` · ${m.nature_mission}` : ""}
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default ConsultantView;
