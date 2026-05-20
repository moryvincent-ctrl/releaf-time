import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

function getAlerts(percent: number, consumed: number, budget: number): string[] {
  if (consumed > budget) return ["exceeded"];
  if (percent >= 90) return ["critical"];
  if (percent >= 75) return ["warning"];
  return [];
}

export function useManagerMissions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["manager_missions", user?.id],
    queryFn: async () => {
      const { data: managerAssignments, error: e1 } = await supabase
        .from("assignments")
        .select("mission_id")
        .eq("user_id", user!.id)
        .eq("role_on_mission", "Manager");

      if (e1) throw e1;

      const missionIds = (managerAssignments ?? []).map((a: any) => a.mission_id);
      if (missionIds.length === 0) return [];

      const [
        { data: missions, error: e2 },
        { data: assignments, error: e3 },
        { data: entries, error: e4 },
      ] = await Promise.all([
        supabase.from("missions").select("*").in("id", missionIds).eq("status", "active"),
        supabase.from("assignments").select("mission_id, user_id, role_on_mission, user:profiles(full_name)").in("mission_id", missionIds),
        supabase.from("time_entries").select("mission_id, user_id, hours").in("mission_id", missionIds),
      ]);

      if (e2) throw e2;
      if (e3) throw e3;
      if (e4) throw e4;

      return (missions ?? []).map((mission: any) => {
        const missionEntries = (entries ?? []).filter((e: any) => e.mission_id === mission.id);
        const missionAssignments = (assignments ?? []).filter((a: any) => a.mission_id === mission.id);

        const totalHours = missionEntries.reduce((sum: number, e: any) => sum + Number(e.hours), 0);
        const consumed = totalHours / 8;
        const budget = Number(mission.budget_days);
        const percent = budget > 0 ? Math.round((consumed / budget) * 100) : 0;

        const byUser = new Map<string, { name: string; hours: number }>();
        for (const entry of missionEntries) {
          const assgn = missionAssignments.find((a: any) => a.user_id === entry.user_id);
          const name = (assgn?.user as any)?.full_name ?? "Inconnu";
          const prev = byUser.get(entry.user_id) ?? { name, hours: 0 };
          byUser.set(entry.user_id, { name, hours: prev.hours + Number(entry.hours) });
        }

        return {
          ...mission,
          consumed_days: Math.round(consumed * 10) / 10,
          percent,
          consultants: Array.from(byUser.values()).map((c) => ({
            name: c.name,
            hours: c.hours,
            percent: budget > 0 ? Math.round((c.hours / 8 / budget) * 100) : 0,
          })),
          alerts: getAlerts(percent, consumed, budget),
        };
      });
    },
    enabled: !!user,
  });
}
