-- 018: 新規ユーザー登録を Edge Function 経由で通知
-- Secrets（Dashboard → Edge Functions → Secrets）:
--   RESEND_API_KEY
--   SIGNUP_NOTIFY_SECRET
-- SQL 側シークレットは public.choreocore_app_settings に入れる:
--   notify_new_user_secret … Edge の SIGNUP_NOTIFY_SECRET と同じ値
--   supabase_anon_key … VITE_SUPABASE_ANON_KEY

create table if not exists public.choreocore_signup_notices (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now()
);

comment on table public.choreocore_signup_notices is
  'Signup notification dedupe. Rows are inserted by notify-new-user Edge Function.';

alter table public.choreocore_signup_notices enable row level security;

revoke all on table public.choreocore_signup_notices from public, anon, authenticated;
grant all on table public.choreocore_signup_notices to service_role;

create table if not exists public.choreocore_app_settings (
  key text primary key,
  value text not null
);

comment on table public.choreocore_app_settings is
  'Private app settings for SECURITY DEFINER triggers. Not exposed via RLS.';

alter table public.choreocore_app_settings enable row level security;

revoke all on table public.choreocore_app_settings from public, anon, authenticated;

create extension if not exists pg_net;

create or replace function public.choreocore_on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  fn_url text;
  secret text;
  anon text;
  headers jsonb;
begin
  select value into secret
  from public.choreocore_app_settings
  where key = 'notify_new_user_secret';

  if secret is null or secret = '' then
    return new;
  end if;

  select value into anon
  from public.choreocore_app_settings
  where key = 'supabase_anon_key';

  fn_url := 'https://iiziplsgfoijvnrsehms.supabase.co/functions/v1/notify-new-user';
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-choreocore-notify-secret', secret
  );
  if anon is not null and anon <> '' then
    headers := headers || jsonb_build_object(
      'Authorization', 'Bearer ' || anon,
      'apikey', anon
    );
  end if;

  perform net.http_post(
    url := fn_url,
    headers := headers,
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'id', new.id,
        'email', new.email,
        'created_at', new.created_at,
        'email_confirmed_at', new.email_confirmed_at,
        'raw_app_meta_data', new.raw_app_meta_data,
        'raw_user_meta_data', new.raw_user_meta_data
      )
    )
  );
  return new;
exception when others then
  raise warning 'choreocore_on_auth_user_created: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists choreocore_on_auth_user_created on auth.users;
create trigger choreocore_on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.choreocore_on_auth_user_created();

revoke all on function public.choreocore_on_auth_user_created() from public;
