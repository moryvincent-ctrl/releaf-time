-- Sync automatique Notion → Supabase toutes les heures.
-- Repose sur pg_cron (planification) + pg_net (HTTP) + Vault (stockage de la clé).
-- À exécuter UNE SEULE FOIS dans le SQL Editor (les SELECT idempotents sont sûrs en cas de re-run).

-- 1. Active les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Stocke l'anon key dans le Vault (publique, pas un vrai secret, mais propre)
--    Remplace <ANON_KEY> par la VITE_SUPABASE_ANON_KEY puis exécute.
--    Si tu relances ce bloc, écrase la valeur précédente.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'sync_notion_anon_key') THEN
    PERFORM vault.create_secret(
      '<ANON_KEY>',
      'sync_notion_anon_key',
      'Anon key utilisée par le cron pour appeler la fonction sync-notion'
    );
  END IF;
END $$;

-- 3. Désinstalle un ancien job s'il existe, puis recrée toutes les 30 min
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-notion-hourly') THEN
    PERFORM cron.unschedule('sync-notion-hourly');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-notion-30min') THEN
    PERFORM cron.unschedule('sync-notion-30min');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-notion-30min',
  '*/30 * * * *',  -- toutes les 30 minutes (cron syntax : min h jour mois jour_semaine)
  $$
  SELECT net.http_post(
    url := 'https://iuonrlluscszlpbagkcg.supabase.co/functions/v1/sync-notion',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sync_notion_anon_key' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Vérifier que le job est planifié :
-- SELECT * FROM cron.job WHERE jobname = 'sync-notion-30min';
-- Vérifier les exécutions :
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-notion-30min') ORDER BY start_time DESC LIMIT 10;
