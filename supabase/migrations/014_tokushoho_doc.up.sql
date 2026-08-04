-- 特定商取引法に基づく表記（単一行ドキュメント）
-- 誰でも閲覧可。更新は choreocore_admin_emails（011）に載ったログインユーザーのみ。

create table if not exists public.choreocore_tokushoho (
  id integer primary key default 1 check (id = 1),
  body text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

insert into public.choreocore_tokushoho (id, body)
values (
  1,
  E'特定商取引法に基づく表記\n\n■ 事業者名\nMyCrate合同会社\n\n■ 代表者\n［要記入：代表者氏名］\n\n■ 所在地\n［要記入：登記上の所在地（郵便番号〜番地）］\n\n■ 電話番号\n［要記入：連絡可能な電話番号］\n※ 所在地・電話番号の一部省略可否は専門家確認のうえ差し替えてください。\n\n■ メールアドレス\ninterush.info@gmail.com\n\n■ 運営統括責任者\n代表者に同じ\n\n■ サービス名\nCHOREOCORE\n\n■ 販売価格\nPROプラン: 月額550円（税込）\nFREEプラン: 無料\n※ 解約しない限り契約は毎月自動更新されます。\n\n■ 商品代金以外の必要料金\n特になし（通信費等はお客様負担）\n\n■ 支払方法\nクレジットカード決済（Stripe）\n\n■ 支払時期\n初回申込日から7日間の無料トライアル終了後、毎月同日に自動課金\n\n■ サービス提供時期\n決済（カード登録）完了後、直ちにPRO機能を利用可能\n\n■ 申込みの期間\n特になし（常時申込み可能）\n\n■ 契約期間・自動更新に関する事項\n月額契約で、解約しない限り契約は自動的に更新されます。最低契約期間の縛りはありません。\n\n■ 解約・退会について\n・アプリ内の「設定 > プラン管理・解約」からいつでも解約可能\n・解約手続きをした場合、次回更新日以降の課金は発生しません\n・既に課金された当月分の利用料は返金しません（月の途中解約でも当月分の返金なし）\n・無料トライアル期間中に解約した場合、課金は発生しません\n\n■ 動作環境\n最新版の Google Chrome / Safari / Edge を推奨\n'
)
on conflict (id) do nothing;

alter table public.choreocore_tokushoho enable row level security;

drop policy if exists choreocore_tokushoho_select_all on public.choreocore_tokushoho;
create policy choreocore_tokushoho_select_all
  on public.choreocore_tokushoho
  for select
  to anon, authenticated
  using (true);

create or replace function public.choreocore_get_tokushoho()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.choreocore_tokushoho%rowtype;
begin
  select * into r from public.choreocore_tokushoho where id = 1;
  if not found then
    return jsonb_build_object(
      'body', '',
      'updatedAt', null,
      'canEdit', public.choreocore_is_update_log_admin()
    );
  end if;
  return jsonb_build_object(
    'body', r.body,
    'updatedAt', r.updated_at,
    'canEdit', case
      when auth.uid() is null then false
      else public.choreocore_is_update_log_admin()
    end
  );
end;
$$;

revoke all on function public.choreocore_get_tokushoho() from public;
grant execute on function public.choreocore_get_tokushoho() to anon, authenticated;

create or replace function public.choreocore_save_tokushoho(p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.choreocore_tokushoho%rowtype;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;
  if not public.choreocore_is_update_log_admin() then
    raise exception '管理者権限がありません';
  end if;

  insert into public.choreocore_tokushoho (id, body, updated_at, updated_by)
  values (1, coalesce(p_body, ''), now(), auth.uid())
  on conflict (id) do update
    set body = excluded.body,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
  returning * into r;

  return jsonb_build_object(
    'body', r.body,
    'updatedAt', r.updated_at,
    'canEdit', true
  );
end;
$$;

revoke all on function public.choreocore_save_tokushoho(text) from public;
grant execute on function public.choreocore_save_tokushoho(text) to authenticated;
