import { getSupabase, isSupabaseBackend } from "./supabaseClient";

export type VideoExportAllowanceResult =
  | { allowed: true; exportCount: number | null }
  | { allowed: false; reason: "export_limit_reached" | "unauthorized" };

export class VideoExportLimitError extends Error {
  readonly reason = "export_limit_reached" as const;

  constructor() {
    super("export_limit_reached");
    this.name = "VideoExportLimitError";
  }
}

/**
 * 書き出し開始前にサーバー側で上限チェック + カウント増分。
 * Supabase 未使用・未ログイン時はスキップ（共有閲覧の匿名利用を維持）。
 */
export async function requestVideoExportAllowance(): Promise<VideoExportAllowanceResult> {
  if (!isSupabaseBackend()) {
    return { allowed: true, exportCount: null };
  }

  const sb = getSupabase();
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) {
    return { allowed: true, exportCount: null };
  }

  const { data, error } = await sb.functions.invoke("video-export-check", {
    body: {},
  });

  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 403) {
      return { allowed: false, reason: "export_limit_reached" };
    }
    if (status === 401) {
      return { allowed: false, reason: "unauthorized" };
    }
    throw new Error(error.message || "動画書き出しの確認に失敗しました");
  }

  const payload = data as {
    allowed?: boolean;
    reason?: string;
    exportCount?: number | null;
    error?: string;
  };

  if (payload?.error) {
    throw new Error(payload.error);
  }

  if (!payload?.allowed) {
    if (payload.reason === "export_limit_reached") {
      return { allowed: false, reason: "export_limit_reached" };
    }
    return { allowed: false, reason: "unauthorized" };
  }

  return {
    allowed: true,
    exportCount:
      typeof payload.exportCount === "number" ? payload.exportCount : null,
  };
}

export async function assertVideoExportAllowed(): Promise<number | null> {
  const result = await requestVideoExportAllowance();
  if (!result.allowed) {
    if (result.reason === "export_limit_reached") {
      throw new VideoExportLimitError();
    }
    throw new Error("ログインが必要です");
  }
  return result.exportCount;
}
