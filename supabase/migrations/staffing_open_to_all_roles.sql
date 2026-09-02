-- Ouvre le staffing prévisionnel à tous les rôles, avec deux niveaux d'accès :
--   • admin + manager : voient et saisissent pour tout le monde (accès identique) ;
--   • consultant      : ne voit et ne saisit que ses propres lignes.
-- Remplace les policies "Admin only" posées par staffing_allocations.sql et
-- payfit_absences.sql. À exécuter dans le SQL Editor (idempotent).

-- ── 1. Allocations de staffing ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin read staffing_allocations"  ON public.staffing_allocations;
DROP POLICY IF EXISTS "Admin write staffing_allocations" ON public.staffing_allocations;
DROP POLICY IF EXISTS "Staffing read staffing_allocations"  ON public.staffing_allocations;
DROP POLICY IF EXISTS "Staffing write staffing_allocations" ON public.staffing_allocations;

CREATE POLICY "Staffing read staffing_allocations"
  ON public.staffing_allocations FOR SELECT
  USING (
    public.current_user_role() IN ('manager', 'admin')
    OR user_id = auth.uid()
  );

-- USING filtre les lignes existantes (UPDATE / DELETE), WITH CHECK contrôle la
-- ligne résultante (INSERT / UPDATE) : un consultant ne peut donc ni modifier la
-- ligne d'un collègue, ni en créer une à son nom.
CREATE POLICY "Staffing write staffing_allocations"
  ON public.staffing_allocations FOR ALL
  USING (
    public.current_user_role() IN ('manager', 'admin')
    OR user_id = auth.uid()
  )
  WITH CHECK (
    public.current_user_role() IN ('manager', 'admin')
    OR user_id = auth.uid()
  );

-- ── 2. Congés Payfit ─────────────────────────────────────────────────────────
-- Le consultant a besoin de ses propres congés pour que sa capacité mensuelle
-- soit correcte, mais pas de ceux des autres.

DROP POLICY IF EXISTS "Admin read payfit_absences"    ON public.payfit_absences;
DROP POLICY IF EXISTS "Staffing read payfit_absences" ON public.payfit_absences;

CREATE POLICY "Staffing read payfit_absences"
  ON public.payfit_absences FOR SELECT
  USING (
    public.current_user_role() IN ('manager', 'admin')
    OR user_id = auth.uid()
  );

-- Vérifier les policies en place :
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE tablename IN ('staffing_allocations', 'payfit_absences') ORDER BY tablename, policyname;
