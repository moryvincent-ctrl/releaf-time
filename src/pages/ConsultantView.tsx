import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, MessageSquare, Loader2, Plus, Info } from "lucide-react";
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
  useTransverseProjects,
  useActiveProposals,
  useMyProposals,
  useAddUserProposal,
  useUpsertTimeEntry,
  getWeekStart,
  getWeekDays,
  formatWeekLabel,
} from "@/hooks/useTimeEntries";
import type { InternalCategory, TimeEntry } from "@/lib/database.types";
import { toast } from "sonner";

const INTERNAL_CATEGORIES: InternalCategory[] = [
  "Sales / Biz Dev",
  "Administratif",
  "Outils internes",
  "Formation",
  "Communication",
  "Recrutement",
];

const DAYS_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
const MAX_HOURS_PER_DAY = 7;
const MAX_HOURS_PER_WEEK = 35;


type GridCell = { hours: number; comment: string };
type GridState = Record<string, Record<string, GridCell>>;

const missionKey = (id: string) => `mission:${id}`;
const internalKey = (cat: string) => `internal:${cat}`;
const transverseKey = (id: string) => `transverse:${id}`;
const proposalKey = (id: string) => `proposal:${id}`;

// Clé de grille correspondant à une saisie. Source unique de vérité, utilisée à la
// fois pour remplir la grille et pour repérer les saisies dont la ligne n'est plus
// affichée (mission clôturée, propale close, projet transverse archivé).
const entryKey = (entry: TimeEntry): string | null => {
  if (entry.mission_id) return missionKey(entry.mission_id);
  if (entry.transverse_project_id) return transverseKey(entry.transverse_project_id);
  if (entry.proposal_id) return proposalKey(entry.proposal_id);
  if (entry.internal_category) return internalKey(entry.internal_category);
  return null;
};

// Libellé lisible d'une saisie orpheline, pour le bandeau de rappel.
const entryLabel = (entry: TimeEntry): string => {
  if (entry.mission_id) {
    const m = entry.mission;
    if (!m) return "Mission clôturée";
    return m.client && m.name ? `${m.client} — ${m.name}` : (m.client || m.name || "Mission clôturée");
  }
  if (entry.transverse_project_id) return entry.transverse_project?.name ?? "Projet transverse archivé";
  if (entry.proposal_id) return entry.proposal?.name ?? "Propale close";
  return entry.internal_category ?? "Ligne inconnue";
};

const ConsultantView = () => {
  const today = new Date();
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(getWeekStart(today));
  const weekDays = getWeekDays(weekStart);

  const { data: entries = [], isLoading: loadingEntries } = useTimeEntries(weekStart);
  const { data: baseAssignedMissions = [], isLoading: loadingMissions } = useAssignedMissions();
  const { data: allActiveMissions = [] } = useActiveMissions();
  const { data: transverseProjects = [] } = useTransverseProjects();
  const { data: myProposals = [] } = useMyProposals();
  const { data: allActiveProposals = [] } = useActiveProposals();
  const addUserProposal = useAddUserProposal();
  const upsert = useUpsertTimeEntry();

  const [grid, setGrid] = useState<GridState>({});
  const [showComment, setShowComment] = useState<{ key: string; date: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Missions ajoutées ponctuellement (état local pour la session courante)
  const [extraMissionIds, setExtraMissionIds] = useState<Set<string>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Picker propales
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [proposalSearch, setProposalSearch] = useState("");

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

  // Propales disponibles à l'ajout (actives, pas déjà dans la grille du user)
  const availableProposals = useMemo(() => {
    const usedIds = new Set(myProposals.map((p: any) => p.id));
    const q = proposalSearch.trim().toLowerCase();
    return allActiveProposals
      .filter((p: any) => !usedIds.has(p.id))
      .filter((p: any) => {
        if (!q) return true;
        return (
          (p.name ?? "").toLowerCase().includes(q) ||
          (p.mission_type ?? "").toLowerCase().includes(q)
        );
      });
  }, [myProposals, allActiveProposals, proposalSearch]);

  // Initialise la grille depuis les entrées Supabase
  useEffect(() => {
    const newGrid: GridState = {};
    for (const entry of entries) {
      const key = entryKey(entry);
      if (!key) continue;
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
      ...assignedMissions.map((m: any) => missionKey(m.id)),
      ...INTERNAL_CATEGORIES.map((c) => internalKey(c)),
      ...transverseProjects.map((p: any) => transverseKey(p.id)),
      ...myProposals.map((p: any) => proposalKey(p.id)),
    ];
    return allKeys.reduce((sum, k) => sum + (getCell(k, date).hours || 0), 0);
  };

  const grandTotal = weekDays.reduce((sum, d) => sum + colTotal(d), 0);

  // Heures saisies sur la semaine affichée dont la ligne n'apparaît plus dans la
  // grille : mission passée "Terminée" dans Notion, propale close, projet transverse
  // archivé. Ces saisies restent en base et comptent dans les dashboards — on les
  // signale ici pour que le total de la semaine reste lisible.
  const hiddenHours = useMemo(() => {
    const visible = new Set<string>([
      ...assignedMissions.map((m: any) => missionKey(m.id)),
      ...INTERNAL_CATEGORIES.map((c) => internalKey(c)),
      ...transverseProjects.map((p: any) => transverseKey(p.id)),
      ...myProposals.map((p: any) => proposalKey(p.id)),
    ]);

    const byLabel = new Map<string, number>();
    let total = 0;
    for (const entry of entries) {
      const key = entryKey(entry);
      if (!key || visible.has(key)) continue;
      const hours = Number(entry.hours) || 0;
      if (hours <= 0) continue;
      total += hours;
      const label = entryLabel(entry);
      byLabel.set(label, (byLabel.get(label) ?? 0) + hours);
    }
    return { total, lines: Array.from(byLabel.entries()).sort((a, b) => b[1] - a[1]) };
  }, [entries, assignedMissions, transverseProjects, myProposals]);

  const saveGrid = async (opts: { silent?: boolean } = {}) => {
    setSaving(true);
    try {
      type Row = {
        key: string;
        missionId: string | null;
        category: InternalCategory | null;
        transverseId: string | null;
        proposalId: string | null;
      };
      const allRows: Row[] = [
        ...assignedMissions.map((m: any): Row => ({ key: missionKey(m.id), missionId: m.id, category: null, transverseId: null, proposalId: null })),
        ...INTERNAL_CATEGORIES.map((c): Row => ({ key: internalKey(c), missionId: null, category: c, transverseId: null, proposalId: null })),
        ...transverseProjects.map((p: any): Row => ({ key: transverseKey(p.id), missionId: null, category: null, transverseId: p.id, proposalId: null })),
        ...myProposals.map((p: any): Row => ({ key: proposalKey(p.id), missionId: null, category: null, transverseId: null, proposalId: p.id })),
      ];

      await Promise.all(
        allRows.flatMap((row) =>
          weekDays.map((date) =>
            upsert.mutateAsync({
              mission_id: row.missionId,
              internal_category: row.category,
              transverse_project_id: row.transverseId,
              proposal_id: row.proposalId,
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
    } catch (err: any) {
      console.error("Erreur de sauvegarde feuille de temps :", err);
      const detail = err?.message || err?.error_description || err?.code;
      toast.error(detail ? `Erreur lors de la sauvegarde : ${detail}` : "Erreur lors de la sauvegarde");
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

  const renderRow = (key: string, name: string, client?: string, nature?: string, pole?: string, status?: string) => (
    <tr key={key} className="border-b border-border last:border-b-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-foreground">{name}</span>
          {status === "completed" && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Terminé</span>
          )}
        </div>
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
                className="w-full max-w-[72px] h-8 text-center mx-auto bg-card border-input text-sm rounded-md"
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
                className="w-full max-w-[110px] h-6 text-xs mt-1 mx-auto border-input"
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

  // Largeurs de colonnes partagées entre la grille de saisie et la barre de totaux,
  // pour que les jours restent alignés sous leurs colonnes.
  const GridCols = () => (
    <colgroup>
      <col style={{ width: "30%" }} />
      {weekDays.map((d) => (
        <col key={d} style={{ width: "11%" }} />
      ))}
      <col style={{ width: "15%" }} />
    </colgroup>
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
      </div>

      {hiddenHours.total > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <div className="flex items-start gap-2">
            <Info size={16} className="text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-foreground">
                <span className="font-semibold">{hiddenHours.total}h</span> saisies cette semaine sur des
                lignes clôturées, non comptées dans le total ci-dessous.
              </p>
              <ul className="mt-1 text-xs text-muted-foreground">
                {hiddenHours.lines.map(([label, hours]) => (
                  <li key={label}>{label} — {hours}h</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">
                Ces heures restent enregistrées et comptent dans les tableaux de bord. Pour les
                modifier, il faut rouvrir la mission côté Notion.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full table-fixed">
          <GridCols />
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
              <td colSpan={7} className="px-4 py-3 text-base font-heading font-semibold text-secondary bg-muted">
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
                renderRow(missionKey(m.id), m.name, m.client, m.nature_mission, m.pole, m.status)
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
              <td colSpan={7} className="px-4 py-3 text-base font-heading font-semibold text-secondary bg-muted">
                Temps internes
              </td>
            </tr>
            {INTERNAL_CATEGORIES.map((cat) =>
              renderRow(internalKey(cat), cat)
            )}

            <tr>
              <td colSpan={7} className="px-4 py-3 text-base font-heading font-semibold text-secondary bg-muted">
                Projets transverses
              </td>
            </tr>
            {transverseProjects.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-sm text-muted-foreground text-center">
                  Aucun projet transverse — synchronise depuis Notion dans Paramètres
                </td>
              </tr>
            ) : (
              transverseProjects.map((p: any) =>
                renderRow(transverseKey(p.id), p.name)
              )
            )}

            <tr>
              <td colSpan={7} className="px-4 py-3 text-base font-heading font-semibold text-secondary bg-muted">
                Propositions commerciales
              </td>
            </tr>
            {myProposals.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-sm text-muted-foreground text-center">
                  Aucune propale ajoutée — clique sur "Ajouter une propale" ci-dessous
                </td>
              </tr>
            ) : (
              myProposals.map((p: any) =>
                renderRow(proposalKey(p.id), p.name, undefined, p.mission_type ?? undefined)
              )
            )}
            <tr>
              <td colSpan={7} className="px-4 py-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground text-xs h-7 px-2 hover:text-secondary"
                  onClick={() => { setProposalSearch(""); setProposalDialogOpen(true); }}
                >
                  <Plus size={12} className="mr-1" /> Ajouter une propale
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Barre de totaux collée en bas — colonnes alignées sur la grille de saisie */}
      <div className="sticky -bottom-7 z-20 -mx-8 -mb-8 mt-6 px-8 border-t-2 border-secondary bg-secondary/15 backdrop-blur-sm">
        <table className="w-full table-fixed">
          <GridCols />
          <tbody>
            <tr>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-primary">Total quotidien</span>
                  <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${grandTotal >= MAX_HOURS_PER_WEEK ? "bg-secondary text-secondary-foreground" : "bg-accent text-accent-foreground"}`}>
                    {grandTotal}h / {MAX_HOURS_PER_WEEK}h
                  </span>
                </div>
              </td>
              {DAYS_LABELS.map((label, i) => {
                const total = colTotal(weekDays[i]);
                const isFull = total >= MAX_HOURS_PER_DAY;
                return (
                  <td key={label} className={`text-center px-2 py-2.5 font-bold text-sm ${isFull ? "text-secondary" : "text-primary"}`}>
                    {total}h
                  </td>
                );
              })}
              <td className="px-2 py-2.5 text-center">
                <Button size="sm" className="rounded-lg w-full" onClick={handleSave} disabled={saving}>
                  {saving
                    ? <><Loader2 size={14} className="mr-1 animate-spin" />…</>
                    : "Sauvegarder"
                  }
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter une mission ponctuelle</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Sélectionne une mission en cours sur laquelle tu n'es pas staffé pour pouvoir saisir du temps dessus. Elle restera sur ta grille tant qu'elle est en cours — une mission passée "Terminée" dans Notion en sort automatiquement.
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{m.client}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.name}{m.nature_mission ? ` · ${m.nature_mission}` : ""}
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={proposalDialogOpen} onOpenChange={setProposalDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter une propale</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Sélectionne une propale en cours pour saisir du temps dessus. Elle restera sur ta grille jusqu'à ce qu'elle passe au statut "Gagné" côté HubSpot.
          </p>
          <Input
            autoFocus
            placeholder="Rechercher par nom de prospect ou type de mission…"
            value={proposalSearch}
            onChange={(e) => setProposalSearch(e.target.value)}
            className="mt-2"
          />
          <div className="max-h-72 overflow-auto border border-border rounded-md divide-y divide-border">
            {availableProposals.length === 0 ? (
              <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                Aucune propale disponible.
              </div>
            ) : (
              availableProposals.map((p: any) => (
                <button
                  key={p.id}
                  onClick={async () => {
                    try {
                      await addUserProposal.mutateAsync(p.id);
                      setProposalDialogOpen(false);
                      toast.success(`"${p.name}" ajoutée à la grille`);
                    } catch {
                      toast.error("Erreur lors de l'ajout");
                    }
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-muted/40 transition-colors"
                >
                  <div className="text-sm font-medium text-foreground">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.mission_type ?? "—"}{p.stage ? ` · ${p.stage}` : ""}
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
