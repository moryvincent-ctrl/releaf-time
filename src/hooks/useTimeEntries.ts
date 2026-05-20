import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { TimeEntry, InternalCategory } from "@/lib/database.types";

// Calcule le lundi de la semaine pour une date donnée
export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

// Formate une date en YYYY-MM-DD
export function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Retourne les 5 jours ouvrés (lun→ven) d'une semaine
export function getWeekDays(weekStart: string): string[] {
  const start = new Date(weekStart + "T12:00:00");
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toDateString(d);
  });
}

// Formate la semaine en "24 au 28 mars 2025"
export function formatWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + "T12:00:00");
  const end = new Date(weekStart + "T12:00:00");
  end.setDate(end.getDate() + 4);

  const months = [
    "janvier","février","mars","avril","mai","juin",
    "juillet","août","septembre","octobre","novembre","décembre",
  ];
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getDate()} au ${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${months[start.getMonth()]} au ${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useTimeEntries(weekStart: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["time_entries", user?.id, weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*, mission:missions(id, name, client, pole)")
        .eq("user_id", user!.id)
        .eq("week_start", weekStart);

      if (error) throw error;
      return data as (TimeEntry & { mission?: { id: string; name: string; client: string; pole: string } })[];
    },
    enabled: !!user,
  });
}

export function useAssignedMissions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["assigned_missions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("mission:missions(id, name, client, pole, nature_mission, status)")
        .eq("user_id", user!.id);

      if (error) throw error;
      return (data ?? [])
        .map((a: any) => a.mission)
        .filter((m: any) => m && m.status === "active");
    },
    enabled: !!user,
  });
}

// Upsert : crée ou met à jour une saisie (mission ou interne)
type UpsertPayload = {
  mission_id?: string | null;
  internal_category?: InternalCategory | null;
  entry_date: string;
  hours: number;
  comment?: string;
  week_start: string;
};

export function useUpsertTimeEntry() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpsertPayload) => {
      // Cherche si une entrée existe déjà pour ce user/date/source
      const matchFilter = payload.mission_id
        ? { user_id: user!.id, entry_date: payload.entry_date, mission_id: payload.mission_id }
        : { user_id: user!.id, entry_date: payload.entry_date, internal_category: payload.internal_category };

      const { data: existing } = await supabase
        .from("time_entries")
        .select("id")
        .match(matchFilter)
        .maybeSingle();

      if (existing) {
        // Update
        const { error } = await supabase
          .from("time_entries")
          .update({ hours: payload.hours, comment: payload.comment ?? null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Insert (seulement si hours > 0)
        if (payload.hours <= 0) return;
        const { error } = await supabase.from("time_entries").insert({
          user_id: user!.id,
          mission_id: payload.mission_id ?? null,
          internal_category: payload.internal_category ?? null,
          entry_date: payload.entry_date,
          hours: payload.hours,
          comment: payload.comment ?? null,
          week_start: payload.week_start,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["time_entries", user?.id, variables.week_start] });
    },
  });
}
