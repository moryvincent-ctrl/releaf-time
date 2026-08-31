import { describe, it, expect } from "vitest";
import {
  computeHiddenHours,
  missionKey,
  internalKey,
  transverseKey,
  proposalKey,
} from "@/lib/timesheet";
import type { TimeEntry } from "@/lib/database.types";

// Fabrique une saisie minimale. `week_start` est toujours cohérent avec la semaine
// testée : useTimeEntries filtre dessus, donc `entries` ne contient jamais que la
// semaine affichée.
function entry(partial: Partial<TimeEntry>): TimeEntry {
  return {
    id: crypto.randomUUID(),
    user_id: "arthur",
    mission_id: null,
    internal_category: null,
    transverse_project_id: null,
    proposal_id: null,
    entry_date: "2025-08-04",
    hours: 0,
    comment: null,
    week_start: "2025-08-04",
    created_at: "2025-08-04T09:00:00Z",
    ...partial,
  } as TimeEntry;
}

const FDA = {
  id: "fda-uuid",
  name: "Bilan carbone 2025",
  client: "Ferme des Arches",
  pole: "Releaf Carbon",
  status: "completed",
};

// Lignes affichées dans la grille : missions ACTIVES à l'instant T + catégories internes.
// FDA n'y figure pas puisqu'elle est passée "Terminée" dans Notion.
const VISIBLE_NOW = [
  missionKey("mission-encore-active"),
  internalKey("Administratif"),
];

describe("computeHiddenHours — semaines précédentes", () => {
  it("remonte les heures d'une mission clôturée aujourd'hui sur une semaine passée", () => {
    // Arthur, semaine du 4 août : 2 jours sur Ferme des Arches.
    // La mission n'est clôturée qu'en fin de mois — les heures d'août doivent
    // quand même apparaître dans le bandeau quand il revient sur cette semaine.
    const aout = [
      entry({ mission_id: FDA.id, mission: FDA as any, entry_date: "2025-08-04", hours: 7 }),
      entry({ mission_id: FDA.id, mission: FDA as any, entry_date: "2025-08-05", hours: 3.5 }),
    ];

    const res = computeHiddenHours(aout, VISIBLE_NOW);

    expect(res.total).toBe(10.5);
    expect(res.lines).toEqual([["Ferme des Arches — Bilan carbone 2025", 10.5]]);
  });

  it("ne dépend que du statut courant, pas de la semaine consultée", () => {
    const semaine = [
      entry({ mission_id: FDA.id, mission: FDA as any, entry_date: "2025-08-04", hours: 7 }),
    ];

    // Tant que la mission était affichée, aucune heure masquée.
    const avantCloture = computeHiddenHours(semaine, [...VISIBLE_NOW, missionKey(FDA.id)]);
    expect(avantCloture.total).toBe(0);
    expect(avantCloture.lines).toEqual([]);

    // Une fois clôturée, la même semaine fait remonter le bandeau.
    const apresCloture = computeHiddenHours(semaine, VISIBLE_NOW);
    expect(apresCloture.total).toBe(7);
  });
});

describe("computeHiddenHours — agrégation", () => {
  it("regroupe par ligne et trie par volume décroissant", () => {
    const autre = { id: "autre-uuid", name: "Audit", client: "SAUR", status: "completed" };
    const res = computeHiddenHours(
      [
        entry({ mission_id: FDA.id, mission: FDA as any, hours: 2 }),
        entry({ mission_id: FDA.id, mission: FDA as any, entry_date: "2025-08-05", hours: 3 }),
        entry({ mission_id: autre.id, mission: autre as any, hours: 8 }),
      ],
      VISIBLE_NOW,
    );

    expect(res.total).toBe(13);
    expect(res.lines).toEqual([
      ["SAUR — Audit", 8],
      ["Ferme des Arches — Bilan carbone 2025", 5],
    ]);
  });

  it("couvre aussi les propales closes et les projets transverses archivés", () => {
    const res = computeHiddenHours(
      [
        entry({ proposal_id: "p1", proposal: { id: "p1", name: "Propale Veolia" } as any, hours: 4 }),
        entry({
          transverse_project_id: "t1",
          transverse_project: { id: "t1", name: "Refonte site" } as any,
          hours: 2,
        }),
      ],
      VISIBLE_NOW,
    );

    expect(res.total).toBe(6);
    expect(res.lines).toEqual([
      ["Propale Veolia", 4],
      ["Refonte site", 2],
    ]);
  });

  it("ignore les lignes affichées et les saisies à zéro", () => {
    const res = computeHiddenHours(
      [
        entry({ internal_category: "Administratif" as any, hours: 6 }),
        entry({ mission_id: "mission-encore-active", hours: 4 }),
        entry({ mission_id: FDA.id, mission: FDA as any, hours: 0 }),
      ],
      VISIBLE_NOW,
    );

    expect(res.total).toBe(0);
    expect(res.lines).toEqual([]);
  });

  it("reste lisible si la jointure mission n'est pas résolue", () => {
    const res = computeHiddenHours([entry({ mission_id: FDA.id, hours: 5 })], VISIBLE_NOW);
    expect(res.lines).toEqual([["Mission clôturée", 5]]);
  });
});
