drop trigger if exists choreocore_on_auth_user_created on auth.users;
drop function if exists public.choreocore_on_auth_user_created();
drop table if exists public.choreocore_signup_notices;
