drop trigger if exists choreocore_projects_limit_trg on public.choreocore_projects;
drop function if exists public.choreocore_enforce_project_limit();

revoke all on function public.choreocore_lookup_user_id_by_email(text) from service_role;
drop function if exists public.choreocore_lookup_user_id_by_email(text);

revoke all on function public.choreocore_is_pro_me() from authenticated;
drop function if exists public.choreocore_is_pro_me();

revoke all on function public.choreocore_has_active_pro_grant(uuid) from authenticated, service_role;
drop function if exists public.choreocore_has_active_pro_grant(uuid);

-- choreocore_is_pro を付与なし版へ戻す（billing 行は残す）
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

drop policy if exists "choreocore_pro_grants select own" on public.choreocore_pro_grants;
drop table if exists public.choreocore_pro_grants;
