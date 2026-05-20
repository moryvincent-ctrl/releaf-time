import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from "date-fns";

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin_stats"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
      const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

      const [
        { data: monthEntries },
        { data: activeMissions },
        { data: weekEntries },
      ] = await Promise.all([
        supabase.from("time_entries").select("hours, mission_id, user_id").gte("entry_date", monthStart).lte("entry_date", monthEnd),
        supabase.from("missions").select("id").eq("status", "active"),
        supabase.from("time_entries").select("hours, user_id, user:profiles(full_name)").gte("entry_date", weekStart).lte("entry_date", weekEnd),
      ]);

      const totalHours = (monthEntries ?? []).reduce((sum, e) => sum + Number(e.hours), 0);
      const clientHours = (monthEntries ?? []).filter((e) => e.mission_id).reduce((sum, e) => sum + Number(e.hours), 0);
      const percentClient = totalHours > 0 ? Math.round((clientHours / totalHours) * 100) : 0;
      const activeUsers = new Set((monthEntries ?? []).map((e) => e.user_id)).size;

      const byUser = new Map<string, { name: string; hours: number }>();
      for (const entry of weekEntries ?? []) {
        const name = (entry.user as any)?.full_name ?? "Inconnu";
        const prev = byUser.get(entry.user_id) ?? { name, hours: 0 };
        byUser.set(entry.user_id, { name, hours: prev.hours + Number(entry.hours) });
      }

      return {
        totalHours: Math.round(totalHours),
        activeConsultants: activeUsers,
        activeMissions: (activeMissions ?? []).length,
        percentClient,
        weekByConsultant: Array.from(byUser.values()).map((u) => ({
          name: u.name.split(" ").map((p, i) => (i === 0 ? p[0] + "." : p)).join(" "),
          hours: u.hours,
        })),
      };
    },
  });
}

export function useAdminEntries(filters: { consultant: string; mission: string; date: string }) {
  return useQuery({
    queryKey: ["admin_entries", filters],
    queryFn: async () => {
      let query = supabase
        .from("time_entries")
        .select("id, entry_date, hours, user_id, mission_id, internal_category, user:profiles(full_name), mission:missions(name, client, nature_mission)")
        .order("entry_date", { ascending: false })
        .limit(200);

      if (filters.date) query = query.eq("entry_date", filters.date);

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).filter((e) => {
        const consultantName = (e.user as any)?.full_name ?? "";
        const missionLabel = (e.mission as any)?.name ?? e.internal_category ?? "";
        if (filters.consultant && !consultantName.toLowerCase().includes(filters.consultant.toLowerCase())) return false;
        if (filters.mission && !missionLabel.toLowerCase().includes(filters.mission.toLowerCase())) return false;
        return true;
      });
    },
  });
}
