-- Fix : des saisies stockaient un week_start au DIMANCHE au lieu du lundi.
--
-- getWeekStart() calculait le lundi à partir des composantes locales de la date,
-- puis sérialisait le résultat via toISOString(), qui repasse en UTC. À Paris,
-- toute saisie enregistrée entre minuit et l'offset (00h–02h en été, 00h–01h en
-- hiver) voyait donc sa date reculer d'un jour, et week_start tombait au dimanche.
--
-- Conséquence : la vue semaine filtre en .eq("week_start", …) avec un lundi. Ces
-- saisies devenaient introuvables — les heures étaient bien en base, mais
-- n'apparaissaient ni dans la grille, ni dans les totaux, ni dans le bandeau des
-- lignes clôturées. Symptôme observé : "j'ai saisi du temps mais je ne le vois plus".
--
-- Le calcul côté client est corrigé (formatLocalDate dans src/hooks/useTimeEntries.ts,
-- verrouillé par src/test/week.test.ts). Cette migration répare l'existant.
--
-- Note : date_trunc('week', …) renvoie le LUNDI en Postgres. Le cast explicite en
-- timestamp force la surcharge IMMUTABLE de date_trunc — la variante timestamptz
-- est seulement STABLE et serait refusée dans une contrainte CHECK.

-- ── 1. Recale les week_start incohérents sur le lundi de entry_date ──────────
UPDATE public.time_entries
SET    week_start = date_trunc('week', entry_date::timestamp)::date
WHERE  week_start IS DISTINCT FROM date_trunc('week', entry_date::timestamp)::date;

-- ── 2. Verrouille l'invariant ────────────────────────────────────────────────
-- Aucune Edge Function n'écrit dans time_entries : le front est le seul écrivain,
-- la contrainte peut donc être imposée sans risquer de bloquer une synchro.
-- Un onglet resté ouvert sur l'ancien bundle verra sa sauvegarde échouer
-- bruyamment (erreur 23514) au lieu de réécrire un week_start faux en silence.
ALTER TABLE public.time_entries
  DROP CONSTRAINT IF EXISTS time_entry_week_start_coherent;

ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entry_week_start_coherent
  CHECK (week_start = date_trunc('week', entry_date::timestamp)::date);
