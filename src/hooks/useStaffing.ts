import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { MissionPole, Role } from "@/lib/database.types";

// ─── Helpers mois ───────────────────────────────────────────────────────────

// Renvoie le 1er du mois (YYYY-MM-01) pour une date donnée.
export function monthStart(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

// Décale un mois (YYYY-MM-01) de n mois.
export function addMonths(month: string, n: number): string {
  const d = new Date(month + "T12:00:00");
  d.setMonth(d.getMonth() + n);
  return monthStart(d);
}

// Construit la fenêtre de `count` mois à partir de `start`.
export function monthWindow(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(start, i));
}

const MONTHS_SHORT = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

// Libellé court "juil. 26"
export function formatMonthLabel(month: string): string {
  const d = new Date(month + "T12:00:00");
  return `${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

// Nombre de jours ouvrés (lun→ven) dans un mois — sert d'indicateur de capacité.
export function businessDaysInMonth(month: string): number {
  const d = new Date(month + "T12:00:00");
  const year = d.getFullYear();
  const m = d.getMonth();
  let count = 0;
  const cursor = new Date(year, m, 1);
  while (cursor.getMonth() === m) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

// Dernier jour du mois (YYYY-MM-DD).
export function monthEndDate(month: string): string {
  const d = new Date(month + "T12:00:00");
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}

// Jours ouvrés d'une absence [begin, end] tombant dans un mois donné — sert à
// déduire les congés de la capacité mensuelle d'une personne.
export function absenceBusinessDaysInMonth(begin: string, end: string, month: string): number {
  const d = new Date(month + "T12:00:00");
  const monthFirst = new Date(d.getFullYear(), d.getMonth(), 1);
  const monthLast = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const b = new Date(begin + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const start = b > monthFirst ? b : monthFirst;
  const stop = e < monthLast ? e : monthLast;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= stop) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

// ─── Données de référence ────────────────────────────────────────────────────

export type StaffingProfile = { id: string; full_name: string; role: Role };

// Anciens collaborateurs à exclure du staffing prévisionnel (ont quitté l'entreprise).
const norm = (s: string) => (s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
const DEPARTED = new Set(["hugo astier", "juliette blanc"]);

// Colonnes du staffing selon le rôle : admin et manager planifient toute l'équipe
// (hors partants), le consultant n'a que sa propre colonne. Tant que son profil
// n'est pas chargé (userId null), on ne renvoie personne plutôt que tout le monde.
export function staffingPeopleFor(
  profiles: StaffingProfile[],
  role: Role | undefined,
  userId: string | null | undefined,
): StaffingProfile[] {
  if (role !== "admin" && role !== "manager") {
    return userId ? profiles.filter((p) => p.id === userId) : [];
  }
  return [...profiles]
    .filter((p) => !DEPARTED.has(norm(p.full_name)))
    .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
}

// Profils staffables. `scopeToUserId` restreint la requête à une seule personne :
// le consultant ne récupère alors pas les noms de ses collègues.
export function useStaffingProfiles(scopeToUserId?: string | null) {
  return useQuery({
    queryKey: ["staffing_profiles", scopeToUserId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, full_name, role");
      if (scopeToUserId) q = q.eq("id", scopeToUserId);
      const { data, error } = await q.order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StaffingProfile[];
    },
  });
}

// Missions staffables : "En cours"/"SAUR" (active) et "En attente" (on_hold).
// Les missions terminées sont exclues du prévisionnel.
export function useStaffableMissions() {
  return useQuery({
    queryKey: ["staffable_missions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("id, name, client, pole, status")
        .in("status", ["active", "on_hold"])
        .order("client", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Projets transverses staffables (actifs ou en attente).
export function useStaffableTransverse() {
  return useQuery({
    queryKey: ["staffable_transverse"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transverse_projects")
        .select("id, name, status")
        .in("status", ["active", "on_hold"])
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Allocations ─────────────────────────────────────────────────────────────

// Allocations planifiées sur une fenêtre [firstMonth, lastMonth] (inclus).
export function useStaffingAllocations(firstMonth: string, lastMonth: string) {
  return useQuery({
    queryKey: ["staffing_allocations", firstMonth, lastMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staffing_allocations")
        .select("id, user_id, mission_id, transverse_project_id, month, planned_days")
        .gte("month", firstMonth)
        .lte("month", lastMonth);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Absences Payfit (congés) ─────────────────────────────────────────────────

// Absences chevauchant la fenêtre [firstMonth, fin de lastMonth]. Résilient :
// si la table n'existe pas encore (migration non passée) ou pas de droits, renvoie [].
export function usePayfitAbsences(firstMonth: string, lastMonth: string) {
  return useQuery({
    queryKey: ["payfit_absences", firstMonth, lastMonth],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("payfit_absences")
          .select("user_id, begin_date, end_date, absence_type")
          .not("user_id", "is", null)
          .lte("begin_date", monthEndDate(lastMonth))
          .gte("end_date", firstMonth);
        if (error) return [];
        return data ?? [];
      } catch {
        return [];
      }
    },
  });
}

type UpsertAllocationPayload = {
  user_id: string;
  mission_id: string | null;
  transverse_project_id: string | null;
  month: string;
  planned_days: number;
};

// Upsert d'une cellule : crée/met à jour si > 0, supprime si remis à 0.
export function useUpsertStaffingAllocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (p: UpsertAllocationPayload) => {
      const matchFilter: Record<string, any> = {
        user_id: p.user_id,
        month: p.month,
        ...(p.mission_id
          ? { mission_id: p.mission_id }
          : { transverse_project_id: p.transverse_project_id }),
      };

      const { data: existing } = await supabase
        .from("staffing_allocations")
        .select("id")
        .match(matchFilter)
        .maybeSingle();

      if (p.planned_days <= 0) {
        if (existing) {
          const { error } = await supabase
            .from("staffing_allocations")
            .delete()
            .eq("id", existing.id);
          if (error) throw error;
        }
        return;
      }

      if (existing) {
        const { error } = await supabase
          .from("staffing_allocations")
          .update({ planned_days: p.planned_days, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("staffing_allocations").insert({
          user_id: p.user_id,
          mission_id: p.mission_id,
          transverse_project_id: p.transverse_project_id,
          month: p.month,
          planned_days: p.planned_days,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staffing_allocations"] });
    },
  });
}

// Supprime toutes les allocations d'une (personne, cible) — retire la ligne du planning.
export function useDeleteStaffingRow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (p: { user_id: string; mission_id: string | null; transverse_project_id: string | null }) => {
      let q = supabase.from("staffing_allocations").delete().eq("user_id", p.user_id);
      q = p.mission_id
        ? q.eq("mission_id", p.mission_id)
        : q.eq("transverse_project_id", p.transverse_project_id as string);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staffing_allocations"] });
    },
  });
}

// Supprime toutes les allocations d'une cible (mission/projet) — retire le groupe du planning.
export function useDeleteStaffingTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (p: { mission_id: string | null; transverse_project_id: string | null }) => {
      let q = supabase.from("staffing_allocations").delete();
      q = p.mission_id
        ? q.eq("mission_id", p.mission_id)
        : q.eq("transverse_project_id", p.transverse_project_id as string);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staffing_allocations"] });
    },
  });
}

// Création d'une mission "à la main" (vraie mission, sans notion_id).
export function useCreateManualMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (p: { name: string; client: string; pole: MissionPole; status: "active" | "on_hold" }) => {
      const { data, error } = await supabase
        .from("missions")
        .insert({
          name: p.name,
          client: p.client,
          pole: p.pole,
          status: p.status,
        })
        .select("id, name, client, pole, status")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staffable_missions"] });
    },
  });
}
