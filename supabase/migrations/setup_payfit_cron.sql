-- Sync automatique Payfit (congés) → Supabase toutes les heures.
-- Réutilise le secret `sync_notion_anon_key` déjà présent dans le Vault
-- (créé par setup_notion_cron.sql).
-- À exécuter UNE SEULE FOIS dans le SQL Editor (idempotent).

-- 1. Désinstalle un éventuel ancien job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-payfit-absences-hourly') THEN
    PERFORM cron.unschedule('sync-payfit-absences-hourly');
  END IF;
END $$;

-- 2. Planifie toutes les heures (les congés bougent peu, inutile d'aller plus vite)
SELECT cron.schedule(
  'sync-payfit-absences-hourly',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://iuonrlluscszlpbagkcg.supabase.co/functions/v1/sync-payfit-absences',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sync_notion_anon_key' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Vérifier que le job est planifié :
-- SELECT * FROM cron.job WHERE jobname = 'sync-payfit-absences-hourly';
-- Vérifier les exécutions :
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-payfit-absences-hourly') ORDER BY start_time DESC LIMIT 10;
-- Voir la fraîcheur des données :
-- SELECT max(synced_at), count(*) FROM public.payfit_absences;
