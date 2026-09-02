-- Marque les collaborateurs encore présents. Remplace la liste de noms codée en
-- dur dans le front (StaffingView), qui cassait dès qu'un profil était renommé.
--
-- Portée volontairement limitée au staffing prévisionnel : les temps réalisés
-- des personnes parties doivent rester visibles dans "Mon tableau de bord" et
-- "Vue globale", donc aucun autre écran ne filtre sur cette colonne.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.active IS
  'false = a quitté l''entreprise. Exclut du staffing prévisionnel uniquement ; '
  'l''historique des temps réalisés reste visible partout ailleurs.';

-- Reprise de l'existant : les profils renommés "… (parti)" / "… (partie)".
UPDATE public.profiles SET active = false WHERE full_name ILIKE '%(parti%';

-- L'écran Paramètres → Gestion des utilisateurs est admin-only et modifie le
-- profil d'autrui (rôle, et désormais statut) : sans cette policy la seule règle
-- d'UPDATE est "id = auth.uid()", et l'écriture ne touche aucune ligne.
DROP POLICY IF EXISTS "Admin met à jour les profils" ON public.profiles;
CREATE POLICY "Admin met à jour les profils"
  ON public.profiles FOR UPDATE
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Contrôle :
-- SELECT full_name, role, active FROM public.profiles ORDER BY active DESC, full_name;
