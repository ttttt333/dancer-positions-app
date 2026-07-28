-- 特定メールを無期限 PRO にする（Stripe 不要）
-- クライアント側 allowlist（src/lib/complimentaryProEmails.ts）と揃えること

create table if not exists public.choreocore_pro_lifetime_emails (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);

alter table public.choreocore_pro_lifetime_emails enable row level security;

-- 本人確認用の参照のみ（編集は SQL / service_role）
drop policy if exists choreocore_pro_lifetime_emails_select_self
  on public.choreocore_pro_lifetime_emails;
create policy choreocore_pro_lifetime_emails_select_self
  on public.choreocore_pro_lifetime_emails
  for select
  to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

insert into public.choreocore_pro_lifetime_emails (email, note)
values (
  'interush.info@gmail.com',
  '無制限PRO（手動付与）'
)
on conflict (email) do update
  set note = excluded.note;

-- Pro 判定に lifetime メール allowlist を追加
create or replace function public.choreocore_is_pro(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
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
    or public.choreocore_has_active_pro_grant(uid)
    or exists (
      select 1
      from auth.users u
      join public.choreocore_pro_lifetime_emails e
        on lower(e.email) = lower(u.email)
      where u.id = uid
    );
$$;

revoke all on function public.choreocore_is_pro(uuid) from public;
grant execute on function public.choreocore_is_pro(uuid) to authenticated, service_role;

-- 既存ユーザーがいれば監査ログ＋買い切りフラグも立てる
insert into public.choreocore_pro_grants (user_id, grant_type, note, expires_at)
select
  u.id,
  'complimentary',
  '無制限PRO（lifetime email allowlist）',
  null
from auth.users u
where lower(u.email) = lower('interush.info@gmail.com')
  and not exists (
    select 1
    from public.choreocore_pro_grants g
    where g.user_id = u.id
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
  );

insert into public.choreocore_user_billing (user_id, entitlement_lifetime, updated_at)
select u.id, true, now()
from auth.users u
where lower(u.email) = lower('interush.info@gmail.com')
on conflict (user_id) do update
  set entitlement_lifetime = true,
      updated_at = now();
