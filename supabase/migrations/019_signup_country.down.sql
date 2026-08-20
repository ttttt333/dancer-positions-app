alter table public.choreocore_signup_notices
  drop column if exists country_code,
  drop column if exists country_name,
  drop column if exists timezone,
  drop column if exists locale,
  drop column if exists geo_source;
