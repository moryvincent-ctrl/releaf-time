import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Loader2, LayoutGrid, BarChart3, Users, X, Check, Eye, EyeOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import AppLayout from "@/components/AppLayout";
import {
  useStaffingProfiles,
  useStaffableMissions,
  useStaffableTransverse,
  useStaffingAllocations,
  useUpsertStaffingAllocation,
  useCreateManualMission,
  usePayfitAbsences,
  monthStart,
  addMonths,
  monthWindow,
  formatMonthLabel,
  businessDaysInMonth,
  absenceBusinessDaysInMonth,
} from "@/hooks/useStaffing";
import type { MissionPole } from "@/lib/database.types";
import { toast } from "sonner";

const POLES: MissionPole[] = [
  "Releaf Carbon",
  "Releaf LCA",
  "Releaf Energy",
  "Releaf Water",
  "Releaf Biodiversity",
  "Releaf Campus",
];

const MAX_DAYS_PER_CELL = 31;

// Anciens collaborateurs à exclure du staffing prévisionnel (ont quitté l'entreprise).
const norm = (s: string) => (s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
const DEPARTED = new Set(["hugo astier", "juliette blanc"]);

const missionTarget = (id: string) => `mission:${id}`;
const transverseTarget = (id: string) => `transverse:${id}`;
const cellKey = (target: string, month: string, userId: string) => `${target}|${month}|${userId}`;

function parseTarget(target: string): { mission_id: string | null; transverse_project_id: string | null } {
  const i = target.indexOf(":");
  const type = target.slice(0, i);
  const id = target.slice(i + 1);
  return type === "mission"
    ? { mission_id: id, transverse_project_id: null }
    : { mission_id: null, transverse_project_id: id };
}

const firstName = (full: string) => (full ?? "").trim().split(/\s+/)[0] || (full ?? "");

// Cellule de saisie de jours. État de texte local pour que les re-renders de la
// grille n'écrasent pas la frappe en cours (sinon impossible de dépasser le 1er
// incrément). La valeur (plafonnée) est remontée au parent via onCommit.
function DayCell({ value, max, onCommit }: { value: number; max: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(value ? String(value) : "");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value ? String(value) : "");
  }, [value, focused]);

  return (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      max={max}
      step={0.5}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        setText(e.target.value);
        onCommit(parseFloat(e.target.value) || 0);
      }}
      onBlur={() => setFocused(false)}
      className="w-11 h-7 text-center mx-auto bg-card border-input text-xs rounded px-0"
    />
  );
}

const StaffingView = () => {
  const today = new Date();
  const [monthsCount, setMonthsCount] = useState(3);
  const [startMonth, setStartMonth] = useState(monthStart(today));
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [customStart, setCustomStart] = useState(monthStart(today).slice(0, 7));
  const [customEnd, setCustomEnd] = useState(addMonths(monthStart(today), 2).slice(0, 7));
  const months = useMemo(() => {
    if (mode === "custom") {
      const start = customStart + "-01";
      let end = customEnd + "-01";
      if (end < start) end = start;
      const out: string[] = [];
      let m = start;
      while (m <= end && out.length < 12) {
        out.push(m);
        m = addMonths(m, 1);
      }
      return out.length ? out : [start];
    }
    return monthWindow(startMonth, monthsCount);
  }, [mode, customStart, customEnd, startMonth, monthsCount]);
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];

  const { data: profiles = [] } = useStaffingProfiles();
  const { data: missions = [] } = useStaffableMissions();
  const { data: transverse = [] } = useStaffableTransverse();
  const { data: allocations = [], isLoading } = useStaffingAllocations(firstMonth, lastMonth);
  const { data: absences = [] } = usePayfitAbsences(firstMonth, lastMonth);

  const upsert = useUpsertStaffingAllocation();
  const createMission = useCreateManualMission();

  // grille éditable : cellKey -> jours
  const [grid, setGrid] = useState<Record<string, number>>({});
  const [baseline, setBaseline] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [newMission, setNewMission] = useState({ name: "", client: "", pole: POLES[0], status: "active" as "active" | "on_hold" });
  const [view, setView] = useState<"grid" | "recap">("grid");

  // Refs pour l'auto-sauvegarde (toujours à jour, sans relancer les effets)
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Personnes (colonnes) — toutes typologies, ordre stable ──────────────────
  const people = useMemo(
    () =>
      [...profiles]
        .filter((p: any) => !DEPARTED.has(norm(p.full_name)))
        .sort((a: any, b: any) => (a.full_name ?? "").localeCompare(b.full_name ?? "")),
    [profiles]
  );

  // Collaborateurs masqués (colonnes retirées du tableau pour alléger la vue)
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visiblePeople = useMemo(() => people.filter((p: any) => !hidden.has(p.id)), [people, hidden]);
  const toggleHidden = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const showAllPeople = () => setHidden(new Set());

  // ─── Cibles (lignes) — Missions d'abord (en cours + en attente), puis transverses ─
  // Au sein de chaque section : "En cours" en tête (ordre alpha), "En attente" en bas (ordre alpha).
  const sortStatusThenName = (getName: (x: any) => string) => (a: any, b: any) => {
    const aHold = a.status === "on_hold" ? 1 : 0;
    const bHold = b.status === "on_hold" ? 1 : 0;
    if (aHold !== bHold) return aHold - bHold;
    return (getName(a) ?? "").localeCompare(getName(b) ?? "");
  };
  const missionTargets = useMemo(
    () =>
      [...missions]
        .sort(sortStatusThenName((m) => m.client))
        .map((m: any) => ({ key: missionTarget(m.id), title: m.client, subtitle: m.name, onHold: m.status === "on_hold" })),
    [missions]
  );
  const transverseTargets = useMemo(
    () =>
      [...transverse]
        .sort(sortStatusThenName((t) => t.name))
        .map((t: any) => ({ key: transverseTarget(t.id), title: t.name, subtitle: "Projet transverse", onHold: t.status === "on_hold" })),
    [transverse]
  );
  const targets = useMemo(() => [...missionTargets, ...transverseTargets], [missionTargets, transverseTargets]);

  // Masquage des cibles "en attente" (on_hold) pour alléger la vue
  const [hideOnHold, setHideOnHold] = useState(false);
  const visibleMissionTargets = useMemo(
    () => (hideOnHold ? missionTargets.filter((t) => !t.onHold) : missionTargets),
    [missionTargets, hideOnHold]
  );
  const visibleTransverseTargets = useMemo(
    () => (hideOnHold ? transverseTargets.filter((t) => !t.onHold) : transverseTargets),
    [transverseTargets, hideOnHold]
  );

  // ─── Init grille depuis les allocations ──────────────────────────────────────
  useEffect(() => {
    // Ne pas écraser une saisie en cours non encore persistée (auto-save asynchrone)
    if (dirtyRef.current) return;
    const g: Record<string, number> = {};
    for (const a of allocations as any[]) {
      const target = a.mission_id ? missionTarget(a.mission_id) : transverseTarget(a.transverse_project_id);
      g[cellKey(target, a.month, a.user_id)] = Number(a.planned_days);
    }
    setGrid(g);
    setBaseline({ ...g });
    setDirty(false);
  }, [allocations]);

  const getCell = (target: string, month: string, userId: string) => grid[cellKey(target, month, userId)] ?? 0;
  const setCellValue = (target: string, month: string, userId: string, days: number) => {
    setGrid((prev) => ({ ...prev, [cellKey(target, month, userId)]: days }));
    setDirty(true);
  };

  const rowTotal = (target: string) =>
    months.reduce((s, m) => s + visiblePeople.reduce((s2, p: any) => s2 + getCell(target, m, p.id), 0), 0);

  // Charge d'une personne sur un mois = somme sur toutes les cibles
  const colLoad = (month: string, userId: string) =>
    targets.reduce((s, t) => s + getCell(t.key, month, userId), 0);

  // Charge d'une personne sur un mois, restreinte à un sous-ensemble de cibles
  const subsetColLoad = (subset: { key: string }[], month: string, userId: string) =>
    subset.reduce((s, t) => s + getCell(t.key, month, userId), 0);

  // ─── Congés Payfit : jours par (personne, mois) ──────────────────────────────
  const congesByUserMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of absences as any[]) {
      if (!a.user_id || !a.begin_date || !a.end_date) continue;
      for (const m of months) {
        const d = absenceBusinessDaysInMonth(a.begin_date, a.end_date, m);
        if (d > 0) {
          const k = `${a.user_id}|${m}`;
          map[k] = (map[k] ?? 0) + d;
        }
      }
    }
    return map;
  }, [absences, months]);

  const congesFor = (userId: string, month: string) => congesByUserMonth[`${userId}|${month}`] ?? 0;

  // Capacité réellement disponible = jours ouvrés − congés (plancher à 0)
  const effectiveCapacity = (month: string, userId: string) =>
    Math.max(0, businessDaysInMonth(month) - congesFor(userId, month));

  // ─── Données du récapitulatif (sur la fenêtre courante) ──────────────────────
  const capacityWindow = useMemo(() => months.reduce((s, m) => s + businessDaysInMonth(m), 0), [months]);

  const recapData = useMemo(
    () =>
      people.map((p: any) => {
        const sumOver = (subset: { key: string }[]) =>
          subset.reduce((s, t) => s + months.reduce((s2, m) => s2 + getCell(t.key, m, p.id), 0), 0);
        const client = sumOver(missionTargets);
        const transverse = sumOver(transverseTargets);
        const conges = months.reduce((s, m) => s + congesFor(p.id, m), 0);
        const staffed = client + transverse;
        const free = Math.max(0, capacityWindow - conges - staffed);
        return { p, client, transverse, conges, staffed, free, capacity: capacityWindow };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, missionTargets, transverseTargets, months, grid, capacityWindow, congesByUserMonth]
  );

  // Qui est staffé sur quoi — uniquement les cibles ayant au moins une saisie
  const staffedList = useMemo(() => {
    const build = (subset: { key: string; title: string; subtitle: string; onHold: boolean }[]) =>
      subset
        .map((t) => {
          const ppl = people
            .map((p: any) => ({
              name: firstName(p.full_name),
              role: p.role,
              days: months.reduce((s, m) => s + getCell(t.key, m, p.id), 0),
            }))
            .filter((x) => x.days > 0)
            .sort((a, b) => b.days - a.days);
          return { t, ppl, total: ppl.reduce((s, x) => s + x.days, 0) };
        })
        .filter((x) => x.total > 0);
    return { missions: build(missionTargets), transverse: build(transverseTargets) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionTargets, transverseTargets, people, months, grid]);

  // Saisie d'une cellule, plafonnée pour que la charge mensuelle ≤ jours ouvrés du mois
  const handleCellChange = (target: string, month: string, userId: string, p: any, raw: number) => {
    const capacity = effectiveCapacity(month, userId);
    const others = colLoad(month, userId) - getCell(target, month, userId);
    const allowed = Math.max(0, Math.min(capacity - others, MAX_DAYS_PER_CELL));
    const clamped = Math.min(Math.max(raw, 0), allowed);
    if (raw > allowed) {
      const conges = congesFor(userId, month);
      toast.warning(
        `Dispo ${capacity}j pour ${firstName(p.full_name)} en ${formatMonthLabel(month)}${conges ? ` (− ${conges}j congés)` : ""} : il reste ${allowed}j`
      );
    }
    setCellValue(target, month, userId, clamped);
  };

  // ─── Sauvegarde (manuelle + auto) ────────────────────────────────────────────
  const saveGrid = async (opts: { silent?: boolean } = {}) => {
    const snapshot = grid; // capture l'état au moment de l'appel (objet immuable)
    const ops: Promise<any>[] = [];
    for (const t of targets) {
      const { mission_id, transverse_project_id } = parseTarget(t.key);
      for (const month of months) {
        for (const p of people as any[]) {
          const k = cellKey(t.key, month, p.id);
          const cur = snapshot[k] ?? 0;
          const base = baseline[k] ?? 0;
          if (cur === base) continue;
          ops.push(
            upsert.mutateAsync({ user_id: p.id, mission_id, transverse_project_id, month, planned_days: cur })
          );
        }
      }
    }
    if (ops.length === 0) return true; // rien à sauvegarder
    setSaving(true);
    try {
      await Promise.all(ops);
      setBaseline(snapshot);
      // Encore "dirty" si l'utilisateur a saisi pendant la sauvegarde (nouvel objet grid)
      setDirty(gridRef.current !== snapshot);
      if (!opts.silent) toast.success("Planning sauvegardé");
      return true;
    } catch (err: any) {
      console.error("Erreur sauvegarde staffing :", err);
      toast.error(err?.message ? `Erreur : ${err.message}` : "Erreur lors de la sauvegarde");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Auto-sauvegarde débouncée à chaque modification de la grille
  useEffect(() => {
    if (!dirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveGrid({ silent: true }), 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, dirty]);

  const changeWindow = async (deltaMonths: number) => {
    const ok = await saveGrid({ silent: true });
    if (!ok) return;
    setStartMonth(addMonths(startMonth, deltaMonths));
  };

  const switchView = (next: "grid" | "recap") => {
    if (next === "recap") saveGrid({ silent: true }); // persiste avant de basculer
    setView(next);
  };

  const selectPreset = (n: number) => {
    saveGrid({ silent: true });
    setMode("preset");
    setMonthsCount(n);
  };
  const selectCustom = () => {
    saveGrid({ silent: true });
    setMode("custom");
  };
  const changeCustom = (which: "start" | "end", val: string) => {
    if (!val) return;
    saveGrid({ silent: true });
    if (which === "start") setCustomStart(val);
    else setCustomEnd(val);
  };

  const handleCreateMission = async () => {
    if (!newMission.name.trim() || !newMission.client.trim()) {
      toast.error("Nom et client sont obligatoires");
      return;
    }
    try {
      const m: any = await createMission.mutateAsync({
        name: newMission.name.trim(),
        client: newMission.client.trim(),
        pole: newMission.pole,
        status: newMission.status,
      });
      setNewMission({ name: "", client: "", pole: POLES[0], status: "active" });
      setAddOpen(false);
      toast.success(`Mission "${m.client}" créée`);
    } catch (err: any) {
      toast.error(err?.message ? `Erreur : ${err.message}` : "Erreur lors de la création");
    }
  };

  const monthBorder = (personIndex: number) => (personIndex === 0 ? "border-l-2 border-border" : "");
  const totalCols = 2 + months.length * visiblePeople.length;

  // ─── Rendu d'une ligne cible ─────────────────────────────────────────────────
  const renderTargetRow = (t: { key: string; title: string; subtitle: string; onHold: boolean }) => (
    <tr key={t.key} className="border-b border-border last:border-b-0 hover:bg-muted/20">
      <td className="sticky left-0 z-10 bg-card px-4 py-2 border-r border-border min-w-[200px]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{t.title}</span>
          {t.onHold && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">En attente</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate max-w-[220px]">{t.subtitle}</div>
      </td>
      {months.map((m) =>
        visiblePeople.map((p: any, pi: number) => (
          <td key={m + p.id} className={`p-0.5 ${monthBorder(pi)}`}>
            <DayCell
              value={getCell(t.key, m, p.id)}
              max={MAX_DAYS_PER_CELL}
              onCommit={(v) => handleCellChange(t.key, m, p.id, p, v)}
            />
          </td>
        ))
      )}
      <td className="text-center px-2 py-2 font-semibold text-sm text-primary border-l border-border">
        {Math.round(rowTotal(t.key) * 10) / 10}
      </td>
    </tr>
  );

  const sectionHeader = (label: string) => (
    <tr className="bg-muted">
      <td colSpan={totalCols} className="p-0 bg-muted">
        <div className="sticky left-0 w-fit px-4 py-2 text-sm font-heading font-semibold text-secondary">{label}</div>
      </td>
    </tr>
  );

  const emptyNote = (text: string) => (
    <tr className="border-b border-border">
      <td colSpan={totalCols} className="p-0">
        <div className="sticky left-0 w-fit px-4 py-3 text-xs text-muted-foreground">{text}</div>
      </td>
    </tr>
  );

  // Sous-total jours / personne pour un sous-ensemble de cibles (missions ou transverses)
  const sectionSubtotalRow = (label: string, subset: { key: string }[]) => (
    <tr className="bg-muted/40 border-b border-border">
      <td className="sticky left-0 z-10 bg-muted/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary border-r border-border">
        {label}
      </td>
      {months.map((m) =>
        visiblePeople.map((p: any, pi: number) => {
          const v = subsetColLoad(subset, m, p.id);
          return (
            <td
              key={m + p.id}
              className={`text-center px-0 py-1.5 text-xs font-medium ${monthBorder(pi)} ${v > 0 ? "text-primary" : "text-muted-foreground/40"}`}
              title={`${firstName(p.full_name)} · ${formatMonthLabel(m)} · ${Math.round(v * 10) / 10}j`}
            >
              {v ? Math.round(v * 10) / 10 : "·"}
            </td>
          );
        })
      )}
      <td className="text-center px-2 py-1.5 text-xs font-bold text-primary border-l border-border">
        {Math.round(subset.reduce((s, t) => s + rowTotal(t.key), 0) * 10) / 10}
      </td>
    </tr>
  );

  if (isLoading) {
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
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <h2 className="text-xl font-heading font-semibold text-primary">Staffing prévisionnel</h2>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={view === "grid" ? "default" : "ghost"}
              size="sm"
              className="rounded-md h-7"
              onClick={() => switchView("grid")}
            >
              <LayoutGrid size={14} className="mr-1" /> Grille
            </Button>
            <Button
              variant={view === "recap" ? "default" : "ghost"}
              size="sm"
              className="rounded-md h-7"
              onClick={() => switchView("recap")}
            >
              <BarChart3 size={14} className="mr-1" /> Récap
            </Button>
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 h-4">
            {view === "grid" && (
              saving ? (
                <><Loader2 size={12} className="animate-spin" /> Enregistrement…</>
              ) : dirty ? (
                "Modifications en attente…"
              ) : (
                "✓ Enregistré automatiquement"
              )
            )}
          </span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {view === "grid"
          ? "Planifie qui passe combien de jours sur chaque mission / projet transverse, mois par mois."
          : "Récapitulatif de la charge de chacun sur la période, sur les missions et projets où du temps a été saisi."}
      </p>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {mode === "preset" ? (
            <>
              <Button variant="outline" size="icon" className="rounded-lg border-input h-8 w-8" onClick={() => changeWindow(-monthsCount)} disabled={saving}>
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm font-medium text-primary w-44 text-center">
                {formatMonthLabel(firstMonth)} → {formatMonthLabel(lastMonth)}
              </span>
              <Button variant="outline" size="icon" className="rounded-lg border-input h-8 w-8" onClick={() => changeWindow(monthsCount)} disabled={saving}>
                <ChevronRight size={16} />
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Du</span>
              <input
                type="month"
                value={customStart}
                onChange={(e) => changeCustom("start", e.target.value)}
                className="h-8 rounded-md border border-input bg-card px-2 text-sm"
              />
              <span className="text-xs text-muted-foreground">au</span>
              <input
                type="month"
                value={customEnd}
                onChange={(e) => changeCustom("end", e.target.value)}
                className="h-8 rounded-md border border-input bg-card px-2 text-sm"
              />
              <span className="text-xs text-muted-foreground">({months.length} mois)</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            variant={hideOnHold ? "default" : "outline"}
            size="sm"
            className="rounded-lg h-8"
            onClick={() => setHideOnHold((v) => !v)}
            title="Masquer / afficher les missions et projets en attente"
          >
            {hideOnHold ? <Eye size={14} className="mr-1" /> : <EyeOff size={14} className="mr-1" />}
            {hideOnHold ? "Afficher en attente" : "Masquer en attente"}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-lg h-8">
                <Users size={14} className="mr-1" />
                Personnes{hidden.size > 0 ? ` (${hidden.size} masqué${hidden.size > 1 ? "s" : ""})` : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2">
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-xs font-semibold text-primary">Afficher / masquer</span>
                {hidden.size > 0 && (
                  <button onClick={showAllPeople} className="text-xs text-secondary hover:underline">
                    Tout afficher
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-auto">
                {people.map((p: any) => {
                  const shown = !hidden.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleHidden(p.id)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50 text-left"
                    >
                      <span className={`text-sm ${shown ? "text-foreground" : "text-muted-foreground line-through"}`}>
                        {p.full_name}
                      </span>
                      {shown && <Check size={14} className="text-secondary" />}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          <Button variant={mode === "preset" && monthsCount === 3 ? "default" : "outline"} size="sm" className="rounded-lg h-8" onClick={() => selectPreset(3)}>
            3 mois
          </Button>
          <Button variant={mode === "preset" && monthsCount === 6 ? "default" : "outline"} size="sm" className="rounded-lg h-8" onClick={() => selectPreset(6)}>
            6 mois
          </Button>
          <Button variant={mode === "custom" ? "default" : "outline"} size="sm" className="rounded-lg h-8" onClick={selectCustom}>
            Personnaliser
          </Button>
        </div>
      </div>

      {view === "grid" && (<>
      <div className="bg-card rounded-lg border border-border overflow-x-auto w-fit max-w-full">
        <table className="border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th rowSpan={2} className="sticky left-0 z-20 bg-card text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary min-w-[200px] border-r border-border">
                Mission / Projet
              </th>
              {months.map((m) => (
                <th
                  key={m}
                  colSpan={visiblePeople.length}
                  className="text-center px-2 py-2 text-xs font-semibold uppercase tracking-wide text-primary border-l-2 border-border"
                >
                  {formatMonthLabel(m)}
                </th>
              ))}
              <th rowSpan={2} className="text-center px-2 py-2 text-xs font-semibold uppercase tracking-wide text-primary border-l border-border">
                Total
              </th>
            </tr>
            <tr className="border-b border-border">
              {months.map((m) =>
                visiblePeople.map((p: any, pi: number) => (
                  <th key={m + p.id} className={`p-0 align-bottom ${monthBorder(pi)}`}>
                    <div className="group h-20 flex flex-col items-center justify-end relative">
                      <button
                        onClick={() => toggleHidden(p.id)}
                        className="absolute top-0 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        title={`Masquer ${firstName(p.full_name)}`}
                      >
                        <X size={11} />
                      </button>
                      <span
                        className="text-[11px] text-muted-foreground whitespace-nowrap pb-1 pt-2"
                        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                        title={`${p.full_name} · ${p.role}`}
                      >
                        {firstName(p.full_name)}
                      </span>
                    </div>
                  </th>
                ))
              )}
            </tr>
          </thead>

          <tbody>
            {/* ── Missions ── */}
            {sectionHeader("Missions")}
            {visibleMissionTargets.length === 0
              ? emptyNote(hideOnHold ? "Aucune mission en cours" : "Aucune mission en cours ou en attente")
              : visibleMissionTargets.map(renderTargetRow)}
            <tr className="border-b border-border">
              <td colSpan={totalCols} className="p-0">
                <div className="sticky left-0 w-fit px-4 py-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground text-xs h-7 px-2 hover:text-secondary"
                    onClick={() => setAddOpen(true)}
                  >
                    <Plus size={12} className="mr-1" /> Ajouter une mission
                  </Button>
                </div>
              </td>
            </tr>
            {visiblePeople.length > 0 && visibleMissionTargets.length > 0 && sectionSubtotalRow("Total missions / personne", visibleMissionTargets)}

            {/* ── Projets transverses ── */}
            {sectionHeader("Projets transverses")}
            {visibleTransverseTargets.length === 0
              ? emptyNote(hideOnHold ? "Aucun projet transverse en cours" : "Aucun projet transverse en cours ou en attente")
              : visibleTransverseTargets.map(renderTargetRow)}
            {visiblePeople.length > 0 && visibleTransverseTargets.length > 0 && sectionSubtotalRow("Total transverses / personne", visibleTransverseTargets)}
          </tbody>

          {targets.length > 0 && people.length > 0 && (
            <tfoot>
              <tr className="bg-muted/50 border-t-2 border-border">
                <td className="sticky left-0 z-10 bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary border-r border-border">
                  Charge (j)
                </td>
                {months.map((m) =>
                  visiblePeople.map((p: any, pi: number) => {
                    const load = colLoad(m, p.id);
                    const capacity = effectiveCapacity(m, p.id);
                    const conges = congesFor(p.id, m);
                    const over = load > capacity;
                    return (
                      <td
                        key={m + p.id}
                        className={`text-center px-0 py-2 text-xs font-semibold ${monthBorder(pi)} ${over ? "text-destructive" : load > 0 ? "text-primary" : "text-muted-foreground/40"}`}
                        title={`${firstName(p.full_name)} · ${formatMonthLabel(m)} · ${load}j staffés / ${capacity}j dispo${conges ? ` (${conges}j congés)` : ""}`}
                      >
                        {load ? Math.round(load * 10) / 10 : "·"}
                      </td>
                    );
                  })
                )}
                <td className="border-l border-border" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Chaque colonne = une personne (prénom à la verticale) sous le mois concerné. Ligne <span className="font-medium">Charge</span> : total de jours planifiés par personne et par mois. La charge mensuelle d'une personne ne peut pas dépasser les jours ouvrés du mois.
      </p>
      </>)}

      {view === "recap" && (
        <div className="space-y-8">
          {/* ── Charge par personne ── */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-base font-heading font-semibold text-primary">
                Charge par personne · {formatMonthLabel(firstMonth)} → {formatMonthLabel(lastMonth)}
              </h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-secondary inline-block" /> Client</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary inline-block" /> Transverse</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> Congés</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-muted border border-border inline-block" /> Libre</span>
              </div>
            </div>

            <div className="bg-card rounded-lg border border-border divide-y divide-border">
              {recapData.filter((r) => r.staffed > 0 || r.conges > 0).length === 0 ? (
                <div className="px-4 py-8 text-sm text-muted-foreground text-center">
                  Aucun temps saisi sur la période. Renseigne des jours dans la grille pour voir le récapitulatif.
                </div>
              ) : (
                recapData
                  .filter((r) => r.staffed > 0 || r.conges > 0)
                  .sort((a, b) => b.staffed - a.staffed)
                  .map((r) => {
                    const denom = Math.max(r.capacity, r.staffed + r.conges) || 1;
                    const pct = (v: number) => `${(v / denom) * 100}%`;
                    const over = r.staffed + r.conges > r.capacity;
                    return (
                      <div key={r.p.id} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-foreground">
                            {firstName(r.p.full_name)}
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent text-accent-foreground capitalize ml-2">{r.p.role}</span>
                          </span>
                          <span className={`text-xs ${over ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                            {Math.round(r.staffed * 10) / 10} j staffés / {r.capacity} j ouvrés · {Math.round(r.free * 10) / 10} j libres
                          </span>
                        </div>
                        <div className="flex h-5 w-full rounded bg-muted border border-border overflow-hidden">
                          {r.client > 0 && <div className="bg-secondary h-full" style={{ width: pct(r.client) }} title={`Client : ${Math.round(r.client * 10) / 10} j`} />}
                          {r.transverse > 0 && <div className="bg-primary h-full" style={{ width: pct(r.transverse) }} title={`Transverse : ${Math.round(r.transverse * 10) / 10} j`} />}
                          {r.conges > 0 && <div className="bg-amber-400 h-full" style={{ width: pct(r.conges) }} title={`Congés : ${Math.round(r.conges * 10) / 10} j`} />}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Capacité = jours ouvrés de la période. Les <span className="font-medium">congés</span> (en ambre) proviennent de Payfit et sont déduits du temps libre. S'ils restent à 0, c'est que la synchronisation Payfit n'a pas encore tourné.
            </p>
          </div>

          {/* ── Qui est staffé sur quoi ── */}
          <div>
            <h3 className="text-base font-heading font-semibold text-primary mb-3">Qui est staffé sur quoi</h3>
            {staffedList.missions.length === 0 && staffedList.transverse.length === 0 ? (
              <div className="bg-card rounded-lg border border-border px-4 py-8 text-sm text-muted-foreground text-center">
                Aucune mission ni projet avec du temps saisi sur la période.
              </div>
            ) : (
              <div className="space-y-6">
                {[
                  { label: "Missions", items: staffedList.missions },
                  { label: "Projets transverses", items: staffedList.transverse },
                ].map((group) =>
                  group.items.length === 0 ? null : (
                    <div key={group.label}>
                      <div className="text-sm font-heading font-semibold text-secondary mb-2">{group.label}</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {group.items
                          .sort((a, b) => b.total - a.total)
                          .map(({ t, ppl, total }) => (
                            <div key={t.key} className="bg-card rounded-lg border border-border p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-foreground truncate">{t.title}</div>
                                  <div className="text-xs text-muted-foreground truncate">{t.subtitle}</div>
                                </div>
                                <span className="text-sm font-semibold text-primary whitespace-nowrap ml-2">{Math.round(total * 10) / 10} j</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {ppl.map((x) => (
                                  <span key={x.name} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-foreground">
                                    {x.name} · {Math.round(x.days * 10) / 10} j
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialog : créer une mission à la main */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une mission à la main</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Crée une nouvelle mission (hors Notion). Elle apparaîtra immédiatement dans le planning.
          </p>
          <div className="space-y-3 mt-2">
            <Input
              autoFocus
              placeholder="Nom du projet"
              value={newMission.name}
              onChange={(e) => setNewMission((s) => ({ ...s, name: e.target.value }))}
            />
            <Input
              placeholder="Nom du client"
              value={newMission.client}
              onChange={(e) => setNewMission((s) => ({ ...s, client: e.target.value }))}
            />
            <div className="flex gap-2">
              <select
                value={newMission.pole}
                onChange={(e) => setNewMission((s) => ({ ...s, pole: e.target.value as MissionPole }))}
                className="flex-1 h-10 rounded-md border border-input bg-card px-3 text-sm"
              >
                {POLES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select
                value={newMission.status}
                onChange={(e) => setNewMission((s) => ({ ...s, status: e.target.value as "active" | "on_hold" }))}
                className="flex-1 h-10 rounded-md border border-input bg-card px-3 text-sm"
              >
                <option value="active">En cours</option>
                <option value="on_hold">En attente</option>
              </select>
            </div>
            <Button className="w-full rounded-lg" onClick={handleCreateMission} disabled={createMission.isPending}>
              {createMission.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Plus size={14} className="mr-2" />}
              Créer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default StaffingView;
