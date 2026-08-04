-- 追加の無制限 PRO メール（Stripe 不要）
-- クライアント: src/lib/complimentaryProEmails.ts と揃えること

insert into public.choreocore_pro_lifetime_emails (email, note)
values
  ('zazamin0808@gmail.com', '無制限PRO（手動付与）'),
  ('aoi753695@gmail.com', '無制限PRO（手動付与）')
on conflict (email) do update
  set note = excluded.note;

insert into public.choreocore_pro_grants (user_id, grant_type, note, expires_at)
select
  u.id,
  'complimentary',
  '無制限PRO（lifetime email allowlist）',
  null
from auth.users u
where lower(u.email) in (
  lower('zazamin0808@gmail.com'),
  lower('aoi753695@gmail.com')
)
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
where lower(u.email) in (
  lower('zazamin0808@gmail.com'),
  lower('aoi753695@gmail.com')
)
on conflict (user_id) do update
  set entitlement_lifetime = true,
      updated_at = now();
