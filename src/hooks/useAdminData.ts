import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { defaultPeriodValue, type PeriodValue } from "@/components/PeriodSelector";

export function useAdminStats(value: PeriodValue = defaultPeriodValue("month")) {
  return useQuery({
    queryKey: ["admin_stats", value.start, value.end],
    queryFn: async () => {
      const start = value.start;
      const end = value.end;
      const period = value.period;

      const [
        { data: periodEntries },
        { data: activeMissions },
      ] = await Promise.all([
        supabase
          .from("time_entries")
          .select("hours, mission_id, user_id, internal_category, user:profiles(full_name)")
          .gte("entry_date", start)
          .lte("entry_date", end),
        supabase.from("missions").select("id").eq("status", "active"),
      ]);

      const totalHours = (periodEntries ?? []).reduce((sum, e) => sum + Number(e.hours), 0);
      const clientHours = (periodEntries ?? []).filter((e) => e.mission_id).reduce((sum, e) => sum + Number(e.hours), 0);
      const internalHours = totalHours - clientHours;
      const percentClient = totalHours > 0 ? Math.round((clientHours / totalHours) * 100) : 0;
      const activeUsers = new Set((periodEntries ?? []).map((e) => e.user_id)).size;

      // Répartition : "Client" en bloc + chaque catégorie interne séparée
      const breakdown = new Map<string, number>();
      if (clientHours > 0) breakdown.set("Client", clientHours);
      for (const entry of periodEntries ?? []) {
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

      // Charge par consultant sur la période
      const byUser = new Map<string, { name: string; client: number; internal: number }>();
      for (const entry of periodEntries ?? []) {
        const name = (entry.user as any)?.full_name ?? "Inconnu";
        const prev = byUser.get(entry.user_id) ?? { name, client: 0, internal: 0 };
        if (entry.mission_id) prev.client += Number(entry.hours);
        else prev.internal += Number(entry.hours);
        byUser.set(entry.user_id, prev);
      }

      return {
        period,
        periodStart: start,
        periodEnd: end,
        totalHours: Math.round(totalHours),
        activeConsultants: activeUsers,
        activeMissions: (activeMissions ?? []).length,
        percentClient,
        clientHours: Math.round(clientHours * 10) / 10,
        internalHours: Math.round(internalHours * 10) / 10,
        repartition,
        byConsultant: Array.from(byUser.values())
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
