import type { TimeEntry } from "@/lib/database.types";

export const missionKey = (id: string) => `mission:${id}`;
export const internalKey = (cat: string) => `internal:${cat}`;
export const transverseKey = (id: string) => `transverse:${id}`;
export const proposalKey = (id: string) => `proposal:${id}`;

// Clé de grille correspondant à une saisie. Source unique de vérité, utilisée à la
// fois pour remplir la grille et pour repérer les saisies dont la ligne n'est plus
// affichée (mission clôturée, propale close, projet transverse archivé).
export const entryKey = (entry: TimeEntry): string | null => {
  if (entry.mission_id) return missionKey(entry.mission_id);
  if (entry.transverse_project_id) return transverseKey(entry.transverse_project_id);
  if (entry.proposal_id) return proposalKey(entry.proposal_id);
  if (entry.internal_category) return internalKey(entry.internal_category);
  return null;
};

// Libellé lisible d'une saisie orpheline, pour le bandeau de rappel.
export const entryLabel = (entry: TimeEntry): string => {
  if (entry.mission_id) {
    const m = entry.mission;
    if (!m) return "Mission clôturée";
    return m.client && m.name ? `${m.client} — ${m.name}` : (m.client || m.name || "Mission clôturée");
  }
  if (entry.transverse_project_id) return entry.transverse_project?.name ?? "Projet transverse archivé";
  if (entry.proposal_id) return entry.proposal?.name ?? "Propale close";
  return entry.internal_category ?? "Ligne inconnue";
};

export interface HiddenHours {
  total: number;
  lines: [string, number][];
  /** Heures masquées par date (YYYY-MM-DD), pour réintégrer les totaux de colonne. */
  byDate: Record<string, number>;
}

// Heures d'un lot de saisies dont la ligne n'apparaît pas dans la grille.
//
// `entries` est toujours le lot de la SEMAINE AFFICHÉE (useTimeEntries filtre sur
// week_start), alors que `visibleKeys` décrit l'état COURANT des missions/propales/
// projets. Le bandeau fonctionne donc identiquement sur une semaine passée : une
// mission clôturée aujourd'hui fait remonter les heures qu'elle portait en août.
export function computeHiddenHours(
  entries: TimeEntry[],
  visibleKeys: Iterable<string>,
): HiddenHours {
  const visible = new Set(visibleKeys);
  const byLabel = new Map<string, number>();
  const byDate: Record<string, number> = {};
  let total = 0;

  for (const entry of entries) {
    const key = entryKey(entry);
    if (!key || visible.has(key)) continue;
    const hours = Number(entry.hours) || 0;
    if (hours <= 0) continue;
    total += hours;
    const label = entryLabel(entry);
    byLabel.set(label, (byLabel.get(label) ?? 0) + hours);
    byDate[entry.entry_date] = (byDate[entry.entry_date] ?? 0) + hours;
  }

  return {
    total,
    lines: Array.from(byLabel.entries()).sort((a, b) => b[1] - a[1]),
    byDate,
  };
}
