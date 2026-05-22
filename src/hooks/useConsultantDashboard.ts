import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  format,
  parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";

const WEEK_OPTS = { weekStartsOn: 1 as const };
const RECENT_WEEKS_COUNT = 4;
const WEEKLY_BASE_HOURS = 35;

function weekKey(date: Date): string {
  return format(startOfWeek(date, WEEK_OPTS), "yyyy-MM-dd");
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = endOfWeek(weekStart, WEEK_OPTS);
  const startDay = format(weekStart, "d", { locale: fr });
  const endDay = format(weekEnd, "d MMM yyyy", { locale: fr });
  return `${startDay}–${endDay}`;
}

export function useConsultantDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["consultant_dashboard", user?.id],
    queryFn: async () => {
      const now = new Date();
      const currentWeekStart = startOfWeek(now, WEEK_OPTS);
      const earliestWeekStart = startOfWeek(
        subWeeks(now, RECENT_WEEKS_COUNT - 1),
        WEEK_OPTS,
      );

      // ── Saisies des N dernières semaines (inclut la semaine courante)
      const { data: entries, error: e1 } = await supabase
        .from("time_entries")
        .select("hours, entry_date, mission_id, internal_category")
        .eq("user_id", user!.id)
        .gte("entry_date", format(earliestWeekStart, "yyyy-MM-dd"));

      if (e1) throw e1;

      // ── Missions assignées (toutes statuts)
      const { data: assignments, error: e2 } = await supabase
        .from("assignments")
        .select(
          "mission:missions(id, name, client, pole, nature_mission, budget_days, status)",
        )
        .eq("user_id", user!.id);

      if (e2) throw e2;

      // ── Missions où l'user a des time_entries même sans assignment (historique)
      const { data: userMissionEntries, error: e2b } = await supabase
        .from("time_entries")
        .select(
          "mission:missions(id, name, client, pole, nature_mission, budget_days, status)",
        )
        .eq("user_id", user!.id)
        .not("mission_id", "is", null);

      if (e2b) throw e2b;

      // Fusionne par id en évitant les doublons
      const missionById = new Map<string, any>();
      for (const a of assignments ?? []) {
        const m: any = a.mission;
        if (m) missionById.set(m.id, m);
      }
      for (const e of userMissionEntries ?? []) {
        const m: any = e.mission;
        if (m && !missionById.has(m.id)) missionById.set(m.id, m);
      }
      const allAssignedMissions = Array.from(missionById.values());
      const activeMissions = allAssignedMissions.filter((m: any) => m.status === "active");
      const completedMissions = allAssignedMissions.filter((m: any) => m.status === "completed");

      // ── Total heures par mission (pour calculer le % consommé)
      const missionIds = allAssignedMissions.map((m: any) => m.id);
      let hoursByMission = new Map<string, number>();
      if (missionIds.length > 0) {
        const { data: allEntries, error: e3 } = await supabase
          .from("time_entries")
          .select("mission_id, hours")
          .in("mission_id", missionIds);

        if (e3) throw e3;
        for (const e of allEntries ?? []) {
          const prev = hoursByMission.get(e.mission_id as string) ?? 0;
          hoursByMission.set(e.mission_id as string, prev + Number(e.hours));
        }
      }

      // ── KPIs cette semaine
      const thisWeekKey = weekKey(currentWeekStart);
      const thisWeekEntries = (entries ?? []).filter(
        (e: any) => weekKey(parseISO(e.entry_date)) === thisWeekKey,
      );
      const hoursThisWeek = thisWeekEntries.reduce(
        (sum: number, e: any) => sum + Number(e.hours),
        0,
      );
      const clientHoursThisWeek = thisWeekEntries
        .filter((e: any) => e.mission_id)
        .reduce((sum: number, e: any) => sum + Number(e.hours), 0);
      const internalHoursThisWeek = hoursThisWeek - clientHoursThisWeek;
      const charge = Math.round((hoursThisWeek / WEEKLY_BASE_HOURS) * 100);
      const chargeClient = Math.round((clientHoursThisWeek / WEEKLY_BASE_HOURS) * 100);
      const chargeInternal = Math.round((internalHoursThisWeek / WEEKLY_BASE_HOURS) * 100);

      // ── Historique récent : agrège par semaine
      const byWeek = new Map<string, { hours: number; missions: Set<string> }>();
      for (const entry of entries ?? []) {
        const key = weekKey(parseISO(entry.entry_date));
        const prev = byWeek.get(key) ?? { hours: 0, missions: new Set<string>() };
        prev.hours += Number(entry.hours);
        if (entry.mission_id) prev.missions.add(entry.mission_id as string);
        byWeek.set(key, prev);
      }

      const recentWeeks = Array.from({ length: RECENT_WEEKS_COUNT }, (_, i) => {
        const ws = startOfWeek(subWeeks(now, i), WEEK_OPTS);
        const key = format(ws, "yyyy-MM-dd");
        const agg = byWeek.get(key) ?? { hours: 0, missions: new Set<string>() };
        return {
          week: formatWeekLabel(ws),
          hours: Math.round(agg.hours * 10) / 10,
          missions: agg.missions.size,
        };
      });

      // ── Missions affichées avec % budget consommé
      const formatMission = (m: any, statusLabel: string) => {
        const totalHours = hoursByMission.get(m.id) ?? 0;
        const consumedDays = Math.round((totalHours / 7) * 10) / 10;
        const budget = Number(m.budget_days) || 0;
        const percent = budget > 0 ? Math.round((consumedDays / budget) * 100) : 0;
        return {
          id: m.id,
          client: m.client,
          project: m.name,
          nature: m.nature_mission as string | null,
          consumed: consumedDays,
          budgetDays: budget,
          budget: percent,
          status: statusLabel,
        };
      };

      const missions = activeMissions.map((m: any) =>
        formatMission(m, "En cours"),
      ).map((m) => ({ ...m, status: m.budget >= 80 ? "Alerte" : "En cours" }));

      const missionsCompleted = completedMissions.map((m: any) =>
        formatMission(m, "Terminé"),
      );

      return {
        hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
        clientHoursThisWeek: Math.round(clientHoursThisWeek * 10) / 10,
        internalHoursThisWeek: Math.round(internalHoursThisWeek * 10) / 10,
        activeMissionsCount: activeMissions.length,
        charge,
        chargeClient,
        chargeInternal,
        weeklyBase: WEEKLY_BASE_HOURS,
        recentWeeks,
        missions,
        missionsCompleted,
      };
    },
    enabled: !!user,
  });
}
