-- Fix : la contrainte time_entry_source n'avait pas été mise à jour quand on a ajouté
-- les colonnes transverse_project_id (migration transverse_projects.sql) et proposal_id
-- (migration proposals.sql). Conséquence : toute saisie sur un projet transverse ou une
-- propale était rejetée avec l'erreur 23514 ("violates check constraint time_entry_source"),
-- ce qui faisait planter la sauvegarde de toute la semaine côté UI.

ALTER TABLE public.time_entries DROP CONSTRAINT IF EXISTS time_entry_source;

ALTER TABLE public.time_entries ADD CONSTRAINT time_entry_source CHECK (
  (CASE WHEN mission_id            IS NOT NULL THEN 1 ELSE 0 END)
+ (CASE WHEN internal_category     IS NOT NULL THEN 1 ELSE 0 END)
+ (CASE WHEN transverse_project_id IS NOT NULL THEN 1 ELSE 0 END)
+ (CASE WHEN proposal_id           IS NOT NULL THEN 1 ELSE 0 END)
= 1
);
