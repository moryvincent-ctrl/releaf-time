-- Tracking de la dernière sync Notion (mis à jour par l'Edge Function à chaque exécution)
ALTER TABLE public.notion_settings
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
