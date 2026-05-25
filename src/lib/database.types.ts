export type Role = "consultant" | "manager" | "admin";
export type MissionStatus = "active" | "completed" | "on_hold";
export type MissionPole =
  | "Releaf Carbon"
  | "Releaf LCA"
  | "Releaf Energy"
  | "Releaf Water"
  | "Releaf Biodiversity"
  | "Releaf Campus";
export type RoleOnMission = "Consultant" | "Chef de projet" | "Manager";
export type InternalCategory =
  | "Sales / Biz Dev"
  | "Administratif"
  | "Outils internes"
  | "Formation"
  | "Communication"
  | "Recrutement"
  | "Développement SaaS Releaf"
  | "Développement site web";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  avatar_url: string | null;
  created_at: string;
}

export interface Mission {
  id: string;
  name: string;
  client: string;
  pole: MissionPole;
  nature_mission: string | null;
  budget_days: number;
  start_date: string | null;
  end_date: string | null;
  status: MissionStatus;
  manager_id: string | null;
  notion_id: string | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  mission_id: string;
  user_id: string;
  role_on_mission: RoleOnMission;
  created_at: string;
  // Joins
  mission?: Mission;
  profile?: Profile;
}

export type TransverseProjectStatus = "active" | "completed" | "on_hold";

export interface TransverseProject {
  id: string;
  notion_id: string | null;
  name: string;
  status: TransverseProjectStatus;
  priority: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export type ProposalStatus = "active" | "closed";

export interface Proposal {
  id: string;
  hubspot_id: string;
  name: string;                // nom prospect
  mission_type: string | null;
  stage: string | null;
  amount: number | null;
  probability: number | null;
  close_date: string | null;
  status: ProposalStatus;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface UserProposal {
  user_id: string;
  proposal_id: string;
  added_at: string;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  mission_id: string | null;
  internal_category: InternalCategory | null;
  transverse_project_id: string | null;
  proposal_id: string | null;
  entry_date: string;
  hours: number;
  comment: string | null;
  week_start: string;
  created_at: string;
  // Joins
  mission?: Mission;
  transverse_project?: TransverseProject;
  proposal?: Proposal;
  profile?: Profile;
}

// Type générique pour la DB Supabase (utilisé par createClient<Database>)
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at">;
        Update: Partial<Omit<Profile, "id" | "created_at">>;
      };
      missions: {
        Row: Mission;
        Insert: Omit<Mission, "id" | "created_at">;
        Update: Partial<Omit<Mission, "id" | "created_at">>;
      };
      assignments: {
        Row: Assignment;
        Insert: Omit<Assignment, "id" | "created_at" | "mission" | "profile">;
        Update: Partial<Omit<Assignment, "id" | "created_at">>;
      };
      time_entries: {
        Row: TimeEntry;
        Insert: Omit<TimeEntry, "id" | "created_at" | "mission" | "transverse_project" | "proposal" | "profile">;
        Update: Partial<Omit<TimeEntry, "id" | "created_at">>;
      };
      transverse_projects: {
        Row: TransverseProject;
        Insert: Omit<TransverseProject, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<TransverseProject, "id" | "created_at">>;
      };
      proposals: {
        Row: Proposal;
        Insert: Omit<Proposal, "id" | "created_at" | "updated_at" | "last_seen_at">;
        Update: Partial<Omit<Proposal, "id" | "created_at">>;
      };
      user_proposals: {
        Row: UserProposal;
        Insert: Omit<UserProposal, "added_at">;
        Update: Partial<Omit<UserProposal, "user_id" | "proposal_id">>;
      };
    };
    Functions: {
      current_user_role: {
        Args: Record<string, never>;
        Returns: Role;
      };
    };
  };
}
