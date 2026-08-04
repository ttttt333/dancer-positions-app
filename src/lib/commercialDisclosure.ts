/**
 * 特定商取引法に基づく表記・申込み確認用の共通文言。
 * ※ 法的助言ではありません。事業者情報の空欄は運営側で確定し、専門家レビューを推奨します。
 */

/** 実際の Stripe trial（billing.ts 既定）に合わせる */
export const PRO_TRIAL_DAYS = 7;

export const PRO_PRICE_YEN_TAX_IN = 550;

export const SERVICE_NAME = "CHOREOCORE";

/** 事業者・連絡先（空欄は運営記入が必要） */
export const BUSINESS = {
  name: "MyCrate合同会社",
  representative: "［要記入：代表者氏名］",
  address: "［要記入：登記上の所在地（郵便番号〜番地）］",
  phone: "［要記入：連絡可能な電話番号］",
  email: "interush.info@gmail.com",
  /** 代表者と同一の場合の表記 */
  operationsManager: "代表者に同じ",
} as const;

export const PLAN_CONFIRM_PATH = "/billing/confirm";

export const TOKUSHOHO_PATH = "/legal/tokushoho";

/** 申込み直前確認画面の6項目（2022年改正） */
export const PLAN_CONFIRMATION_ITEMS: ReadonlyArray<{
  term: string;
  description: string;
}> = [
  {
    term: "分量（プラン）",
    description: "PROプラン（月額）",
  },
  {
    term: "販売価格・対価",
    description: `月額${PRO_PRICE_YEN_TAX_IN}円（税込）。解約しない限り毎月自動更新されます。`,
  },
  {
    term: "支払時期及び支払方法",
    description: `本日から${PRO_TRIAL_DAYS}日間無料。${PRO_TRIAL_DAYS + 1}日目にご登録のクレジットカードへ${PRO_PRICE_YEN_TAX_IN}円が課金され、以降毎月同日に自動課金されます（Stripe）。`,
  },
  {
    term: "提供時期",
    description: "決済（カード登録）完了後、即時にPRO機能が有効になります。",
  },
  {
    term: "申込みの期間",
    description: "常時申込み可能",
  },
  {
    term: "申込みの撤回・解除に関する事項",
    description:
      "アプリ内の「設定 > プラン管理・解約」からいつでも解約できます。解約後は次回更新日以降の課金は発生しません。課金済みの当月分は返金されません。無料トライアル期間中の解約では課金は発生しません。",
  },
];

export type TokushohoRow = { label: string; value: string };

/** 独立ページ用のフル項目 */
export const TOKUSHOHO_ROWS: ReadonlyArray<TokushohoRow> = [
  { label: "事業者名", value: BUSINESS.name },
  { label: "代表者", value: BUSINESS.representative },
  { label: "所在地", value: BUSINESS.address },
  {
    label: "電話番号",
    value: `${BUSINESS.phone}\n※ 所在地・電話番号の一部省略可否は専門家確認のうえ、必要に応じて「請求があった場合に遅滞なく開示」へ差し替えてください。`,
  },
  { label: "メールアドレス", value: BUSINESS.email },
  { label: "運営統括責任者", value: BUSINESS.operationsManager },
  { label: "サービス名", value: SERVICE_NAME },
  {
    label: "販売価格",
    value: `PROプラン: 月額${PRO_PRICE_YEN_TAX_IN}円（税込）\nFREEプラン: 無料\n※ 税込であることを明記しています。解約しない限り契約は毎月自動更新されます。`,
  },
  {
    label: "商品代金以外の必要料金",
    value: "特になし（通信費等はお客様負担）",
  },
  { label: "支払方法", value: "クレジットカード決済（Stripe）" },
  {
    label: "支払時期",
    value: `初回申込日から${PRO_TRIAL_DAYS}日間の無料トライアル終了後、毎月同日に自動課金\n（例: 1月10日に登録した場合、初回課金は1月${10 + PRO_TRIAL_DAYS}日、以降毎月10日）`,
  },
  {
    label: "サービス提供時期",
    value: "決済（カード登録）完了後、直ちにPRO機能を利用可能",
  },
  { label: "申込みの期間", value: "特になし（常時申込み可能）" },
  {
    label: "契約期間・自動更新に関する事項",
    value:
      "月額契約で、解約しない限り契約は自動的に更新されます。最低契約期間の縛りはありません。",
  },
  {
    label: "解約・退会について",
    value: [
      "・アプリ内の「設定 > プラン管理・解約」からいつでも解約可能",
      "・解約手続きをした場合、次回更新日以降の課金は発生しません",
      "・既に課金された当月分の利用料は返金しません（月の途中解約でも当月分の返金なし）",
      "・無料トライアル期間中に解約した場合、課金は発生しません",
    ].join("\n"),
  },
  {
    label: "動作環境",
    value: "最新版の Google Chrome / Safari / Edge を推奨",
  },
];

/** 編集可能な表記ページの初期本文（DB / ローカル未保存時） */
export function buildDefaultTokushohoBody(): string {
  const lines = [
    "特定商取引法に基づく表記",
    "",
    "本ページは一般的な情報開示のためのものです。［要記入］の項目は事業者情報が確定次第更新してください。",
    "",
  ];
  for (const row of TOKUSHOHO_ROWS) {
    lines.push(`■ ${row.label}`);
    lines.push(row.value);
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
