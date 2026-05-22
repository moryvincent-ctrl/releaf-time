import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

function firstNameInitial(name: string): string {
  return (name.split(" ")[0]?.[0] ?? "?").toUpperCase();
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd/MM/yyyy");
  } catch {
    return "—";
  }
}

export function useAllMissions() {
  return useQuery({
    queryKey: ["all_missions"],
    queryFn: async () => {
      const [
        { data: missions, error: e1 },
        { data: assignments, error: e2 },
        { data: entries, error: e3 },
      ] = await Promise.all([
        supabase
          .from("missions")
          .select("*, manager:profiles!manager_id(full_name)")
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        supabase
          .from("assignments")
          .select("mission_id, user_id, role_on_mission, user:profiles(full_name)"),
        supabase.from("time_entries").select("mission_id, hours"),
      ]);

      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;

      return (missions ?? []).map((mission: any) => {
        const missionEntries = (entries ?? []).filter((e: any) => e.mission_id === mission.id);
        const missionAssignments = (assignments ?? []).filter((a: any) => a.mission_id === mission.id);

        const totalHours = missionEntries.reduce((sum: number, e: any) => sum + Number(e.hours), 0);
        const consumedDays = Math.round((totalHours / 7) * 10) / 10;
        const budgetDays = Number(mission.budget_days);
        const percent = budgetDays > 0 ? Math.round((consumedDays / budgetDays) * 100) : 0;

        const consultants = missionAssignments.map((a: any) => {
          const name = a.user?.full_name ?? "Inconnu";
          return { name, initials: initialsOf(name) };
        });

        const managerNames = missionAssignments
          .filter((a: any) => a.role_on_mission === "Manager")
          .map((a: any) => a.user?.full_name)
          .filter(Boolean) as string[];
        const managerLabel = managerNames.length > 0
          ? managerNames.join(", ")
          : (mission.manager as any)?.full_name ?? "—";

        return {
          id: mission.id,
          client: mission.client,
          project: mission.name,
          pole: mission.pole,
          manager: managerLabel,
          startDate: formatDate(mission.start_date),
          endDate: formatDate(mission.end_date),
          budgetTotal: budgetDays,
          consumed: consumedDays,
          percent,
          consultants,
        };
      });
    },
  });
}

export function useMissionDetail(missionId: string | undefined) {
  return useQuery({
    queryKey: ["mission_detail", missionId],
    queryFn: async () => {
      if (!missionId) return null;

      const [
        { data: mission, error: e1 },
        { data: assignments, error: e2 },
        { data: entries, error: e3 },
      ] = await Promise.all([
        supabase
          .from("missions")
          .select("*, manager:profiles!manager_id(full_name)")
          .eq("id", missionId)
          .single(),
        supabase
          .from("assignments")
          .select("id, user_id, role_on_mission, budget_days_allocated, user:profiles(full_name, avatar_url)")
          .eq("mission_id", missionId),
        supabase
          .from("time_entries")
          .select("entry_date, hours, comment, user_id, user:profiles(full_name, avatar_url)")
          .eq("mission_id", missionId)
          .order("entry_date", { ascending: false }),
      ]);

      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      if (!mission) return null;

      const totalHours = (entries ?? []).reduce((sum: number, e: any) => sum + Number(e.hours), 0);
      const budgetTotal = Number(mission.budget_days);
      const consumed = Math.round((totalHours / 7) * 10) / 10;

      const consultantCount = (assignments ?? []).length || 1;
      const defaultPerConsultant = budgetTotal / consultantCount;

      const consultants = (assignments ?? []).map((a: any) => {
        const name = a.user?.full_name ?? "Inconnu";
        const userEntries = (entries ?? []).filter((e: any) => e.user_id === a.user_id);
        const userHours = userEntries.reduce((sum: number, e: any) => sum + Number(e.hours), 0);
        const userConsumedDays = Math.round((userHours / 7) * 10) / 10;
        // Budget alloué : valeur explicite si saisie, sinon part égale du total
        const explicit = a.budget_days_allocated != null ? Number(a.budget_days_allocated) : null;
        const budget = explicit ?? defaultPerConsultant;
        return {
          assignmentId: a.id as string,
          name,
          initial: firstNameInitial(name),
          avatarUrl: (a.user?.avatar_url as string | null) ?? null,
          hours: Math.round(userHours * 10) / 10,
          budget: Math.round(budget * 10) / 10,
          budgetOverride: explicit,
          consumed: userConsumedDays,
          role: a.role_on_mission,
        };
      });

      const formattedEntries = (entries ?? []).map((e: any) => ({
        date: formatDate(e.entry_date),
        consultant: e.user?.full_name ?? "Inconnu",
        hours: Number(e.hours),
        comment: e.comment ?? "",
      }));

      // Le champ manager_id n'est pas renseigné par la sync Notion : on déduit le manager
      // depuis l'assignment avec role_on_mission = "Manager" (peut être plusieurs).
      const managerNames = (assignments ?? [])
        .filter((a: any) => a.role_on_mission === "Manager")
        .map((a: any) => a.user?.full_name)
        .filter(Boolean) as string[];
      const managerLabel = managerNames.length > 0
        ? managerNames.join(", ")
        : (mission.manager as any)?.full_name ?? "—";

      return {
        id: mission.id,
        client: mission.client,
        project: mission.name,
        pole: mission.pole,
        manager: managerLabel,
        startDate: formatDate(mission.start_date),
        endDate: formatDate(mission.end_date),
        status: mission.status,
        budgetTotal,
        consumed,
        consultants,
        entries: formattedEntries,
      };
    },
    enabled: !!missionId,
  });
}
