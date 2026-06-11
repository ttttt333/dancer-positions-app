import { useCallback, useState } from "react";
import { fileToBase64 } from "../lib/fileToBase64";
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
    async (file: File): Promise<ParsePositionResponse | null> => {
      if (!file.type.startsWith("image/")) {
        setError("画像ファイル（JPEG / PNG など）を選んでください");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const imageBase64 = await fileToBase64(file);
        const base = apiBaseUrl();
        const res = await fetch(`${base}/api/parse-position`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64 }),
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

        return data as ParsePositionResponse;
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "画像の解析に失敗しました";
        setError(msg);
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
