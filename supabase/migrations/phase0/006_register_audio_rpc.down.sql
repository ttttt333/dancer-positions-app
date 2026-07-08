-- Phase 0 / 006 ロールバック（依存の逆順）

drop function if exists public.choreocore_touch_audio_access(uuid);
drop function if exists public.choreocore_register_project_audio(
  bigint, text, text, text, bigint, numeric, text, text, boolean
);
drop function if exists public.choreocore_find_reusable_audio_asset(text);
drop function if exists public.choreocore_bind_project_audio(bigint, uuid);
drop function if exists public.choreocore_register_audio_version(
  uuid, text, text, text, bigint, numeric, text, text, bigint
);
drop function if exists public.choreocore_register_audio_version(
  uuid, text, text, text, bigint, numeric, text, text
);
drop function if exists public.choreocore_register_audio_asset(text);
drop function if exists public.choreocore_assert_checksum_sha256(text);
