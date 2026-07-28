-- CHOREOCORE: PRO 無料付与の例（Supabase SQL Editor 用）
-- 推奨: admin-grant-pro Edge Function（監査ログ付き）
-- 緊急・単発: 下記 SQL でも可
--
-- 無制限 PRO（メール allowlist）は migration 012 を SQL Editor で実行:
--   supabase/migrations/012_pro_lifetime_email_allowlist.up.sql

-- ■ 方法 A: 付与テーブル（推奨・migration 009 以降）
-- insert into public.choreocore_pro_grants (user_id, grant_type, note)
-- select id, 'complimentary', '手動付与（SQL）'
-- from auth.users
-- where lower(email) = lower('teacher@example.com');

-- ■ 方法 B: entitlement_lifetime（従来の買い切りフラグ）
-- insert into public.choreocore_user_billing (user_id, entitlement_lifetime)
-- select id, true from auth.users where lower(email) = lower('teacher@example.com')
-- on conflict (user_id) do update
--   set entitlement_lifetime = true, updated_at = now();

-- ■ interush.info@gmail.com を無制限 PRO にする（012 と同等の単発）
-- insert into public.choreocore_pro_lifetime_emails (email, note)
-- values ('interush.info@gmail.com', '無制限PRO（手動付与）')
-- on conflict (email) do update set note = excluded.note;
--
-- insert into public.choreocore_pro_grants (user_id, grant_type, note, expires_at)
-- select id, 'complimentary', '無制限PRO', null
-- from auth.users
-- where lower(email) = lower('interush.info@gmail.com');
--
-- insert into public.choreocore_user_billing (user_id, entitlement_lifetime)
-- select id, true from auth.users
-- where lower(email) = lower('interush.info@gmail.com')
-- on conflict (user_id) do update
--   set entitlement_lifetime = true, updated_at = now();

-- ■ 付与状態の確認
-- select u.email, public.choreocore_is_pro(u.id) as is_pro
-- from auth.users u
-- where lower(u.email) = lower('teacher@example.com');

-- ■ 付与履歴
-- select g.*, u.email
-- from public.choreocore_pro_grants g
-- join auth.users u on u.id = g.user_id
-- order by g.created_at desc
-- limit 20;

-- ■ 動画書き出し RPC（migration 010 / video-export-check Edge Function 未デプロイ時）
-- Supabase SQL Editor で 010_video_export_allowance_rpc.up.sql を実行してください。
