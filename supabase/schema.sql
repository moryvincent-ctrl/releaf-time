create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  email      text not null unique,
  role       text not null default 'consultant' check (role in ('consultant', 'manager', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'consultant')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.missions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  client      text not null,
  pole        text not null check (pole in ('Releaf Carbon','Releaf LCA','Releaf Energy','Releaf Water','Releaf Biodiversity')),
  budget_days numeric(8,2) not null default 0,
  start_date  date,
  end_date    date,
  status      text not null default 'active' check (status in ('active','completed','on_hold')),
  manager_id  uuid references public.profiles(id) on delete set null,
  notion_id   text,
  created_at  timestamptz not null default now()
);

create table public.assignments (
  id              uuid primary key default gen_random_uuid(),
  mission_id      uuid not null references public.missions(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role_on_mission text not null default 'Consultant' check (role_on_mission in ('Consultant','Chef de projet','Manager')),
  created_at      timestamptz not null default now(),
  unique (mission_id, user_id)
);

create table public.time_entries (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  mission_id        uuid references public.missions(id) on delete set null,
  internal_category text check (internal_category in ('Sales / Biz Dev','Administratif','Outils internes','Formation','Communication','Recrutement','Développement SaaS Releaf','Développement site web')),
  entry_date        date not null,
  hours             numeric(4,2) not null check (hours >= 0 and hours <= 24),
  comment           text,
  week_start        date not null,
  created_at        timestamptz not null default now(),
  constraint time_entry_source check (
    (mission_id is not null and internal_category is null)
    or
    (mission_id is null and internal_category is not null)
  )
);

create index idx_time_entries_user_week on public.time_entries(user_id, week_start);
create index idx_time_entries_mission   on public.time_entries(mission_id);
create index idx_assignments_mission    on public.assignments(mission_id);
create index idx_assignments_user       on public.assignments(user_id);

alter table public.profiles     enable row level security;
alter table public.missions     enable row level security;
alter table public.assignments  enable row level security;
alter table public.time_entries enable row level security;

create or replace function public.current_user_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid();
$$;

create policy "Lecture profils par users authentifiés" on public.profiles for select using (auth.uid() is not null);
create policy "Mise à jour profil personnel" on public.profiles for update using (id = auth.uid());

create policy "Tout le monde voit les missions" on public.missions for select using (auth.uid() is not null);
create policy "Manager/Admin crée des missions" on public.missions for insert with check (public.current_user_role() in ('manager','admin'));
create policy "Manager/Admin modifie les missions" on public.missions for update using (public.current_user_role() in ('manager','admin'));

create policy "Lecture des affectations" on public.assignments for select using (auth.uid() is not null);
create policy "Manager/Admin gère les affectations" on public.assignments for all using (public.current_user_role() in ('manager','admin'));

create policy "Consultant voit ses saisies" on public.time_entries for select using (user_id = auth.uid());
create policy "Manager voit toutes les saisies" on public.time_entries for select using (public.current_user_role() in ('manager','admin'));
create policy "Consultant crée ses saisies" on public.time_entries for insert with check (user_id = auth.uid());
create policy "Consultant modifie ses saisies" on public.time_entries for update using (user_id = auth.uid());
create policy "Consultant supprime ses saisies" on public.time_entries for delete using (user_id = auth.uid());

insert into public.missions (name, client, pole, budget_days, start_date, end_date, status) values
  ('Bilan Carbone 2025',      'EcoTech Solutions', 'Releaf Carbon',      45, '2025-01-15', '2025-09-30', 'active'),
  ('Plan Climat Territorial', 'Ville de Lyon',     'Releaf Energy',      60, '2025-03-01', '2025-12-31', 'active'),
  ('Audit Biodiversité',      'AgroVert',          'Releaf Biodiversity',30, '2025-02-01', '2025-07-31', 'active'),
  ('Mobilité Durable',        'TransportPlus',     'Releaf LCA',         40, '2025-04-01', '2025-10-31', 'active');
