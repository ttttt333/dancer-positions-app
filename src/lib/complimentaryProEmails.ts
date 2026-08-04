/**
 * 無制限 PRO にするメール（小文字比較）。
 * DB 側は supabase/migrations/012・013 の choreocore_pro_lifetime_emails と揃える。
 */
export const COMPLIMENTARY_PRO_EMAILS: readonly string[] = [
  "interush.info@gmail.com",
  "zazamin0808@gmail.com",
  "aoi753695@gmail.com",
];

export function isComplimentaryProEmail(
  email: string | null | undefined
): boolean {
  const normalized = String(email ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  return COMPLIMENTARY_PRO_EMAILS.some((e) => e.toLowerCase() === normalized);
}
