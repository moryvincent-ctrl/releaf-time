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
const ALERT_THRESHOLD = 80;

function weekKey(date: Date): string {
  return format(startOfWeek(date, WEEK_OPTS), "yyyy-MM-dd");
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = endOfWeek(weekStart, WEEK_OPTS);
  return `${format(weekStart, "d", { locale: fr })}–${format(weekEnd, "d MMM yyyy", { locale: fr })}`;
}

function alertLevel(percent: number): "warning" | "critical" | "exceeded" | null {
  if (percent >= 100) return "exceeded";
  if (percent >= 90) return "critical";
  if (percent >= ALERT_THRESHOLD) return "warning";
  return null;
}

export function useManagerDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["manager_dashboard", user?.id],
    queryFn: async () => {
      const now = new Date();
      const currentWeekStart = startOfWeek(now, WEEK_OPTS);
      const earliestWeekStart = startOfWeek(
        subWeeks(now, RECENT_WEEKS_COUNT - 1),
        WEEK_OPTS,
      );

      // ── Ses propres saisies (4 dernières semaines) pour les stats perso
      const { data: ownEntries, error: e1 } = await supabase
        .from("time_entries")
        .select("hours, entry_date, mission_id")
        .eq("user_id", user!.id)
        .gte("entry_date", format(earliestWeekStart, "yyyy-MM-dd"));

      if (e1) throw e1;

      // ── Toutes les missions assignées au user (peu importe le rôle)
      const { data: allAssignments, error: e2 } = await supabase
        .from("assignments")
        .select("mission_id, role_on_mission, mission:missions(*)")
        .eq("user_id", user!.id);

      if (e2) throw e2;

      const allMissions = (allAssignments ?? [])
        .map((a: any) => a.mission)
        .filter((m: any) => m);
      const myActiveAssignedCount = allMissions.filter((m: any) => m.status === "active").length;

      const managedMissionIds = new Set(
        (allAssignments ?? [])
          .filter((a: any) => a.role_on_mission === "Manager")
          .map((a: any) => a.mission_id),
      );

      // ── Heures totales par mission (pour le % consommé)
      const allMissionIds = allMissions.map((m: any) => m.id);
      let hoursByMission = new Map<string, number>();
      if (allMissionIds.length > 0) {
        const { data: missionEntries, error: e5 } = await supabase
          .from("time_entries")
          .select("mission_id, hours")
          .in("mission_id", allMissionIds);
        if (e5) throw e5;
        for (const e of missionEntries ?? []) {
          const prev = hoursByMission.get(e.mission_id as string) ?? 0;
          hoursByMission.set(e.mission_id as string, prev + Number(e.hours));
        }
      }

      // ── Stats semaine perso
      const thisWeekKey = weekKey(currentWeekStart);
      const thisWeekEntries = (ownEntries ?? []).filter(
        (e: any) => weekKey(parseISO(e.entry_date)) === thisWeekKey,
      );
      const hoursThisWeek = thisWeekEntries.reduce(
        (s: number, e: any) => s + Number(e.hours), 0,
      );
      const clientHoursThisWeek = thisWeekEntries
        .filter((e: any) => e.mission_id)
        .reduce((s: number, e: any) => s + Number(e.hours), 0);
      const internalHoursThisWeek = hoursThisWeek - clientHoursThisWeek;
      const charge = Math.round((hoursThisWeek / WEEKLY_BASE_HOURS) * 100);
      const chargeClient = Math.round((clientHoursThisWeek / WEEKLY_BASE_HOURS) * 100);
      const chargeInternal = Math.round((internalHoursThisWeek / WEEKLY_BASE_HOURS) * 100);

      // ── Historique récent (ses propres saisies)
      const byWeek = new Map<string, { hours: number; missions: Set<string> }>();
      for (const entry of ownEntries ?? []) {
        const key = weekKey(parseISO(entry.entry_date));
        const prev = byWeek.get(key) ?? { hours: 0, missions: new Set<string>() };
        prev.hours += Number(entry.hours);
        if (entry.mission_id) prev.missions.add(entry.mission_id as string);
        byWeek.set(key, prev);
      }
      const recentWeeks = Array.from({ length: RECENT_WEEKS_COUNT }, (_, i) => {
        const ws = startOfWeek(subWeeks(now, i), WEEK_OPTS);
        const agg = byWeek.get(format(ws, "yyyy-MM-dd")) ?? { hours: 0, missions: new Set<string>() };
        return {
          week: formatWeekLabel(ws),
          hours: Math.round(agg.hours * 10) / 10,
          missions: agg.missions.size,
        };
      });

      // ── Missions formatées avec budget consommé
      const formatMission = (m: any) => {
        const totalHours = hoursByMission.get(m.id) ?? 0;
        const consumedDays = Math.round((totalHours / 7) * 10) / 10;
        const budgetDays = Number(m.budget_days) || 0;
        const percent = budgetDays > 0 ? Math.round((consumedDays / budgetDays) * 100) : 0;
        return {
          id: m.id,
          client: m.client,
          project: m.name,
          nature: m.nature_mission as string | null,
          consumed: consumedDays,
          budgetDays,
          budget: percent,
          status: m.status as "active" | "completed" | "on_hold",
          alert: alertLevel(percent),
          isManaged: managedMissionIds.has(m.id),
        };
      };

      const missions = allMissions
        .filter((m: any) => m.status === "active")
        .map(formatMission);
      const missionsCompleted = allMissions
        .filter((m: any) => m.status === "completed")
        .map(formatMission);

      // Alertes uniquement sur les missions qu'il gère (role=Manager)
      const alerts = missions.filter((m) => m.isManaged && m.alert !== null);

      return {
        hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
        clientHoursThisWeek: Math.round(clientHoursThisWeek * 10) / 10,
        internalHoursThisWeek: Math.round(internalHoursThisWeek * 10) / 10,
        activeMissionsCount: myActiveAssignedCount,
        charge,
        chargeClient,
        chargeInternal,
        weeklyBase: WEEKLY_BASE_HOURS,
        recentWeeks,
        missions,
        missionsCompleted,
        alerts,
      };
    },
    enabled: !!user,
  });
}
