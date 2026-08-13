-- 017: 世界向けリリースキャンペーン — 全ユーザーを PRO 相当として扱う
-- 終了時は 017_release_campaign_all_pro.down.sql を実行すること

create or replace function public.choreocore_is_pro(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  -- Release campaign: unlock all PRO features for every authenticated user.
  -- Billing rows / grants are still recorded for when the campaign ends.
  select true;
$$;

revoke all on function public.choreocore_is_pro(uuid) from public;
grant execute on function public.choreocore_is_pro(uuid) to authenticated, service_role;

comment on function public.choreocore_is_pro(uuid) is
  'Release campaign: always true. Revert via 017_release_campaign_all_pro.down.sql';
