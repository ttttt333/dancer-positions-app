-- CHOREOCORE: 課金コア（billing-schema.sql 相当）+ PRO 無料付与テーブル
-- 本番で billing-schema.sql を手動実行していなくても、この migration で揃う想定。

-- ---------------------------------------------------------------------------
-- 課金状態（ユーザー 1 行）
-- ---------------------------------------------------------------------------
create table if not exists public.choreocore_user_billing (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  entitlement_lifetime boolean not null default false,
  video_export_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.choreocore_user_billing
  add column if not exists video_export_count integer not null default 0;

create index if not exists choreocore_user_billing_stripe_sub_idx
  on public.choreocore_user_billing (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.choreocore_user_billing enable row level security;

drop policy if exists "choreocore_billing select own" on public.choreocore_user_billing;
create policy "choreocore_billing select own" on public.choreocore_user_billing
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 管理者付与 PRO（監査ログ付き）
-- ---------------------------------------------------------------------------
create table if not exists public.choreocore_pro_grants (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  grant_type text not null default 'complimentary'
    check (grant_type in ('complimentary', 'beta', 'partner', 'staff')),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists choreocore_pro_grants_user_id_idx
  on public.choreocore_pro_grants (user_id);

create index if not exists choreocore_pro_grants_active_idx
  on public.choreocore_pro_grants (user_id)
  where revoked_at is null;

alter table public.choreocore_pro_grants enable row level security;

drop policy if exists "choreocore_pro_grants select own" on public.choreocore_pro_grants;
create policy "choreocore_pro_grants select own" on public.choreocore_pro_grants
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 有効な付与 PRO があるか
-- ---------------------------------------------------------------------------
create or replace function public.choreocore_has_active_pro_grant(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.choreocore_pro_grants g
    where g.user_id = p_user_id
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
  );
$$;

revoke all on function public.choreocore_has_active_pro_grant(uuid) from public;
grant execute on function public.choreocore_has_active_pro_grant(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Pro 判定（Stripe / lifetime / 付与）
-- ---------------------------------------------------------------------------
create or replace function public.choreocore_is_pro(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (
        select b.entitlement_lifetime
          or b.subscription_status in ('active', 'trialing')
        from public.choreocore_user_billing b
        where b.user_id = uid
      ),
      false
    )
    or public.choreocore_has_active_pro_grant(uid);
$$;

revoke all on function public.choreocore_is_pro(uuid) from public;
grant execute on function public.choreocore_is_pro(uuid) to authenticated, service_role;

create or replace function public.choreocore_is_pro_me()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.choreocore_is_pro(auth.uid());
$$;

revoke all on function public.choreocore_is_pro_me() from public;
grant execute on function public.choreocore_is_pro_me() to authenticated;

-- ---------------------------------------------------------------------------
-- 管理者用: メール → user_id（service_role / Edge Function のみ）
-- ---------------------------------------------------------------------------
create or replace function public.choreocore_lookup_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.choreocore_lookup_user_id_by_email(text) from public;
grant execute on function public.choreocore_lookup_user_id_by_email(text) to service_role;

-- ---------------------------------------------------------------------------
-- 無料プラン作品数上限（3）— INSERT 時に強制
-- ---------------------------------------------------------------------------
create or replace function public.choreocore_enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  if public.choreocore_is_pro(NEW.user_id) then
    return NEW;
  end if;
  select count(*) into n
  from public.choreocore_projects
  where user_id = NEW.user_id;
  if n >= 3 then
    raise exception 'free_limit'
      using hint = '無料プランの作品数上限（3作品）に達しました';
  end if;
  return NEW;
end;
$$;

drop trigger if exists choreocore_projects_limit_trg on public.choreocore_projects;
create trigger choreocore_projects_limit_trg
  before insert on public.choreocore_projects
  for each row
  execute function public.choreocore_enforce_project_limit();
