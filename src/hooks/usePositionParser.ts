import { useCallback, useState } from "react";
import {
  isParseableImageFile,
  prepareImageFileForParse,
} from "../lib/prepareImageForParse";
import { formatParsePositionError } from "../lib/parsePositionErrors";
import { refinePositionsWithRoster } from "../lib/matchParsedNamesToRoster";
import type { ParsePositionResponse } from "../lib/parsePositionTypes";

function apiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (raw == null || String(raw).trim() === "") return "";
  return String(raw).trim().replace(/\/+$/, "");
}

export function usePositionParser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const parseImageFile = useCallback(
    async (
      file: File,
      options?: { memberNameHints?: string[] }
    ): Promise<ParsePositionResponse | null> => {
      if (!isParseableImageFile(file)) {
        setError("画像ファイル（JPEG / PNG / HEIC など）を選んでください");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const prepared = await prepareImageFileForParse(file);
        const base = apiBaseUrl();
        const res = await fetch(`${base}/api/parse-position`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: prepared.base64,
            imageMime: prepared.mimeType,
            memberNameHints: options?.memberNameHints?.length
              ? options.memberNameHints
              : undefined,
          }),
        });

        const data = (await res.json().catch(() => ({}))) as
          | ParsePositionResponse
          | { error?: string };

        if (!res.ok) {
          const msg =
            typeof data === "object" &&
            data &&
            "error" in data &&
            typeof data.error === "string"
              ? data.error
              : `解析に失敗しました（${res.status}）`;
          throw new Error(msg);
        }

        if (
          !data ||
          typeof data !== "object" ||
          !Array.isArray((data as ParsePositionResponse).positions)
        ) {
          throw new Error("解析結果の形式が不正です");
        }

        const parsed = data as ParsePositionResponse;
        if (options?.memberNameHints?.length) {
          parsed.positions = refinePositionsWithRoster(
            parsed.positions,
            options.memberNameHints
          );
        }
        return parsed;
      } catch (e) {
        const raw =
          e instanceof Error ? e.message : "画像の解析に失敗しました";
        setError(formatParsePositionError(raw));
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    clearError,
    parseImageFile,
  };
}
