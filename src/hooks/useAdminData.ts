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
          .select("hours, mission_id, user_id, internal_category, transverse_project_id, proposal_id, user:profiles(full_name), transverse_project:transverse_projects(name), proposal:proposals(name, mission_type)")
          .gte("entry_date", start)
          .lte("entry_date", end),
        supabase.from("missions").select("id").eq("status", "active"),
      ]);

      // Catégorise chaque saisie en exactement une famille (la contrainte SQL garantit l'unicité)
      type Family = "client" | "transverse" | "proposal" | "internal";
      const familyOf = (e: any): Family =>
        e.mission_id ? "client"
          : e.transverse_project_id ? "transverse"
          : e.proposal_id ? "proposal"
          : "internal";

      const sumBy = (pred: (e: any) => boolean) =>
        (periodEntries ?? []).filter(pred).reduce((s, e) => s + Number(e.hours), 0);

      const totalHours       = (periodEntries ?? []).reduce((s, e) => s + Number(e.hours), 0);
      const clientHours      = sumBy((e) => familyOf(e) === "client");
      const transverseHours  = sumBy((e) => familyOf(e) === "transverse");
      const proposalHours    = sumBy((e) => familyOf(e) === "proposal");
      const internalHours    = sumBy((e) => familyOf(e) === "internal");
      const percentClient = totalHours > 0 ? Math.round((clientHours / totalHours) * 100) : 0;
      const percentTransverse = totalHours > 0 ? Math.round((transverseHours / totalHours) * 100) : 0;
      const activeUsers = new Set((periodEntries ?? []).map((e) => e.user_id)).size;

      // Répartition : "Client" + "Transverse" + "Propale" en blocs + chaque catégorie interne séparée
      const breakdown = new Map<string, number>();
      if (clientHours > 0)     breakdown.set("Client", clientHours);
      if (transverseHours > 0) breakdown.set("Projets transverses", transverseHours);
      if (proposalHours > 0)   breakdown.set("Propales", proposalHours);
      for (const entry of periodEntries ?? []) {
        if (familyOf(entry) !== "internal") continue;
        const cat = (entry.internal_category as string | null) ?? "Non catégorisé";
        breakdown.set(cat, (breakdown.get(cat) ?? 0) + Number(entry.hours));
      }
      const repartition = Array.from(breakdown.entries())
        .map(([name, hours]) => ({
          name,
          hours: Math.round(hours * 10) / 10,
          percent: totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0,
          isClient: name === "Client",
          isTransverse: name === "Projets transverses",
          isProposal: name === "Propales",
        }))
        .sort((a, b) => b.hours - a.hours);

      // Agrégats globaux pour les encarts (sur la période)
      const aggByKey = (
        keyFn: (e: any) => string | null,
        labelFn: (e: any) => string,
      ) => {
        const map = new Map<string, { name: string; hours: number }>();
        for (const e of periodEntries ?? []) {
          const k = keyFn(e);
          if (!k) continue;
          const prev = map.get(k) ?? { name: labelFn(e), hours: 0 };
          prev.hours += Number(e.hours);
          map.set(k, prev);
        }
        return Array.from(map.values())
          .map((v) => ({ name: v.name, hours: Math.round(v.hours * 10) / 10 }))
          .sort((a, b) => b.hours - a.hours);
      };

      const internalByCategory = aggByKey(
        (e) => (familyOf(e) === "internal" ? (e.internal_category ?? "Non catégorisé") : null),
        (e) => (e.internal_category as string | null) ?? "Non catégorisé",
      );
      const transverseProjects = aggByKey(
        (e) => (familyOf(e) === "transverse" ? e.transverse_project_id : null),
        (e) => (e.transverse_project as any)?.name ?? "Projet transverse",
      );
      const proposals = aggByKey(
        (e) => (familyOf(e) === "proposal" ? e.proposal_id : null),
        (e) => (e.proposal as any)?.name ?? "Propale",
      );

      // Charge par consultant sur la période — 4 familles
      type ConsultantBucket = { name: string; client: number; transverse: number; proposal: number; internal: number };
      const byUser = new Map<string, ConsultantBucket>();
      for (const entry of periodEntries ?? []) {
        const name = (entry.user as any)?.full_name ?? "Inconnu";
        const prev = byUser.get(entry.user_id) ?? { name, client: 0, transverse: 0, proposal: 0, internal: 0 };
        prev[familyOf(entry)] += Number(entry.hours);
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
        percentTransverse,
        clientHours: Math.round(clientHours * 10) / 10,
        transverseHours: Math.round(transverseHours * 10) / 10,
        proposalHours: Math.round(proposalHours * 10) / 10,
        internalHours: Math.round(internalHours * 10) / 10,
        repartition,
        internalByCategory,
        transverseProjects,
        proposals,
        byConsultant: Array.from(byUser.values())
          .map((u) => {
            const total = u.client + u.transverse + u.proposal + u.internal;
            return {
              name: u.name.split(" ")[0],
              fullName: u.name,
              client: Math.round(u.client * 10) / 10,
              transverse: Math.round(u.transverse * 10) / 10,
              proposal: Math.round(u.proposal * 10) / 10,
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
        .select(
          "id, entry_date, hours, user_id, mission_id, internal_category, transverse_project_id, proposal_id, " +
          "user:profiles(full_name), mission:missions(name, client, nature_mission), " +
          "transverse_project:transverse_projects(name), proposal:proposals(name, mission_type)"
        )
        .order("entry_date", { ascending: false })
        .limit(200);

      if (filters.date) query = query.eq("entry_date", filters.date);

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).filter((e) => {
        const consultantName = (e.user as any)?.full_name ?? "";
        const missionLabel =
          (e.mission as any)?.name
          ?? (e.transverse_project as any)?.name
          ?? (e.proposal as any)?.name
          ?? e.internal_category
          ?? "";
        if (filters.consultant && !consultantName.toLowerCase().includes(filters.consultant.toLowerCase())) return false;
        if (filters.mission && !missionLabel.toLowerCase().includes(filters.mission.toLowerCase())) return false;
        return true;
      });
    },
  });
}
