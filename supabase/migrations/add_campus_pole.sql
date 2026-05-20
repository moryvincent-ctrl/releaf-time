-- Ajout du pôle "Releaf Campus" à la contrainte de la table missions
ALTER TABLE public.missions
  DROP CONSTRAINT missions_pole_check;

ALTER TABLE public.missions
  ADD CONSTRAINT missions_pole_check
  CHECK (pole IN (
    'Releaf Carbon',
    'Releaf LCA',
    'Releaf Energy',
    'Releaf Water',
    'Releaf Biodiversity',
    'Releaf Campus'
  ));
