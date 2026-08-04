/**
 * Pro プラン申込用の Stripe Payment Link。
 * 月額: サブスク（カード）。年額: 一括（PayPay / カード）— Dashboard で作成した Link か Edge Checkout。
 */

export const STRIPE_PRO_PAYMENT_LINK =
  "https://buy.stripe.com/eVq7sL9V52DG8I578m1RC00";

/** 年額 5500 円（税込）一括用 Payment Link（未設定なら Edge Function を使う） */
export const STRIPE_PRO_ANNUAL_PAYMENT_LINK = String(
  import.meta.env.VITE_STRIPE_PRO_ANNUAL_PAYMENT_LINK ?? ""
).trim();

export function withClientReferenceId(
  paymentLinkUrl: string,
  userId: string
): string {
  const u = new URL(paymentLinkUrl);
  u.searchParams.set("client_reference_id", userId);
  return u.toString();
}
