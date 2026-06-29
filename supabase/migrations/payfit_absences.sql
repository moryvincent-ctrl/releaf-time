-- Absences / congés importés de Payfit (API partenaire), pour déduire la capacité
-- mensuelle dans le staffing prévisionnel. Alimentée par l'Edge Function sync-payfit-absences.

CREATE TABLE IF NOT EXISTS public.payfit_absences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payfit_id     text,                       -- id de l'absence côté Payfit (si fourni)
  contract_id   text,                       -- contractId Payfit (clé de rattachement)
  user_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL, -- profil Releaf mappé (par email)
  absence_type  text,                       -- ex "fr_conges_payes"
  begin_date    date,
  end_date      date,
  status        text,                       -- approved / pending_approval / ...
  raw           jsonb,                      -- payload brut Payfit (debug / champs non mappés)
  synced_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payfit_absences_user_idx ON public.payfit_absences (user_id);
CREATE INDEX IF NOT EXISTS payfit_absences_dates_idx ON public.payfit_absences (begin_date, end_date);

ALTER TABLE public.payfit_absences ENABLE ROW LEVEL SECURITY;

-- Lecture réservée aux admins (le staffing est Admin-only).
-- L'écriture passe par l'Edge Function via le service role, qui bypass la RLS.
DROP POLICY IF EXISTS "Admin read payfit_absences" ON public.payfit_absences;
CREATE POLICY "Admin read payfit_absences"
  ON public.payfit_absences FOR SELECT
  USING (public.current_user_role() = 'admin');
