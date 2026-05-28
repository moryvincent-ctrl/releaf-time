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
const ANNUAL_VACATION_HOURS = 5 * WEEKLY_BASE_HOURS; // 5 semaines de CP = 175h
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

function referenceHours(period: Period, start: string, end: string): number {
  const days = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  const base = Math.round((days / 7) * WEEKLY_BASE_HOURS);
  if (period === "year") return Math.max(base - ANNUAL_VACATION_HOURS, 0);
  return base;
}

function alertLevel(percent: number): "warning" | "critical" | "exceeded" | null {
  if (percent >= 100) return "exceeded";
  if (percent >= 90) return "critical";
  if (percent >= ALERT_THRESHOLD) return "warning";
  return null;
}

export function useManagerDashboard(value: PeriodValue = defaultPeriodValue("week")) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["manager_dashboard", user?.id, value.start, value.end],
    queryFn: async () => {
      const now = new Date();
      const start = value.start;
      const end = value.end;
      const period: Exclude<Period, "custom"> = value.period === "custom" ? "month" : value.period;
      const earliestStart = bucketStart(period, subPeriod(period, now, RECENT_BUCKETS_COUNT - 1));
      const earliestStr = format(earliestStart, "yyyy-MM-dd");

      // ── Ses propres saisies (sur l'historique)
      const { data: ownEntries, error: e1 } = await supabase
        .from("time_entries")
        .select("hours, entry_date, mission_id, internal_category, transverse_project_id, proposal_id")
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

      // ── KPIs sur la période courante (4 sources : client / transverse / propale / interne)
      const periodEntries = (ownEntries ?? []).filter(
        (e: any) => e.entry_date >= start && e.entry_date <= end,
      );
      const sumWhere = (pred: (e: any) => boolean) =>
        periodEntries.filter(pred).reduce((s: number, e: any) => s + Number(e.hours), 0);

      const hoursThisPeriod          = periodEntries.reduce((s: number, e: any) => s + Number(e.hours), 0);
      const clientHoursThisPeriod    = sumWhere((e) => !!e.mission_id);
      const transverseHoursThisPeriod = sumWhere((e) => !!e.transverse_project_id);
      const proposalHoursThisPeriod  = sumWhere((e) => !!e.proposal_id);
      const internalHoursThisPeriod  = sumWhere((e) => !!e.internal_category);

      const refHours = referenceHours(period, start, end);
      const pct = (h: number) => (refHours > 0 ? Math.round((h / refHours) * 100) : 0);
      const charge = pct(hoursThisPeriod);
      const chargeClient = pct(clientHoursThisPeriod);
      const chargeTransverse = pct(transverseHoursThisPeriod);
      const chargeProposal = pct(proposalHoursThisPeriod);
      const chargeInternal = pct(internalHoursThisPeriod);

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

      // ── Temps internes par catégorie (toute l'histoire du user)
      const { data: internalRows, error: eI } = await supabase
        .from("time_entries")
        .select("internal_category, hours")
        .eq("user_id", user!.id)
        .not("internal_category", "is", null);
      if (eI) throw eI;
      const internalByCatMap = new Map<string, number>();
      for (const r of internalRows ?? []) {
        const cat = (r.internal_category as string | null) ?? "Non catégorisé";
        internalByCatMap.set(cat, (internalByCatMap.get(cat) ?? 0) + Number(r.hours));
      }
      const internalByCategory = Array.from(internalByCatMap.entries())
        .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
        .sort((a, b) => b.hours - a.hours);

      // ── Projets transverses du user (assignés OU avec time_entries)
      const { data: tAssignments, error: eT1 } = await supabase
        .from("transverse_project_assignments")
        .select("transverse_project_id")
        .eq("user_id", user!.id);
      if (eT1) throw eT1;
      const tEntryIds = (ownEntries ?? [])
        .map((e: any) => e.transverse_project_id)
        .filter(Boolean) as string[];
      const tIds = Array.from(new Set([
        ...((tAssignments ?? []).map((a: any) => a.transverse_project_id) as string[]),
        ...tEntryIds,
      ]));
      let transverseProjects: { id: string; name: string; hours: number }[] = [];
      if (tIds.length > 0) {
        const { data: tProjects, error: eT2 } = await supabase
          .from("transverse_projects")
          .select("id, name, status")
          .in("id", tIds)
          .eq("status", "active");
        if (eT2) throw eT2;
        const { data: tHours, error: eT3 } = await supabase
          .from("time_entries")
          .select("transverse_project_id, hours")
          .eq("user_id", user!.id)
          .in("transverse_project_id", tIds);
        if (eT3) throw eT3;
        const hoursByT = new Map<string, number>();
        for (const e of tHours ?? []) {
          const key = e.transverse_project_id as string;
          hoursByT.set(key, (hoursByT.get(key) ?? 0) + Number(e.hours));
        }
        transverseProjects = (tProjects ?? [])
          .map((p: any) => ({ id: p.id, name: p.name, hours: Math.round((hoursByT.get(p.id) ?? 0) * 10) / 10 }))
          .sort((a, b) => b.hours - a.hours);
      }

      // ── Propales du user (ajoutées OU avec time_entries)
      const { data: pAdded, error: eP1 } = await supabase
        .from("user_proposals")
        .select("proposal_id")
        .eq("user_id", user!.id);
      if (eP1) throw eP1;
      const pEntryIds = (ownEntries ?? [])
        .map((e: any) => e.proposal_id)
        .filter(Boolean) as string[];
      const pIds = Array.from(new Set([
        ...((pAdded ?? []).map((r: any) => r.proposal_id) as string[]),
        ...pEntryIds,
      ]));
      let proposals: { id: string; name: string; mission_type: string | null; hours: number }[] = [];
      if (pIds.length > 0) {
        const { data: pList, error: eP2 } = await supabase
          .from("proposals")
          .select("id, name, mission_type, status")
          .in("id", pIds)
          .eq("status", "active");
        if (eP2) throw eP2;
        const { data: pHoursRows, error: eP3 } = await supabase
          .from("time_entries")
          .select("proposal_id, hours")
          .eq("user_id", user!.id)
          .in("proposal_id", pIds);
        if (eP3) throw eP3;
        const hoursByP = new Map<string, number>();
        for (const e of pHoursRows ?? []) {
          const key = e.proposal_id as string;
          hoursByP.set(key, (hoursByP.get(key) ?? 0) + Number(e.hours));
        }
        proposals = (pList ?? [])
          .map((p: any) => ({ id: p.id, name: p.name, mission_type: p.mission_type ?? null, hours: Math.round((hoursByP.get(p.id) ?? 0) * 10) / 10 }))
          .sort((a, b) => b.hours - a.hours);
      }

      return {
        period,
        hoursThisWeek: Math.round(hoursThisPeriod * 10) / 10,
        clientHoursThisWeek: Math.round(clientHoursThisPeriod * 10) / 10,
        transverseHoursThisWeek: Math.round(transverseHoursThisPeriod * 10) / 10,
        proposalHoursThisWeek: Math.round(proposalHoursThisPeriod * 10) / 10,
        internalHoursThisWeek: Math.round(internalHoursThisPeriod * 10) / 10,
        activeMissionsCount: myActiveAssignedCount,
        charge,
        chargeClient,
        chargeTransverse,
        chargeProposal,
        chargeInternal,
        weeklyBase: refHours,
        recentWeeks: recentBuckets,
        missions,
        missionsCompleted,
        alerts,
        internalByCategory,
        transverseProjects,
        proposals,
      };
    },
    enabled: !!user,
  });
}
