-- 017 down: リリースキャンペーン終了 — PRO 判定を通常ロジックへ戻す

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

comment on function public.choreocore_is_pro(uuid) is
  'Returns true when the user has active/trialing subscription, lifetime, or grant';
