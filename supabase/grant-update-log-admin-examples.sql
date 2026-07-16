-- UPDATE LOG を編集できる管理者メールを登録する例
-- Supabase SQL Editor で実行してください（011_update_log.up.sql 適用後）。

-- insert into public.choreocore_admin_emails (email)
-- values ('your-admin@example.com')
-- on conflict (email) do nothing;

-- クライアント側の編集 UI 表示用（任意）:
-- .env / Vercel に VITE_CHOREOCORE_ADMIN_EMAILS=your-admin@example.com も設定すると
-- ページ上の「編集」ボタンがすぐ出ます（保存権限は上記テーブル側が本体）。
