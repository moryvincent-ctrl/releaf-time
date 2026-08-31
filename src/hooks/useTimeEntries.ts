import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { TimeEntry, InternalCategory } from "@/lib/database.types";

// Calcule le lundi de la semaine pour une date donnée
export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

// Formate une date en YYYY-MM-DD
export function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Retourne les 5 jours ouvrés (lun→ven) d'une semaine
export function getWeekDays(weekStart: string): string[] {
  const start = new Date(weekStart + "T12:00:00");
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toDateString(d);
  });
}

// Formate la semaine en "24 au 28 mars 2025"
export function formatWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + "T12:00:00");
  const end = new Date(weekStart + "T12:00:00");
  end.setDate(end.getDate() + 4);

  const months = [
    "janvier","février","mars","avril","mai","juin",
    "juillet","août","septembre","octobre","novembre","décembre",
  ];
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getDate()} au ${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${months[start.getMonth()]} au ${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useTimeEntries(weekStart: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["time_entries", user?.id, weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        // Les jointures transverse_project / proposal servent à libeller les saisies
        // dont la ligne n'est plus affichée dans la grille (cf. hiddenHours).
        .select(
          "*, mission:missions(id, name, client, pole, status), " +
          "transverse_project:transverse_projects(id, name), " +
          "proposal:proposals(id, name)"
        )
        .eq("user_id", user!.id)
        .eq("week_start", weekStart);

      if (error) throw error;
      return data as TimeEntry[];
    },
    enabled: !!user,
  });
}

export function useAssignedMissions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["assigned_missions", user?.id],
    queryFn: async () => {
      // 1. Missions assignées (via assignments)
      const { data: assignments, error: e1 } = await supabase
        .from("assignments")
        .select("mission:missions(id, name, client, pole, nature_mission, status)")
        .eq("user_id", user!.id);
      if (e1) throw e1;

      // 2. Missions où l'user a déjà saisi du temps même sans assignment (dépannage ponctuel)
      const { data: entries, error: e2 } = await supabase
        .from("time_entries")
        .select("mission:missions(id, name, client, pole, nature_mission, status)")
        .eq("user_id", user!.id)
        .not("mission_id", "is", null);
      if (e2) throw e2;

      const byId = new Map<string, any>();
      for (const a of assignments ?? []) {
        const m: any = a.mission;
        if (m && m.status === "active") byId.set(m.id, m);
      }
      // Seules les missions EN COURS remontent automatiquement sur la grille.
      // Les missions terminées ne s'affichent que si elles sont ajoutées
      // manuellement via "Ajouter une mission ponctuelle" (état de session).
      for (const e of entries ?? []) {
        const m: any = e.mission;
        if (m && m.status === "active" && !byId.has(m.id)) byId.set(m.id, m);
      }
      return Array.from(byId.values());
    },
    enabled: !!user,
  });
}

// Missions sélectionnables pour un ajout ponctuel depuis ConsultantView :
// uniquement les missions EN COURS (on n'est pas forcément staffé dessus).
// Une mission passée "Terminée" dans Notion sort définitivement du tableau de
// saisie — elle ne doit plus être proposée à l'ajout.
export function useActiveMissions() {
  return useQuery({
    queryKey: ["active_missions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("id, name, client, pole, nature_mission, status")
        .eq("status", "active")
        .order("client", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Projets transverses actifs sur lesquels le user courant est assigné
// (assignations alimentées depuis la colonne "Personne assignée" Notion).
export function useTransverseProjects() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["transverse_projects", user?.id],
    queryFn: async () => {
      // 1. IDs des projets sur lesquels le user est assigné
      const { data: assignments, error: e1 } = await supabase
        .from("transverse_project_assignments")
        .select("transverse_project_id")
        .eq("user_id", user!.id);
      if (e1) throw e1;
      const assignedIds = (assignments ?? []).map((a: any) => a.transverse_project_id);

      // 2. IDs des projets sur lesquels le user a déjà saisi du temps
      //    (dépannage ponctuel — même logique que useAssignedMissions)
      const { data: entries, error: e2 } = await supabase
        .from("time_entries")
        .select("transverse_project_id")
        .eq("user_id", user!.id)
        .not("transverse_project_id", "is", null);
      if (e2) throw e2;
      const entriesIds = (entries ?? [])
        .map((e: any) => e.transverse_project_id)
        .filter(Boolean) as string[];

      const allIds = Array.from(new Set([...assignedIds, ...entriesIds]));
      if (allIds.length === 0) return [];

      const { data, error } = await supabase
        .from("transverse_projects")
        .select("id, name, status")
        .eq("status", "active")
        .in("id", allIds)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

// ─── Propales ────────────────────────────────────────────────────────────────

// Toutes les propales actives (pour le picker "Ajouter une propale")
export function useActiveProposals() {
  return useQuery({
    queryKey: ["proposals", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, name, mission_type, stage, status")
        .eq("status", "active")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Propales du user courant (ajoutées via user_proposals OU avec des time_entries),
// filtrées sur les actives uniquement (les 'closed' sortent automatiquement de la grille).
export function useMyProposals() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["proposals", "mine", user?.id],
    queryFn: async () => {
      // 1. Propales explicitement ajoutées par l'user
      const { data: added, error: e1 } = await supabase
        .from("user_proposals")
        .select("proposal:proposals(id, name, mission_type, stage, status)")
        .eq("user_id", user!.id);
      if (e1) throw e1;

      // 2. Propales sur lesquelles l'user a saisi du temps (sans avoir cliqué sur "Ajouter")
      const { data: viaEntries, error: e2 } = await supabase
        .from("time_entries")
        .select("proposal:proposals(id, name, mission_type, stage, status)")
        .eq("user_id", user!.id)
        .not("proposal_id", "is", null);
      if (e2) throw e2;

      const byId = new Map<string, any>();
      for (const row of added ?? []) {
        const p: any = row.proposal;
        if (p && p.status === "active") byId.set(p.id, p);
      }
      for (const row of viaEntries ?? []) {
        const p: any = row.proposal;
        if (p && p.status === "active" && !byId.has(p.id)) byId.set(p.id, p);
      }
      return Array.from(byId.values());
    },
    enabled: !!user,
  });
}

// Ajout / retrait d'une propale par le user
export function useAddUserProposal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (proposalId: string) => {
      const { error } = await supabase
        .from("user_proposals")
        .upsert({ user_id: user!.id, proposal_id: proposalId }, { onConflict: "user_id,proposal_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals", "mine", user?.id] });
    },
  });
}

// Upsert : crée ou met à jour une saisie (mission, catégorie interne, projet transverse, ou propale)
type UpsertPayload = {
  mission_id?: string | null;
  internal_category?: InternalCategory | null;
  transverse_project_id?: string | null;
  proposal_id?: string | null;
  entry_date: string;
  hours: number;
  comment?: string;
  week_start: string;
};

export function useUpsertTimeEntry() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpsertPayload) => {
      // Cherche si une entrée existe déjà pour ce user/date/source
      let matchFilter: Record<string, any>;
      if (payload.mission_id) {
        matchFilter = { user_id: user!.id, entry_date: payload.entry_date, mission_id: payload.mission_id };
      } else if (payload.transverse_project_id) {
        matchFilter = { user_id: user!.id, entry_date: payload.entry_date, transverse_project_id: payload.transverse_project_id };
      } else if (payload.proposal_id) {
        matchFilter = { user_id: user!.id, entry_date: payload.entry_date, proposal_id: payload.proposal_id };
      } else {
        matchFilter = { user_id: user!.id, entry_date: payload.entry_date, internal_category: payload.internal_category };
      }

      const { data: existing } = await supabase
        .from("time_entries")
        .select("id")
        .match(matchFilter)
        .maybeSingle();

      if (existing) {
        // Update
        const { error } = await supabase
          .from("time_entries")
          .update({ hours: payload.hours, comment: payload.comment ?? null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Insert (seulement si hours > 0)
        if (payload.hours <= 0) return;
        const { error } = await supabase.from("time_entries").insert({
          user_id: user!.id,
          mission_id: payload.mission_id ?? null,
          internal_category: payload.internal_category ?? null,
          transverse_project_id: payload.transverse_project_id ?? null,
          proposal_id: payload.proposal_id ?? null,
          entry_date: payload.entry_date,
          hours: payload.hours,
          comment: payload.comment ?? null,
          week_start: payload.week_start,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["time_entries", user?.id, variables.week_start] });
    },
  });
}
