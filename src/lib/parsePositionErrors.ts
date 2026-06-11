/** API / クライアント共通: 写真解析エラーをユーザー向け日本語に */
export function formatParsePositionError(message: string): string {
  if (message.includes("OPENAI_API_KEY is not configured")) {
    return (
      "サーバーに OpenAI API キーが設定されていません。\n" +
      "Vercel → プロジェクト → Settings → Environment Variables で " +
      "「OPENAI_API_KEY」（VITE_ なし）を Production に追加し、保存後に Redeploy してください。"
    );
  }
  if (message.includes("HEIC")) {
    return message;
  }
  return message;
}
