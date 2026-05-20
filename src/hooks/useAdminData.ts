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
        supabase.from("time_entries").select("hours, mission_id, user_id, internal_category").gte("entry_date", monthStart).lte("entry_date", monthEnd),
        supabase.from("missions").select("id").eq("status", "active"),
        supabase.from("time_entries").select("hours, user_id, mission_id, user:profiles(full_name)").gte("entry_date", weekStart).lte("entry_date", weekEnd),
      ]);

      const totalHours = (monthEntries ?? []).reduce((sum, e) => sum + Number(e.hours), 0);
      const clientHours = (monthEntries ?? []).filter((e) => e.mission_id).reduce((sum, e) => sum + Number(e.hours), 0);
      const internalHours = totalHours - clientHours;
      const percentClient = totalHours > 0 ? Math.round((clientHours / totalHours) * 100) : 0;
      const activeUsers = new Set((monthEntries ?? []).map((e) => e.user_id)).size;

      // Répartition détaillée : "Client" en bloc + chaque catégorie interne séparée
      const breakdown = new Map<string, number>();
      if (clientHours > 0) breakdown.set("Client", clientHours);
      for (const entry of monthEntries ?? []) {
        if (entry.mission_id) continue;
        const cat = (entry.internal_category as string | null) ?? "Non catégorisé";
        breakdown.set(cat, (breakdown.get(cat) ?? 0) + Number(entry.hours));
      }
      const repartition = Array.from(breakdown.entries())
        .map(([name, hours]) => ({
          name,
          hours: Math.round(hours * 10) / 10,
          percent: totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0,
          isClient: name === "Client",
        }))
        .sort((a, b) => b.hours - a.hours);

      const byUser = new Map<string, { name: string; client: number; internal: number }>();
      for (const entry of weekEntries ?? []) {
        const name = (entry.user as any)?.full_name ?? "Inconnu";
        const prev = byUser.get(entry.user_id) ?? { name, client: 0, internal: 0 };
        if (entry.mission_id) prev.client += Number(entry.hours);
        else prev.internal += Number(entry.hours);
        byUser.set(entry.user_id, prev);
      }

      return {
        totalHours: Math.round(totalHours),
        activeConsultants: activeUsers,
        activeMissions: (activeMissions ?? []).length,
        percentClient,
        clientHours: Math.round(clientHours * 10) / 10,
        internalHours: Math.round(internalHours * 10) / 10,
        repartition,
        weekByConsultant: Array.from(byUser.values())
          .map((u) => {
            const total = u.client + u.internal;
            return {
              name: u.name.split(" ")[0],
              fullName: u.name,
              client: Math.round(u.client * 10) / 10,
              internal: Math.round(u.internal * 10) / 10,
              total: Math.round(total * 10) / 10,
              percentClient: total > 0 ? Math.round((u.client / total) * 100) : 0,
            };
          })
          .sort((a, b) => b.total - a.total),
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
