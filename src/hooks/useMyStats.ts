import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, format } from "date-fns";

export function useMyStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my_stats", user?.id],
    queryFn: async () => {
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

      const [
        { data: allEntries, error: e1 },
        { data: assignments, error: e2 },
      ] = await Promise.all([
        supabase
          .from("time_entries")
          .select("hours, mission_id, internal_category, entry_date")
          .eq("user_id", user!.id),
        supabase
          .from("assignments")
          .select("mission:missions(id, status)")
          .eq("user_id", user!.id),
      ]);

      if (e1) throw e1;
      if (e2) throw e2;

      const entries = allEntries ?? [];
      const totalHours = entries.reduce((s, e) => s + Number(e.hours), 0);
      const monthEntries = entries.filter((e) => e.entry_date >= monthStart);
      const monthHours = monthEntries.reduce((s, e) => s + Number(e.hours), 0);
      const clientHours = entries.filter((e) => e.mission_id).reduce((s, e) => s + Number(e.hours), 0);
      const internalHours = totalHours - clientHours;
      const percentClient = totalHours > 0 ? Math.round((clientHours / totalHours) * 100) : 0;

      const distinctMissions = new Set(entries.filter((e) => e.mission_id).map((e) => e.mission_id)).size;
      const activeAssignments = (assignments ?? [])
        .map((a: any) => a.mission)
        .filter((m: any) => m && m.status === "active").length;

      return {
        totalHours: Math.round(totalHours * 10) / 10,
        monthHours: Math.round(monthHours * 10) / 10,
        clientHours: Math.round(clientHours * 10) / 10,
        internalHours: Math.round(internalHours * 10) / 10,
        percentClient,
        distinctMissions,
        activeAssignments,
      };
    },
    enabled: !!user,
  });
}
