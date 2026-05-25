-- Projets transverses : 2e source de saisies de temps (en plus des missions et catégories internes).
-- Alimentée par la base Notion "Projets Transverses" via l'Edge Function sync-notion-transverse.

-- ── 1. Table transverse_projects ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transverse_projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_id   text UNIQUE,                            -- clé d'upsert depuis Notion
  name        text NOT NULL,
  status      text NOT NULL DEFAULT 'active'          -- 'active' | 'completed' | 'on_hold'
              CHECK (status IN ('active', 'completed', 'on_hold')),
  priority    text,                                   -- "Élevée" | "Moyenne" | "Faible" | NULL
  start_date  date,
  end_date    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transverse_projects_status_idx
  ON public.transverse_projects (status);

-- RLS : tous les users authentifiés peuvent lire (comme les missions).
-- Écriture réservée au service role (Edge Function) + admin.
ALTER TABLE public.transverse_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read transverse_projects" ON public.transverse_projects;
CREATE POLICY "Authenticated read transverse_projects"
  ON public.transverse_projects FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin write transverse_projects" ON public.transverse_projects;
CREATE POLICY "Admin write transverse_projects"
  ON public.transverse_projects FOR ALL
  USING (public.current_user_role() = 'admin');

-- ── 2. Colonne transverse_project_id sur time_entries ────────────────────────
-- Une entry est soit liée à une mission, soit à une catégorie interne, soit à un projet transverse.
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS transverse_project_id uuid REFERENCES public.transverse_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS time_entries_transverse_project_idx
  ON public.time_entries (transverse_project_id);

-- ── 3. Extension de notion_settings ──────────────────────────────────────────
-- 2e database_id + mapping de colonnes dédié aux projets transverses.
ALTER TABLE public.notion_settings
  ADD COLUMN IF NOT EXISTS transverse_database_id text,
  ADD COLUMN IF NOT EXISTS transverse_prop_names jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS transverse_last_synced_at timestamptz;
