-- Assignations user ↔ projet transverse.
-- Alimentée par la sync Notion à partir de la colonne "Personne assignée" :
-- chaque personne Notion est matchée par email vers les profils Releaf Time.

CREATE TABLE IF NOT EXISTS public.transverse_project_assignments (
  transverse_project_id uuid NOT NULL REFERENCES public.transverse_projects(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (transverse_project_id, user_id)
);

CREATE INDEX IF NOT EXISTS transverse_project_assignments_user_idx
  ON public.transverse_project_assignments (user_id);

ALTER TABLE public.transverse_project_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read transverse_project_assignments" ON public.transverse_project_assignments;
CREATE POLICY "Authenticated read transverse_project_assignments"
  ON public.transverse_project_assignments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin write transverse_project_assignments" ON public.transverse_project_assignments;
CREATE POLICY "Admin write transverse_project_assignments"
  ON public.transverse_project_assignments FOR ALL
  USING (public.current_user_role() = 'admin');
