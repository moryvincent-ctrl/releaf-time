-- Met à jour la liste des catégories internes des saisies de temps.
-- - Renomme "R&D" + "Structuration interne" → "Outils internes" pour les saisies existantes
-- - Étend la liste avec "Recrutement", "Développement SaaS Releaf", "Développement site web"

UPDATE public.time_entries
SET internal_category = 'Outils internes'
WHERE internal_category IN ('R&D', 'Structuration interne');

ALTER TABLE public.time_entries
  DROP CONSTRAINT time_entries_internal_category_check;

ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_internal_category_check
  CHECK (internal_category IN (
    'Sales / Biz Dev',
    'Administratif',
    'Outils internes',
    'Formation',
    'Communication',
    'Recrutement',
    'Développement SaaS Releaf',
    'Développement site web'
  ));
