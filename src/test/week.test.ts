import { describe, it, expect } from "vitest";
import { getWeekStart, toDateString, getWeekDays } from "@/hooks/useTimeEntries";

// Ces tests supposent TZ=Europe/Paris (fixé par le script `npm test`), sans quoi
// ils ne prouveraient rien : le bug qu'ils verrouillent ne se manifeste qu'à l'est
// de Greenwich, quand toISOString() fait reculer la date d'un jour.
describe("fuseau horaire", () => {
  it("tourne bien en Europe/Paris", () => {
    expect(new Date("2025-08-12T00:30:00").getTimezoneOffset()).toBe(-120); // UTC+2 en été
    expect(new Date("2025-01-07T00:30:00").getTimezoneOffset()).toBe(-60); // UTC+1 en hiver
  });
});

describe("getWeekStart", () => {
  // Le cœur de la régression : une saisie faite entre minuit et 2h renvoyait le
  // dimanche (2025-08-10) au lieu du lundi, rendant la semaine introuvable.
  it("renvoie le lundi quelle que soit l'heure de la journée", () => {
    const mardi = "2025-08-12";
    for (const h of ["00:00", "00:30", "01:59", "02:30", "09:00", "14:00", "23:59"]) {
      expect(getWeekStart(new Date(`${mardi}T${h}:00`))).toBe("2025-08-11");
    }
  });

  it("gère le dimanche comme dernier jour de la semaine précédente", () => {
    expect(getWeekStart(new Date("2025-08-17T10:00:00"))).toBe("2025-08-11");
    expect(getWeekStart(new Date("2025-08-17T00:30:00"))).toBe("2025-08-11");
  });

  it("reste correct en heure d'hiver", () => {
    expect(getWeekStart(new Date("2025-01-07T00:30:00"))).toBe("2025-01-06");
    expect(getWeekStart(new Date("2025-01-07T09:00:00"))).toBe("2025-01-06");
  });

  it("franchit les bornes de mois et d'année", () => {
    // Lundi 1er septembre : le lundi, c'est lui-même.
    expect(getWeekStart(new Date("2025-09-01T00:30:00"))).toBe("2025-09-01");
    // Jeudi 1er janvier 2026 -> lundi 29 décembre 2025.
    expect(getWeekStart(new Date("2026-01-01T00:30:00"))).toBe("2025-12-29");
  });

  it("est idempotent : le lundi d'un lundi est ce lundi", () => {
    const lundi = getWeekStart(new Date("2025-08-12T00:30:00"));
    expect(getWeekStart(new Date(`${lundi}T12:00:00`))).toBe(lundi);
    expect(getWeekStart(new Date(`${lundi}T00:30:00`))).toBe(lundi);
  });

  it("renvoie toujours un lundi, sur une année entière et à toute heure", () => {
    const d = new Date("2025-01-01T00:30:00");
    for (let i = 0; i < 365; i++) {
      const ws = getWeekStart(d);
      // Relu à midi pour que l'assertion elle-même ne dépende pas du fuseau.
      expect(new Date(`${ws}T12:00:00`).getDay()).toBe(1);
      d.setDate(d.getDate() + 1);
    }
  });
});

describe("toDateString", () => {
  it("ne recule pas d'un jour aux petites heures", () => {
    expect(toDateString(new Date("2025-08-12T00:30:00"))).toBe("2025-08-12");
    expect(toDateString(new Date("2025-08-12T23:30:00"))).toBe("2025-08-12");
    expect(toDateString(new Date("2025-01-07T00:30:00"))).toBe("2025-01-07");
  });
});

describe("getWeekDays", () => {
  it("renvoie les 5 jours ouvrés du lundi au vendredi", () => {
    expect(getWeekDays("2025-08-11")).toEqual([
      "2025-08-11",
      "2025-08-12",
      "2025-08-13",
      "2025-08-14",
      "2025-08-15",
    ]);
  });

  it("reste cohérent avec getWeekStart : chaque jour retombe sur sa semaine", () => {
    const weekStart = "2025-08-11";
    for (const day of getWeekDays(weekStart)) {
      expect(getWeekStart(new Date(`${day}T00:30:00`))).toBe(weekStart);
    }
  });
});
