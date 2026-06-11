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
  if (message.includes("Empty response from vision model")) {
    return (
      "AI が画像を解析できませんでした（空の応答）。\n" +
      "写真が暗すぎる・極端に小さい・ぼやけている場合は別の写真でお試しください。しばらく待ってから再実行してください。"
    );
  }
  if (message.includes("too small or corrupted")) {
    return "画像データが壊れているか小さすぎます。もう一度写真を選び直してください。";
  }
  if (message.includes("truncated") || message.includes("too large")) {
    return "画像が大きすぎて解析が途中で切れました。もう一度お試しください（自動で縮小しています）。";
  }
  return message;
}
