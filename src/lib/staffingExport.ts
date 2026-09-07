// Construction du classeur Excel exporte depuis la vue Staffing.
//
// Les fonctions de construction sont pures : elles ne touchent ni au reseau, ni
// a la base, ni au DOM. Elles se testent donc sans navigateur, et ce module
// n'importe volontairement pas les hooks Supabase pour rester autonome.

import type { Workbook } from "exceljs";

export type ExportPerson = {
  id: string;
  full_name: string;
  role: string;
};

export type ExportTarget = {
  key: string;                      // "mission:<id>" ou "transverse:<id>"
  type: "mission" | "transverse";
  label: string;                    // nom de la mission ou du projet transverse
  client: string;                   // vide pour un projet transverse
  pole: string;                     // vide pour un projet transverse
};

export type StaffingExportInput = {
  months: string[];                 // 1er du mois, au format "YYYY-MM-01"
  people: ExportPerson[];
  targets: ExportTarget[];
  // Jours planifies pour un croisement cible x mois x personne.
  getDays: (targetKey: string, month: string, personId: string) => number;
};

// Une cellule de grille : texte, nombre de jours, ou vide.
export type GridCell = string | number | null;

const MONTHS_SHORT = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

// Libelle court "juil. 26". Midi evite tout decalage de fuseau horaire.
export function formatMonthLabel(month: string): string {
  const d = new Date(month + "T12:00:00");
  return `${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

// "2026-01-01" -> "2026-01"
const monthKey = (month: string) => month.slice(0, 7);

// Colonne "Client" : le client pour une mission, un libelle fixe sinon.
const clientCell = (t: ExportTarget) => (t.type === "mission" ? t.client : "Transverse");

const typeLabel = (t: ExportTarget) => (t.type === "mission" ? "Mission" : "Transverse");

// Une cible n'est exportee que si elle porte au moins une saisie sur la fenetre :
// exporter les lignes vides de la grille de saisie n'apporterait que du bruit.
function hasAnyDays(input: StaffingExportInput, target: ExportTarget): boolean {
  return input.months.some((m) => input.people.some((p) => input.getDays(target.key, m, p.id) > 0));
}

// Onglet "Grille" : reproduit l'ecran, avec les mois au-dessus des personnes.
export function buildGridRows(input: StaffingExportInput): GridCell[][] {
  const { months, people, targets, getDays } = input;

  // Ligne 1 : le mois n'est ecrit qu'une fois, sur la premiere de ses colonnes.
  // Les cellules laissees vides seront fusionnees avec elle dans le classeur.
  const monthHeader: GridCell[] = ["", ""];
  for (const month of months) {
    monthHeader.push(formatMonthLabel(month));
    for (let i = 1; i < people.length; i++) monthHeader.push(null);
  }

  const peopleHeader: GridCell[] = ["Client", "Mission / Projet"];
  for (const _month of months) for (const p of people) peopleHeader.push(p.full_name);

  const rows = targets
    .filter((t) => hasAnyDays(input, t))
    .map((t) => {
      const row: GridCell[] = [clientCell(t), t.label];
      for (const month of months) {
        for (const p of people) {
          const days = getDays(t.key, month, p.id);
          row.push(days > 0 ? days : null);
        }
      }
      return row;
    });

  return [monthHeader, peopleHeader, ...rows];
}

// Onglet "Detail" : une ligne par allocation, exploitable en tableau croise.
export function buildDetailRows(input: StaffingExportInput): (string | number)[][] {
  const { months, people, targets, getDays } = input;

  const rows: (string | number)[][] = [
    ["Personne", "Rôle", "Type", "Cible", "Client", "Pôle", "Mois", "Jours"],
  ];

  for (const month of months) {
    for (const t of targets) {
      for (const p of people) {
        const days = getDays(t.key, month, p.id);
        if (days <= 0) continue;
        rows.push([p.full_name, p.role, typeLabel(t), t.label, t.client, t.pole, monthKey(month), days]);
      }
    }
  }

  return rows;
}

export function buildExportFileName(months: string[]): string {
  const first = monthKey(months[0]);
  const last = monthKey(months[months.length - 1]);
  return first === last ? `staffing-${first}.xlsx` : `staffing-${first}_${last}.xlsx`;
}

// ─── Classeur ────────────────────────────────────────────────────────────────

// Construit le classeur a deux onglets. Asynchrone parce qu'ExcelJS est charge
// en import dynamique : la bibliotheque (~1 Mo) n'est telechargee par le
// navigateur qu'au moment de l'export, sans alourdir le demarrage de l'app.
export async function buildStaffingWorkbook(input: StaffingExportInput): Promise<Workbook> {
  // Selon la cible (navigateur ou test Node), ExcelJS s'expose en export par
  // defaut ou directement sur le module ; on accepte les deux formes.
  const mod = (await import("exceljs")) as unknown as { default?: typeof import("exceljs") };
  const ExcelJS = mod.default ?? (mod as unknown as typeof import("exceljs"));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Releaf Time";
  wb.created = new Date();

  const peopleCount = input.people.length;

  // Onglet 1 : la grille, volets figes sur les deux lignes d'en-tete et les
  // deux colonnes de libelles, comme a l'ecran.
  const grid = wb.addWorksheet("Grille", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 2 }],
  });
  for (const row of buildGridRows(input)) grid.addRow(row);

  // Chaque libelle de mois couvre les colonnes de toutes les personnes.
  if (peopleCount > 1) {
    input.months.forEach((_month, i) => {
      const firstCol = 3 + i * peopleCount;
      grid.mergeCells(1, firstCol, 1, firstCol + peopleCount - 1);
    });
  }

  grid.getRow(1).font = { bold: true };
  grid.getRow(1).alignment = { horizontal: "center" };
  grid.getRow(2).font = { bold: true };
  grid.getColumn(1).width = 22;
  grid.getColumn(2).width = 32;
  for (let c = 3; c <= 2 + peopleCount * input.months.length; c++) grid.getColumn(c).width = 14;

  // Onglet 2 : le detail a plat, filtre pour se preter aux tableaux croises.
  const detail = wb.addWorksheet("Détail", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  for (const row of buildDetailRows(input)) detail.addRow(row);
  detail.autoFilter = "A1:H1";
  detail.getRow(1).font = { bold: true };
  detail.columns.forEach((col, i) => {
    col.width = i === 7 ? 8 : 20; // colonne Jours plus etroite
  });

  return wb;
}

// Genere le fichier et le remet au navigateur. Tout se passe cote client :
// aucune donnee n'est envoyee a un serveur tiers.
export async function downloadStaffingWorkbook(input: StaffingExportInput): Promise<void> {
  const wb = await buildStaffingWorkbook(input);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildExportFileName(input.months);
  link.click();
  URL.revokeObjectURL(url);
}
