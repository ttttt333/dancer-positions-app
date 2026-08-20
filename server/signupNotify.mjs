/** ローカル Express 登録時の通知。失敗しても登録 API は止めない。 */

const TO = (process.env.SIGNUP_NOTIFY_TO || "interush.info@gmail.com").trim();
const FROM = (
  process.env.SIGNUP_NOTIFY_FROM || "ChoreoCore <onboarding@resend.dev>"
).trim();

function tokyo(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export async function notifyLocalSignup({ email, userId, createdAt, provider }) {
  const key = String(process.env.RESEND_API_KEY || "").trim();
  if (!key) return;
  const when = tokyo(createdAt || new Date().toISOString());
  const method = provider === "google" ? "Google" : "メール＋パスワード（ローカル）";
  const subject = `【ChoreoCore】新規ユーザー登録: ${email}`;
  const text = [
    "ChoreoCore に新しいユーザーが登録しました。",
    "",
    `メール: ${email}`,
    `表示名: （未設定）`,
    `登録方法: ${method}`,
    `ユーザーID: ${userId}`,
    `登録日時: ${when}（日本時間）`,
    `メール確認: 済み`,
    "",
    "https://dancer-positions-app.vercel.app/",
  ].join("\n");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        subject,
        text,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[signup-notify] Resend", res.status, err);
    }
  } catch (e) {
    console.error("[signup-notify]", e);
  }
}
