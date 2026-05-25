-- Sync automatique HubSpot Dashboard → Supabase toutes les 10 min.
-- Réutilise le secret `sync_notion_anon_key` déjà présent dans le Vault
-- (créé par setup_notion_cron.sql).
-- À exécuter UNE SEULE FOIS dans le SQL Editor (idempotent).

-- 1. Désinstalle un éventuel ancien job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-hubspot-deals-10min') THEN
    PERFORM cron.unschedule('sync-hubspot-deals-10min');
  END IF;
END $$;

-- 2. Planifie toutes les 10 min (le cache HubSpot est de 5 min, inutile d'aller plus vite)
SELECT cron.schedule(
  'sync-hubspot-deals-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://iuonrlluscszlpbagkcg.supabase.co/functions/v1/sync-hubspot-deals',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sync_notion_anon_key' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Vérifier que le job est planifié :
-- SELECT * FROM cron.job WHERE jobname = 'sync-hubspot-deals-10min';
-- Vérifier les exécutions :
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-hubspot-deals-10min') ORDER BY start_time DESC LIMIT 10;
