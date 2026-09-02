import { describe, it, expect } from "vitest";
import { staffingPeopleFor } from "@/hooks/useStaffing";
import type { Role } from "@/lib/database.types";

type P = { id: string; full_name: string; role: Role };

const arthur: P = { id: "u-arthur", full_name: "Arthur Dercq", role: "manager" };
const thomas: P = { id: "u-thomas", full_name: "Thomas Schmitt", role: "manager" };
const evane: P = { id: "u-evane", full_name: "Evane Durand", role: "consultant" };
const admin: P = { id: "u-admin", full_name: "Vincent Mory", role: "admin" };
const parti: P = { id: "u-hugo", full_name: "Hugo Astier", role: "consultant" };

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

  it("exclut les collaborateurs partis, quelle que soit la casse du nom", () => {
    const ids = staffingPeopleFor(
      [...team, { id: "u-j", full_name: "  Juliette   BLANC ", role: "consultant" as Role }],
      "admin",
      admin.id,
    ).map((p) => p.id);
    expect(ids).not.toContain(parti.id);
    expect(ids).not.toContain("u-j");
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
