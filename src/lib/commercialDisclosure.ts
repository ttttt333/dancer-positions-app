/**
 * 特定商取引法に基づく表記・申込み確認用の共通文言。
 * ※ 法的助言ではありません。事業者情報の空欄は運営側で確定し、専門家レビューを推奨します。
 */

/** 実際の Stripe trial（billing.ts 既定）に合わせる */
export const PRO_TRIAL_DAYS = 7;

export const PRO_PRICE_YEN_TAX_IN = 550;

/** 年額一括（PayPay / カード）税込 */
export const PRO_ANNUAL_PRICE_YEN_TAX_IN = 5500;

export const PRO_ANNUAL_DAYS = 365;

export type ProCheckoutPlan = "monthly" | "annual";

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
export function planConfirmationItems(
  plan: ProCheckoutPlan
): ReadonlyArray<{ term: string; description: string }> {
  if (plan === "annual") {
    return [
      {
        term: "分量（プラン）",
        description: "PROプラン（年額・1年間）",
      },
      {
        term: "販売価格・対価",
        description: `年額${PRO_ANNUAL_PRICE_YEN_TAX_IN}円（税込）。決済完了日から${PRO_ANNUAL_DAYS}日間 PRO を利用できます。自動更新はありません。`,
      },
      {
        term: "支払時期及び支払方法",
        description:
          "申込み時に一括でお支払い（PayPay またはクレジットカード／Stripe）。無料トライアルはありません。",
      },
      {
        term: "提供時期",
        description: "決済完了後、即時にPRO機能が有効になります。",
      },
      {
        term: "申込みの期間",
        description: "常時申込み可能",
      },
      {
        term: "申込みの撤回・解除に関する事項",
        description:
          "年額一括のため、決済後の途中解約による日割り返金はありません。有効期間終了後は FREE プランに戻ります。再度申し込むと、残存期間がある場合はその末日の翌日からさらに1年延長されます。",
      },
    ];
  }

  return [
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
}

/** @deprecated planConfirmationItems("monthly") を使用 */
export const PLAN_CONFIRMATION_ITEMS = planConfirmationItems("monthly");

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
    value: [
      `PROプラン（月額）: 月額${PRO_PRICE_YEN_TAX_IN}円（税込）・自動更新`,
      `PROプラン（年額）: 年額${PRO_ANNUAL_PRICE_YEN_TAX_IN}円（税込）・${PRO_ANNUAL_DAYS}日間・自動更新なし`,
      "FREEプラン: 無料",
      "※ いずれも税込です。",
    ].join("\n"),
  },
  {
    label: "商品代金以外の必要料金",
    value: "特になし（通信費等はお客様負担）",
  },
  {
    label: "支払方法",
    value:
      "クレジットカード決済（Stripe）／年額プランは PayPay またはクレジットカード（Stripe）",
  },
  {
    label: "支払時期",
    value: [
      `【月額】初回申込日から${PRO_TRIAL_DAYS}日間の無料トライアル終了後、毎月同日に自動課金`,
      `【年額】申込み時に${PRO_ANNUAL_PRICE_YEN_TAX_IN}円を一括支払い（トライアルなし）`,
    ].join("\n"),
  },
  {
    label: "サービス提供時期",
    value: "決済完了後、直ちにPRO機能を利用可能",
  },
  { label: "申込みの期間", value: "特になし（常時申込み可能）" },
  {
    label: "契約期間・自動更新に関する事項",
    value: [
      "【月額】月額契約で、解約しない限り契約は自動的に更新されます。最低契約期間の縛りはありません。",
      `【年額】決済完了日から${PRO_ANNUAL_DAYS}日間。自動更新はありません。期間終了後は FREE に戻ります。`,
    ].join("\n"),
  },
  {
    label: "解約・退会について",
    value: [
      "【月額】",
      "・アプリ内の「設定 > プラン管理・解約」からいつでも解約可能",
      "・解約手続きをした場合、次回更新日以降の課金は発生しません",
      "・既に課金された当月分の利用料は返金しません（月の途中解約でも当月分の返金なし）",
      "・無料トライアル期間中に解約した場合、課金は発生しません",
      "【年額】",
      "・一括払いのため、途中解約による日割り返金はありません",
      "・有効期間の終了をもって PRO は終了します",
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
