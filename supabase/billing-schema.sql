-- CHOREOCORE: Stripe 課金（Supabase Edge Functions 用）
-- ※ 本番適用は supabase/migrations/009_billing_core_and_pro_grants.up.sql を推奨。
--   このファイルは参照用・手動実行用のコピーです。
--
-- Edge Function のシークレット（Dashboard → Edge Functions → Secrets）:
--   STRIPE_SECRET_KEY      … Stripe のシークレットキー
--   STRIPE_PRICE_ID        … サブスク用 Price ID（price_...）
--   STRIPE_WEBHOOK_SECRET  … billing-webhook 用（whsec_...）
--   APP_BASE               … 本番 URL（例: https://dancer-positions-app.vercel.app）
--
-- Webhook エンドポイント（Stripe Dashboard）:
--   https://<project-ref>.supabase.co/functions/v1/billing-webhook

-- ---------------------------------------------------------------------------
-- 課金状態（ユーザー 1 行。更新は Edge Function の service role のみ）
-- ---------------------------------------------------------------------------
create table if not exists public.choreocore_user_billing (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  entitlement_lifetime boolean not null default false,
  updated_at timestamptz not null default now()
);

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
-- Pro 判定 & 無料プラン作品数上限（3）
-- ---------------------------------------------------------------------------
create or replace function public.choreocore_is_pro(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select b.entitlement_lifetime
        or b.subscription_status in ('active', 'trialing')
      from public.choreocore_user_billing b
      where b.user_id = uid
    ),
    false
  );
$$;

revoke all on function public.choreocore_is_pro(uuid) from public;
grant execute on function public.choreocore_is_pro(uuid) to authenticated, service_role;

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
