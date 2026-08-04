-- 年額一括払い（PayPay 等）用の Pro 付与タイプと、Checkout セッション冪等

alter table public.choreocore_pro_grants
  drop constraint if exists choreocore_pro_grants_grant_type_check;

alter table public.choreocore_pro_grants
  add constraint choreocore_pro_grants_grant_type_check
  check (
    grant_type in (
      'complimentary',
      'beta',
      'partner',
      'staff',
      'prepaid_annual'
    )
  );

alter table public.choreocore_pro_grants
  add column if not exists stripe_checkout_session_id text;

create unique index if not exists choreocore_pro_grants_checkout_session_uidx
  on public.choreocore_pro_grants (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
