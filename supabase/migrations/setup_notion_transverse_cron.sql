-- Sync automatique Notion (projets transverses) → Supabase toutes les 30 min.
-- Réutilise le secret `sync_notion_anon_key` déjà présent dans le Vault
-- (créé par setup_notion_cron.sql).
-- À exécuter UNE SEULE FOIS dans le SQL Editor (idempotent).

-- 1. Désinstalle un éventuel ancien job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-notion-transverse-30min') THEN
    PERFORM cron.unschedule('sync-notion-transverse-30min');
  END IF;
END $$;

-- 2. Planifie toutes les 30 min (même cadence que la sync missions)
SELECT cron.schedule(
  'sync-notion-transverse-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://iuonrlluscszlpbagkcg.supabase.co/functions/v1/sync-notion-transverse',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sync_notion_anon_key' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Vérifier que le job est planifié :
-- SELECT * FROM cron.job WHERE jobname = 'sync-notion-transverse-30min';
-- Vérifier les exécutions :
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-notion-transverse-30min') ORDER BY start_time DESC LIMIT 10;
-- Vérifier le timestamp côté UI (Settings → Sync transverse) :
-- SELECT transverse_last_synced_at FROM notion_settings LIMIT 1;
