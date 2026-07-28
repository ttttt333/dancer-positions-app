-- Revert 012_pro_lifetime_email_allowlist

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

drop policy if exists choreocore_pro_lifetime_emails_select_self
  on public.choreocore_pro_lifetime_emails;
drop table if exists public.choreocore_pro_lifetime_emails;
