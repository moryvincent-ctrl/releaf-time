-- Staffing prévisionnel : allocations planifiées de jours par personne et par mois,
-- sur une mission OU un projet transverse. Indépendant du réalisé (time_entries).
-- Réservé aux Admins (lecture + écriture).

CREATE TABLE IF NOT EXISTS public.staffing_allocations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mission_id            uuid REFERENCES public.missions(id) ON DELETE CASCADE,
  transverse_project_id uuid REFERENCES public.transverse_projects(id) ON DELETE CASCADE,
  month                 date NOT NULL,                 -- toujours le 1er du mois (ex 2026-07-01)
  planned_days          numeric(5,2) NOT NULL DEFAULT 0 CHECK (planned_days >= 0),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  -- Une allocation cible soit une mission, soit un projet transverse (jamais les deux).
  CONSTRAINT staffing_target CHECK (
    (mission_id IS NOT NULL AND transverse_project_id IS NULL)
    OR
    (mission_id IS NULL AND transverse_project_id IS NOT NULL)
  )
);

-- Unicité par cible et par mois (les NULL étant distincts en Postgres, on utilise
-- deux index partiels plutôt qu'une contrainte UNIQUE multi-colonnes).
CREATE UNIQUE INDEX IF NOT EXISTS staffing_alloc_mission_uniq
  ON public.staffing_allocations (user_id, mission_id, month)
  WHERE mission_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS staffing_alloc_transverse_uniq
  ON public.staffing_allocations (user_id, transverse_project_id, month)
  WHERE transverse_project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS staffing_alloc_month_idx
  ON public.staffing_allocations (month);

ALTER TABLE public.staffing_allocations ENABLE ROW LEVEL SECURITY;

-- Fonctionnalité Admin uniquement : lecture ET écriture réservées aux admins.
DROP POLICY IF EXISTS "Admin read staffing_allocations" ON public.staffing_allocations;
CREATE POLICY "Admin read staffing_allocations"
  ON public.staffing_allocations FOR SELECT
  USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin write staffing_allocations" ON public.staffing_allocations;
CREATE POLICY "Admin write staffing_allocations"
  ON public.staffing_allocations FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
