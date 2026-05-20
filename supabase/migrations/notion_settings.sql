-- Table pour stocker la configuration Notion (1 seule ligne)
create table public.notion_settings (
  id          int primary key default 1 check (id = 1),  -- une seule ligne possible
  api_key     text,
  database_id text,
  prop_names  jsonb default '{}',  -- pour personnaliser les noms de colonnes Notion
  updated_at  timestamptz default now()
);

-- Seul l'admin peut lire/modifier
alter table public.notion_settings enable row level security;

create policy "Admin gère les settings Notion"
  on public.notion_settings for all
  using (public.current_user_role() = 'admin');

-- Ligne initiale vide
insert into public.notion_settings (id) values (1);
