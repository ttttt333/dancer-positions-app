/** 動画書き出し失敗時のユーザー向けメッセージ */

export type VideoExportErrorPresentation = {
  title: string;
  description: string;
};

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isRetryableExportNetworkError(error: unknown): boolean {
  const s = errorText(error).toLowerCase();
  return (
    s.includes("network") ||
    s.includes("err_network") ||
    s.includes("failed to fetch") ||
    s.includes("load failed")
  );
}

export function isCoepRelatedExportError(error: unknown): boolean {
  const s = errorText(error).toLowerCase();
  return (
    s.includes("coep") ||
    s.includes("coop") ||
    s.includes("crossoriginisolated") ||
    s.includes("notsameoriginafterdefaultedtosameoriginbycoep") ||
    s.includes("blockedbyresponse")
  );
}

export function formatVideoExportError(
  error: unknown
): VideoExportErrorPresentation {
  const msg = errorText(error);

  if (error instanceof Error && error.name === "ExportBackgroundedError") {
    return {
      title: "録画が中断されました",
      description:
        "録画中はアプリを閉じたり画面を消したりしないでください。もう一度最初からお試しください。",
    };
  }

  if (/ERR_NETWORK_CHANGED|network changed/i.test(msg)) {
    return {
      title: "ネットワークが切り替わりました",
      description:
        "Wi-Fi や VPN の切替中に通信が途切れました。接続を安定させてからもう一度お試しください。",
    };
  }

  if (isCoepRelatedExportError(error)) {
    return {
      title: "ブラウザのセキュリティ制限",
      description:
        "ページをハードリロード（Cmd+Shift+R）してから再試行してください。改善しない場合は別ブラウザでお試しください。",
    };
  }

  if (/タイムアウト|timeout/i.test(msg)) {
    return {
      title: "処理がタイムアウトしました",
      description:
        "尺が長い場合は時間がかかります。タブを閉じて短い範囲で再試行するか、しばらく待ってから再度実行してください。",
    };
  }

  if (isRetryableExportNetworkError(error)) {
    return {
      title: "通信エラー",
      description:
        "ネットワークが不安定です。接続を確認してからもう一度書き出してください。",
    };
  }

  return {
    title: "エクスポート失敗",
    description: msg || "動画の保存に失敗しました",
  };
}
