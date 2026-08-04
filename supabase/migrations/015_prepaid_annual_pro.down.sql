-- 015 rollback: prepaid_annual grant type + session id

drop index if exists public.choreocore_pro_grants_checkout_session_uidx;

alter table public.choreocore_pro_grants
  drop column if exists stripe_checkout_session_id;

-- prepaid_annual 行が残っていると旧 check に戻せないため、先に失効扱いにする
update public.choreocore_pro_grants
  set revoked_at = coalesce(revoked_at, now()),
      note = coalesce(note, '') || ' [015 down: prepaid_annual revoked]'
  where grant_type = 'prepaid_annual'
    and revoked_at is null;

alter table public.choreocore_pro_grants
  drop constraint if exists choreocore_pro_grants_grant_type_check;

alter table public.choreocore_pro_grants
  add constraint choreocore_pro_grants_grant_type_check
  check (grant_type in ('complimentary', 'beta', 'partner', 'staff'));
