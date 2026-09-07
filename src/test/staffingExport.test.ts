import { describe, it, expect } from "vitest";
import {
  buildGridRows,
  buildDetailRows,
  buildExportFileName,
  buildStaffingWorkbook,
  type StaffingExportInput,
  type ExportPerson,
  type ExportTarget,
} from "@/lib/staffingExport";

const alice: ExportPerson = { id: "u-alice", full_name: "Alice Martin", role: "consultant" };
const bob: ExportPerson = { id: "u-bob", full_name: "Bob Dupont", role: "manager" };

const acme: ExportTarget = { key: "mission:m1", type: "mission", label: "Refonte SI", client: "Acme", pole: "Energie" };
const beta: ExportTarget = { key: "mission:m2", type: "mission", label: "Bilan carbone", client: "Beta", pole: "Climat" };
const rnd: ExportTarget = { key: "transverse:t1", type: "transverse", label: "R&D interne", client: "", pole: "" };

const months = ["2026-01-01", "2026-02-01"];

// Construit une entree d'export a partir d'une table plate "cible|mois|personne" -> jours.
function inputWith(days: Record<string, number>): StaffingExportInput {
  return {
    months,
    people: [alice, bob],
    targets: [acme, beta, rnd],
    getDays: (target, month, personId) => days[`${target}|${month}|${personId}`] ?? 0,
  };
}

describe("buildGridRows", () => {
  it("place les mois au-dessus des personnes sur deux lignes d'en-tete", () => {
    const rows = buildGridRows(inputWith({ "mission:m1|2026-01-01|u-alice": 5 }));

    expect(rows[0]).toEqual(["", "", "janv. 26", null, "févr. 26", null]);
    expect(rows[1]).toEqual(["Client", "Mission / Projet", "Alice Martin", "Bob Dupont", "Alice Martin", "Bob Dupont"]);
  });

  it("rend une ligne par cible et laisse vides les cellules sans jours", () => {
    const rows = buildGridRows(
      inputWith({
        "mission:m1|2026-01-01|u-alice": 5,
        "mission:m1|2026-02-01|u-bob": 3,
      })
    );

    expect(rows).toHaveLength(3);
    expect(rows[2]).toEqual(["Acme", "Refonte SI", 5, null, null, 3]);
  });

  it("exclut les cibles sans aucune saisie sur la fenetre", () => {
    const rows = buildGridRows(inputWith({ "transverse:t1|2026-01-01|u-bob": 2 }));

    expect(rows.slice(2).map((r) => r[1])).toEqual(["R&D interne"]);
  });

  it("garde les missions avant les transverses", () => {
    const rows = buildGridRows(
      inputWith({
        "transverse:t1|2026-01-01|u-bob": 2,
        "mission:m2|2026-01-01|u-alice": 4,
      })
    );

    expect(rows.slice(2).map((r) => r[1])).toEqual(["Bilan carbone", "R&D interne"]);
  });

  it("affiche le libelle Transverse en colonne client pour un projet transverse", () => {
    const rows = buildGridRows(inputWith({ "transverse:t1|2026-01-01|u-bob": 2 }));

    expect(rows[2][0]).toBe("Transverse");
  });
});

describe("buildDetailRows", () => {
  it("liste une ligne par allocation, triee par mois puis cible puis personne", () => {
    const rows = buildDetailRows(
      inputWith({
        "mission:m1|2026-01-01|u-alice": 5,
        "mission:m1|2026-01-01|u-bob": 3,
        "transverse:t1|2026-02-01|u-bob": 2,
      })
    );

    expect(rows[0]).toEqual(["Personne", "Rôle", "Type", "Cible", "Client", "Pôle", "Mois", "Jours"]);
    expect(rows.slice(1)).toEqual([
      ["Alice Martin", "consultant", "Mission", "Refonte SI", "Acme", "Energie", "2026-01", 5],
      ["Bob Dupont", "manager", "Mission", "Refonte SI", "Acme", "Energie", "2026-01", 3],
      ["Bob Dupont", "manager", "Transverse", "R&D interne", "", "", "2026-02", 2],
    ]);
  });

  it("ignore les cellules a zero", () => {
    const rows = buildDetailRows(
      inputWith({
        "mission:m1|2026-01-01|u-alice": 0,
        "mission:m1|2026-01-01|u-bob": 4,
      })
    );

    expect(rows.slice(1)).toHaveLength(1);
    expect(rows[1][0]).toBe("Bob Dupont");
  });
});

describe("buildExportFileName", () => {
  it("relie le premier et le dernier mois de la fenetre", () => {
    expect(buildExportFileName(["2026-01-01", "2026-02-01", "2026-03-01"])).toBe("staffing-2026-01_2026-03.xlsx");
  });

  it("n'indique qu'un mois quand la fenetre en compte un seul", () => {
    expect(buildExportFileName(["2026-01-01"])).toBe("staffing-2026-01.xlsx");
  });
});

describe("buildStaffingWorkbook", () => {
  const input = inputWith({
    "mission:m1|2026-01-01|u-alice": 5,
    "transverse:t1|2026-02-01|u-bob": 2,
  });

  it("cree un onglet Grille et un onglet Detail", async () => {
    const wb = await buildStaffingWorkbook(input);

    expect(wb.worksheets.map((ws) => ws.name)).toEqual(["Grille", "Détail"]);
  });

  it("fusionne le libelle du mois au-dessus des colonnes de personnes", async () => {
    const wb = await buildStaffingWorkbook(input);
    const grid = wb.getWorksheet("Grille")!;

    expect(grid.getCell("C1").value).toBe("janv. 26");
    expect(grid.getCell("D1").master.address).toBe("C1");
  });

  it("ecrit les jours planifies dans la cellule du croisement", async () => {
    const wb = await buildStaffingWorkbook(input);
    const grid = wb.getWorksheet("Grille")!;

    expect(grid.getCell("C3").value).toBe(5);
  });

  it("fige les deux lignes d'en-tete et les deux colonnes de libelles", async () => {
    const wb = await buildStaffingWorkbook(input);
    const grid = wb.getWorksheet("Grille")!;

    expect(grid.views[0]).toMatchObject({ state: "frozen", xSplit: 2, ySplit: 2 });
  });

  it("pose un filtre sur l'en-tete de l'onglet Detail", async () => {
    const wb = await buildStaffingWorkbook(input);
    const detail = wb.getWorksheet("Détail")!;

    expect(detail.autoFilter).toBe("A1:H1");
  });
});
