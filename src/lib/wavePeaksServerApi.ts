import { getToken } from "../api/client";
import { normalizeWavePeaksPayload, type WavePeaksPayload } from "./wavePeaksTypes";
import { reportWaveLoadProgress } from "./waveLoadProgress";

const base = import.meta.env.VITE_API_BASE_URL ?? "";

export type ServerWavePeaksResponse =
  | { ready: true; peaks: number[]; durationSec: number; binCount: number }
  | { ready: false; status?: string };

function authHeaders(): HeadersInit {
  const token = getToken();
  if (!token) throw new Error("ログインが必要です");
  return { Authorization: `Bearer ${token}` };
}

export async function fetchServerWavePeaks(
  assetId: number
): Promise<ServerWavePeaksResponse> {
  const res = await fetch(`${base}/api/audio/${assetId}/peaks`, {
    headers: authHeaders(),
  });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("波形データの取得に失敗しました");
  }
  if (!res.ok) {
    const msg =
      typeof (data as { error?: string }).error === "string"
        ? (data as { error: string }).error
        : res.statusText;
    throw new Error(msg || "波形データの取得に失敗しました");
  }
  const row = data as ServerWavePeaksResponse;
  if (row.ready && Array.isArray(row.peaks) && row.peaks.length > 0) {
    return row;
  }
  return { ready: false, status: (row as { status?: string }).status };
}

/** サーバー生成待ちのとき短時間ポーリング */
export async function fetchServerWavePeaksWithPoll(
  assetId: number,
  opts?: { maxAttempts?: number; intervalMs?: number }
): Promise<{ peaks: number[]; durationSec: number } | null> {
  const maxAttempts = opts?.maxAttempts ?? 40;
  const intervalMs = opts?.intervalMs ?? 300;
  for (let i = 0; i < maxAttempts; i++) {
    reportWaveLoadProgress(
      0.08 + (i / maxAttempts) * 0.35,
      i === 0 ? "波形データを取得中…" : "サーバーで波形を生成中…"
    );
    const row = await fetchServerWavePeaks(assetId);
    if (row.ready) {
      return { peaks: row.peaks, durationSec: row.durationSec };
    }
    if (row.status === "failed") return null;
    await new Promise((r) => window.setTimeout(r, intervalMs));
  }
  return null;
}

/** アップロード直後など: サーバーでピークを計算（Supabase サイドカー用） */
export async function computeServerWavePeaksFromBlob(
  blob: Blob,
  filename = "audio"
): Promise<WavePeaksPayload> {
  reportWaveLoadProgress(0.2, "サーバーで波形を生成中…");
  const token = getToken();
  if (!token) throw new Error("ログインが必要です");
  const form = new FormData();
  form.append("file", blob, filename);
  const res = await fetch(`${base}/api/audio/peaks/compute`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("波形の生成に失敗しました");
  }
  if (!res.ok) {
    const msg =
      typeof (data as { error?: string }).error === "string"
        ? (data as { error: string }).error
        : res.statusText;
    throw new Error(msg || "波形の生成に失敗しました");
  }
  const payload = normalizeWavePeaksPayload(data);
  if (!payload) throw new Error("波形データが不正です");
  reportWaveLoadProgress(0.85, "波形を反映中…");
  return payload;
}

export function payloadToPeaksResult(payload: WavePeaksPayload): {
  peaks: number[];
  durationSec: number;
} {
  return { peaks: payload.peaks, durationSec: payload.durationSec };
}
