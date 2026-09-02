import { describe, it, expect } from "vitest";
import { staffingPeopleFor } from "@/hooks/useStaffing";
import type { Role } from "@/lib/database.types";

type P = { id: string; full_name: string; role: Role; active?: boolean };

const arthur: P = { id: "u-arthur", full_name: "Arthur Dercq", role: "manager" };
const thomas: P = { id: "u-thomas", full_name: "Thomas Schmitt", role: "manager" };
const evane: P = { id: "u-evane", full_name: "Evane Durand", role: "consultant" };
const admin: P = { id: "u-admin", full_name: "Vincent Mory", role: "admin" };
const parti: P = { id: "u-hugo", full_name: "Hugo Astier (parti)", role: "consultant", active: false };

const team = [evane, admin, parti, thomas, arthur];

describe("staffingPeopleFor", () => {
  it("donne toute l'équipe à un admin", () => {
    const ids = staffingPeopleFor(team, "admin", admin.id).map((p) => p.id);
    expect(ids).toContain(evane.id);
    expect(ids).toContain(arthur.id);
    expect(ids).toContain(admin.id);
  });

  it("donne à un manager exactement le même périmètre qu'à un admin", () => {
    const asAdmin = staffingPeopleFor(team, "admin", admin.id).map((p) => p.id);
    const asManager = staffingPeopleFor(team, "manager", arthur.id).map((p) => p.id);
    expect(asManager).toEqual(asAdmin);
  });

  it("exclut les personnes parties, indépendamment de leur nom", () => {
    const ids = staffingPeopleFor(
      [...team, { id: "u-j", full_name: "N'importe quoi", role: "consultant" as Role, active: false }],
      "admin",
      admin.id,
    ).map((p) => p.id);
    expect(ids).not.toContain(parti.id);
    expect(ids).not.toContain("u-j");
  });

  // Le front peut être déployé avant que profiles_active.sql ne soit passée :
  // sans la colonne, personne ne doit disparaître de la grille.
  it("garde tout le monde quand la colonne active n'existe pas encore", () => {
    const sansColonne = team.map(({ active, ...p }) => p);
    expect(staffingPeopleFor(sansColonne, "admin", admin.id)).toHaveLength(team.length);
  });

  it("n'exclut une personne partie que du staffing, sans toucher au consultant lui-même", () => {
    // Un consultant desactive garde acces a sa propre colonne : on ne bloque pas
    // la lecture de son planning, on l'enleve seulement de la vue d'equipe.
    expect(staffingPeopleFor(team, "consultant", parti.id)).toEqual([parti]);
  });

  it("trie l'équipe par nom", () => {
    const names = staffingPeopleFor(team, "admin", admin.id).map((p) => p.full_name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("réduit un consultant à sa seule colonne", () => {
    expect(staffingPeopleFor(team, "consultant", evane.id)).toEqual([evane]);
  });

  it("ne montre personne tant que le profil du consultant n'est pas chargé", () => {
    expect(staffingPeopleFor(team, "consultant", undefined)).toEqual([]);
    expect(staffingPeopleFor(team, undefined, undefined)).toEqual([]);
  });

  it("ne s'ouvre pas à toute l'équipe si le rôle est absent mais l'id connu", () => {
    expect(staffingPeopleFor(team, undefined, evane.id)).toEqual([evane]);
  });
});
