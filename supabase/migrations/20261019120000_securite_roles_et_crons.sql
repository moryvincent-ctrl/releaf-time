-- Durcissement sécurité (audit du 19/10/2026).
-- À exécuter dans le SQL Editor APRÈS avoir :
--   1. créé le secret Edge Function CRON_SECRET (supabase secrets set CRON_SECRET=<valeur>) ;
--   2. déployé les Edge Functions de cette PR.
-- Remplacer <CRON_SECRET> ci-dessous par la même valeur avant exécution. Idempotent.

-- ── 1. Le rôle n'est plus lu dans les métadonnées d'inscription ──────────────
-- raw_user_meta_data est fourni par le client lors d'un signUp : avec la clé anon
-- (publique), n'importe qui pouvait créer un compte avec role = 'admin'.
-- Le rôle se change désormais uniquement depuis Paramètres, par un admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'consultant'
  );
  return new;
end;
$$;

-- ── 2. Un utilisateur ne peut plus modifier son propre rôle ──────────────────
-- La policy "Mise à jour profil personnel" (id = auth.uid()) autorisait toute
-- colonne, donc un consultant pouvait passer role = 'admin' depuis la console.
-- Plutôt que de réécrire les policies, un trigger refuse le changement des
-- colonnes sensibles à tout non-admin. auth.uid() est NULL pour le service role
-- (Edge Functions) et le SQL Editor, qui restent autorisés.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.current_user_role() = 'admin' then
    return new;
  end if;
  if new.role   is distinct from old.role
  or new.email  is distinct from old.email
  or new.active is distinct from old.active
  or new.id     is distinct from old.id then
    raise exception 'Modification réservée aux admins (role, email, active)'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before update on public.profiles
  for each row execute procedure public.protect_profile_columns();

-- ── 3. Les crons s'authentifient avec un secret dédié ────────────────────────
-- Les Edge Functions refusent désormais la clé anon seule (cf. _shared/auth.ts).
do $$
begin
  if exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.update_secret(
      (select id from vault.secrets where name = 'cron_secret'), '<CRON_SECRET>');
  else
    perform vault.create_secret('<CRON_SECRET>', 'cron_secret',
      'Secret partagé pg_cron → Edge Functions (en-tête x-cron-secret)');
  end if;
end $$;

do $$
declare
  j record;
begin
  for j in
    select * from (values
      ('sync-notion-30min',             '*/30 * * * *', 'sync-notion'),
      ('sync-notion-transverse-30min',  '*/30 * * * *', 'sync-notion-transverse'),
      ('sync-hubspot-deals-10min',      '*/10 * * * *', 'sync-hubspot-deals'),
      ('sync-payfit-absences-hourly',   '7 * * * *',    'sync-payfit-absences')
    ) as t(jobname, schedule, fn)
  loop
    if exists (select 1 from cron.job where jobname = j.jobname) then
      perform cron.unschedule(j.jobname);
    end if;
    perform cron.schedule(j.jobname, j.schedule, format($cmd$
      select net.http_post(
        url := 'https://iuonrlluscszlpbagkcg.supabase.co/functions/v1/%s',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'sync_notion_anon_key' limit 1),
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
    $cmd$, j.fn));
  end loop;
end $$;

-- Le cron du rappel hebdo (weekly-reminder) n'est pas versionné : ajouter à la
-- main l'en-tête x-cron-secret à sa commande. Pour le retrouver :
-- select jobid, jobname, schedule, command from cron.job where command ilike '%weekly-reminder%';

-- Contrôles :
-- select jobname, schedule from cron.job order by jobname;
-- select tgname from pg_trigger where tgrelid = 'public.profiles'::regclass;
