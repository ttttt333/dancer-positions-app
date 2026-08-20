-- 019: 新規登録の国・地域を保存（接続元IP / タイムゾーン / 言語からの推定）

alter table public.choreocore_signup_notices
  add column if not exists country_code text,
  add column if not exists country_name text,
  add column if not exists timezone text,
  add column if not exists locale text,
  add column if not exists geo_source text;

comment on column public.choreocore_signup_notices.country_code is
  'ISO 3166-1 alpha-2 inferred at signup (not legal nationality).';
