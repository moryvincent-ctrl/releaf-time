-- Autorise tout utilisateur authentifié à lire les profils
-- (nécessaire pour afficher les noms des collègues sur les missions, dashboards, etc.)

CREATE POLICY "Lecture profils par users authentifiés"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
