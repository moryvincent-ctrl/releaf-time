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
import { type Period, type PeriodValue, defaultPeriodValue } from "@/components/PeriodSelector";

const WEEK_OPTS = { weekStartsOn: 1 as const };
const RECENT_BUCKETS_COUNT = 4;
const WEEKLY_BASE_HOURS = 35;

function bucketStart(period: Period, ref: Date): Date {
  if (period === "week") return startOfWeek(ref, WEEK_OPTS);
  if (period === "month") return startOfMonth(ref);
  return startOfYear(ref);
}

function bucketEnd(period: Period, ref: Date): Date {
  if (period === "week") return endOfWeek(ref, WEEK_OPTS);
  if (period === "month") return endOfMonth(ref);
  return endOfYear(ref);
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
    const startDay = format(start, "d", { locale: fr });
    const endDay = format(end, "d MMM yyyy", { locale: fr });
    return `${startDay}–${endDay}`;
  }
  if (period === "month") return format(start, "MMMM yyyy", { locale: fr });
  return format(start, "yyyy");
}

function referenceHours(period: Period, start: string, end: string): number {
  // Base de référence proportionnelle à la longueur de la période
  const days = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  // 35h / 7 jours = 5h/jour calendaire en moyenne. Pour ne compter que les jours ouvrés (5/7) :
  // ratio = 35/7 * 5 = 25h/sem si on ne comptait que les ouvrés → on prend la moyenne simple 35h/semaine
  return Math.round((days / 7) * WEEKLY_BASE_HOURS);
}

export function useConsultantDashboard(value: PeriodValue = defaultPeriodValue("week")) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["consultant_dashboard", user?.id, value.start, value.end],
    queryFn: async () => {
      const now = new Date();
      const start = value.start;
      const end = value.end;
      // Pour les buckets historiques on choisit une granularité (custom = mensuel par défaut)
      const period: Exclude<Period, "custom"> = value.period === "custom" ? "month" : value.period;

      // Plage couvrant les N dernières buckets pour l'historique
      const earliestStart = bucketStart(period, subPeriod(period, now, RECENT_BUCKETS_COUNT - 1));
      const earliestStr = format(earliestStart, "yyyy-MM-dd");
      const fetchUntil = end; // jusqu'à la fin de la période courante

      // ── Saisies de la plage (du début de l'historique à la fin de la période courante)
      const { data: entries, error: e1 } = await supabase
        .from("time_entries")
        .select("hours, entry_date, mission_id, internal_category")
        .eq("user_id", user!.id)
        .gte("entry_date", earliestStr)
        .lte("entry_date", fetchUntil);
      if (e1) throw e1;

      // ── Missions assignées
      const { data: assignments, error: e2 } = await supabase
        .from("assignments")
        .select("mission:missions(id, name, client, pole, nature_mission, budget_days, status)")
        .eq("user_id", user!.id);
      if (e2) throw e2;

      // ── Missions où l'user a des time_entries (historique)
      const { data: userMissionEntries, error: e2b } = await supabase
        .from("time_entries")
        .select("mission:missions(id, name, client, pole, nature_mission, budget_days, status)")
        .eq("user_id", user!.id)
        .not("mission_id", "is", null);
      if (e2b) throw e2b;

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

      // ── Total heures par mission (pour % consommé global)
      const missionIds = allAssignedMissions.map((m: any) => m.id);
      const hoursByMission = new Map<string, number>();
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

      // ── KPIs sur la période courante
      const periodEntries = (entries ?? []).filter(
        (e: any) => e.entry_date >= start && e.entry_date <= end,
      );
      const hoursThisPeriod = periodEntries.reduce((s: number, e: any) => s + Number(e.hours), 0);
      const clientHoursThisPeriod = periodEntries
        .filter((e: any) => e.mission_id)
        .reduce((s: number, e: any) => s + Number(e.hours), 0);
      const internalHoursThisPeriod = hoursThisPeriod - clientHoursThisPeriod;
      const refHours = referenceHours(period, start, end);
      const charge = refHours > 0 ? Math.round((hoursThisPeriod / refHours) * 100) : 0;
      const chargeClient = refHours > 0 ? Math.round((clientHoursThisPeriod / refHours) * 100) : 0;
      const chargeInternal = refHours > 0 ? Math.round((internalHoursThisPeriod / refHours) * 100) : 0;

      // ── Historique récent : agrège par bucket
      const byBucket = new Map<string, { hours: number; missions: Set<string> }>();
      for (const entry of entries ?? []) {
        const key = bucketKey(period, parseISO(entry.entry_date));
        const prev = byBucket.get(key) ?? { hours: 0, missions: new Set<string>() };
        prev.hours += Number(entry.hours);
        if (entry.mission_id) prev.missions.add(entry.mission_id as string);
        byBucket.set(key, prev);
      }

      const recentBuckets = Array.from({ length: RECENT_BUCKETS_COUNT }, (_, i) => {
        const refDate = subPeriod(period, now, i);
        const bStart = bucketStart(period, refDate);
        const key = format(bStart, "yyyy-MM-dd");
        const agg = byBucket.get(key) ?? { hours: 0, missions: new Set<string>() };
        return {
          label: formatBucketLabel(period, bStart),
          hours: Math.round(agg.hours * 10) / 10,
          missions: agg.missions.size,
        };
      });

      // ── Missions en cours / terminées
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
        period,
        hoursThisWeek: Math.round(hoursThisPeriod * 10) / 10,
        clientHoursThisWeek: Math.round(clientHoursThisPeriod * 10) / 10,
        internalHoursThisWeek: Math.round(internalHoursThisPeriod * 10) / 10,
        activeMissionsCount: activeMissions.length,
        charge,
        chargeClient,
        chargeInternal,
        weeklyBase: refHours,
        recentWeeks: recentBuckets, // garde le nom pour compat UI
        missions,
        missionsCompleted,
      };
    },
    enabled: !!user,
  });
}
