import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subWeeks,
  subMonths,
  subYears,
  format,
  parseISO,
  differenceInCalendarDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { type Period, getPeriodBounds } from "@/components/PeriodSelector";

const WEEK_OPTS = { weekStartsOn: 1 as const };
const RECENT_BUCKETS_COUNT = 4;
const WEEKLY_BASE_HOURS = 35;
const ALERT_THRESHOLD = 80;

function bucketStart(period: Period, ref: Date): Date {
  if (period === "week") return startOfWeek(ref, WEEK_OPTS);
  if (period === "month") return startOfMonth(ref);
  return startOfYear(ref);
}

function subPeriod(period: Period, ref: Date, n: number): Date {
  if (period === "week") return subWeeks(ref, n);
  if (period === "month") return subMonths(ref, n);
  return subYears(ref, n);
}

function bucketKey(period: Period, date: Date): string {
  return format(bucketStart(period, date), "yyyy-MM-dd");
}

function formatBucketLabel(period: Period, start: Date): string {
  if (period === "week") {
    const end = endOfWeek(start, WEEK_OPTS);
    return `${format(start, "d", { locale: fr })}–${format(end, "d MMM yyyy", { locale: fr })}`;
  }
  if (period === "month") return format(start, "MMMM yyyy", { locale: fr });
  return format(start, "yyyy");
}

function referenceHours(start: string, end: string): number {
  const days = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  return Math.round((days / 7) * WEEKLY_BASE_HOURS);
}

function alertLevel(percent: number): "warning" | "critical" | "exceeded" | null {
  if (percent >= 100) return "exceeded";
  if (percent >= 90) return "critical";
  if (percent >= ALERT_THRESHOLD) return "warning";
  return null;
}

export function useManagerDashboard(period: Period = "week") {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["manager_dashboard", user?.id, period],
    queryFn: async () => {
      const now = new Date();
      const { start, end } = getPeriodBounds(period, now);
      const earliestStart = bucketStart(period, subPeriod(period, now, RECENT_BUCKETS_COUNT - 1));
      const earliestStr = format(earliestStart, "yyyy-MM-dd");

      // ── Ses propres saisies (sur l'historique)
      const { data: ownEntries, error: e1 } = await supabase
        .from("time_entries")
        .select("hours, entry_date, mission_id")
        .eq("user_id", user!.id)
        .gte("entry_date", earliestStr)
        .lte("entry_date", end);
      if (e1) throw e1;

      // ── Toutes les missions assignées au user
      const { data: allAssignments, error: e2 } = await supabase
        .from("assignments")
        .select("mission_id, role_on_mission, mission:missions(*)")
        .eq("user_id", user!.id);
      if (e2) throw e2;

      // ── Missions où l'user a des time_entries (sans assignment)
      const { data: userMissionEntries, error: e2b } = await supabase
        .from("time_entries")
        .select("mission:missions(*)")
        .eq("user_id", user!.id)
        .not("mission_id", "is", null);
      if (e2b) throw e2b;

      const missionById = new Map<string, any>();
      for (const a of allAssignments ?? []) {
        const m: any = a.mission;
        if (m) missionById.set(m.id, m);
      }
      for (const e of userMissionEntries ?? []) {
        const m: any = e.mission;
        if (m && !missionById.has(m.id)) missionById.set(m.id, m);
      }
      const allMissions = Array.from(missionById.values());
      const myActiveAssignedCount = allMissions.filter((m: any) => m.status === "active").length;
      const managedMissionIds = new Set(
        (allAssignments ?? [])
          .filter((a: any) => a.role_on_mission === "Manager")
          .map((a: any) => a.mission_id),
      );

      // ── Heures totales par mission (pour le % consommé global)
      const allMissionIds = allMissions.map((m: any) => m.id);
      const hoursByMission = new Map<string, number>();
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

      // ── KPIs sur la période courante
      const periodEntries = (ownEntries ?? []).filter(
        (e: any) => e.entry_date >= start && e.entry_date <= end,
      );
      const hoursThisPeriod = periodEntries.reduce((s: number, e: any) => s + Number(e.hours), 0);
      const clientHoursThisPeriod = periodEntries
        .filter((e: any) => e.mission_id)
        .reduce((s: number, e: any) => s + Number(e.hours), 0);
      const internalHoursThisPeriod = hoursThisPeriod - clientHoursThisPeriod;
      const refHours = referenceHours(start, end);
      const charge = refHours > 0 ? Math.round((hoursThisPeriod / refHours) * 100) : 0;
      const chargeClient = refHours > 0 ? Math.round((clientHoursThisPeriod / refHours) * 100) : 0;
      const chargeInternal = refHours > 0 ? Math.round((internalHoursThisPeriod / refHours) * 100) : 0;

      // ── Historique récent par bucket
      const byBucket = new Map<string, { hours: number; missions: Set<string> }>();
      for (const entry of ownEntries ?? []) {
        const key = bucketKey(period, parseISO(entry.entry_date));
        const prev = byBucket.get(key) ?? { hours: 0, missions: new Set<string>() };
        prev.hours += Number(entry.hours);
        if (entry.mission_id) prev.missions.add(entry.mission_id as string);
        byBucket.set(key, prev);
      }
      const recentBuckets = Array.from({ length: RECENT_BUCKETS_COUNT }, (_, i) => {
        const refDate = subPeriod(period, now, i);
        const bStart = bucketStart(period, refDate);
        const agg = byBucket.get(format(bStart, "yyyy-MM-dd")) ?? { hours: 0, missions: new Set<string>() };
        return {
          label: formatBucketLabel(period, bStart),
          hours: Math.round(agg.hours * 10) / 10,
          missions: agg.missions.size,
        };
      });

      // ── Missions formatées
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

      const missions = allMissions.filter((m: any) => m.status === "active").map(formatMission);
      const missionsCompleted = allMissions.filter((m: any) => m.status === "completed").map(formatMission);
      const alerts = missions.filter((m) => m.isManaged && m.alert !== null);

      return {
        period,
        hoursThisWeek: Math.round(hoursThisPeriod * 10) / 10,
        clientHoursThisWeek: Math.round(clientHoursThisPeriod * 10) / 10,
        internalHoursThisWeek: Math.round(internalHoursThisPeriod * 10) / 10,
        activeMissionsCount: myActiveAssignedCount,
        charge,
        chargeClient,
        chargeInternal,
        weeklyBase: refHours,
        recentWeeks: recentBuckets,
        missions,
        missionsCompleted,
        alerts,
      };
    },
    enabled: !!user,
  });
}
