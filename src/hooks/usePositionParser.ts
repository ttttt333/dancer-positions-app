import { useCallback, useRef, useState } from "react";
import {
  isParseableImageFile,
  prepareImageFileForParse,
} from "../lib/prepareImageForParse";
import { formatParsePositionError } from "../lib/parsePositionErrors";
import { mergeParseResults } from "../lib/mergeParseResults";
import { refineParsedPositions } from "../lib/refineParsedPositions";
import { parseApiRequestHeaders } from "../lib/parseApiHeaders";
import type { ParsePositionResponse } from "../lib/parsePositionTypes";

export type ParseImageProgress = {
  current: number;
  total: number;
  fileName: string;
};

function apiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (raw == null || String(raw).trim() === "") return "";
  return String(raw).trim().replace(/\/+$/, "");
}

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof DOMException && e.name === "AbortError") ||
    (e instanceof Error && e.name === "AbortError")
  );
}

export function usePositionParser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setError(null);
  }, []);

  const parseOneImage = useCallback(
    async (
      file: File,
      options?: { memberNameHints?: string[]; signal?: AbortSignal }
    ): Promise<ParsePositionResponse> => {
      const memberNameHints = options?.memberNameHints;
      const prepared = await prepareImageFileForParse(file);
      if (options?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const base = apiBaseUrl();
      const headers = await parseApiRequestHeaders();
      const res = await fetch(`${base}/api/parse-position`, {
        method: "POST",
        headers,
        signal: options?.signal,
        body: JSON.stringify({
          imageBase64: prepared.base64,
          imageMime: prepared.mimeType,
          memberNameHints: memberNameHints?.length ? memberNameHints : undefined,
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

      return refineParsedPositions(
        data as ParsePositionResponse,
        memberNameHints ?? []
      );
    },
    []
  );

  const parseImageFile = useCallback(
    async (
      file: File,
      options?: { memberNameHints?: string[] }
    ): Promise<ParsePositionResponse | null> => {
      if (!isParseableImageFile(file)) {
        setError("画像ファイル（JPEG / PNG / HEIC など）を選んでください");
        return null;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      try {
        return await parseOneImage(file, {
          ...options,
          signal: controller.signal,
        });
      } catch (e) {
        if (isAbortError(e)) return null;
        const raw =
          e instanceof Error ? e.message : "画像の解析に失敗しました";
        setError(formatParsePositionError(raw));
        return null;
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setLoading(false);
      }
    },
    [parseOneImage]
  );

  const parseImageFiles = useCallback(
    async (
      files: File[],
      options?: {
        memberNameHints?: string[];
        onProgress?: (progress: ParseImageProgress) => void;
      }
    ): Promise<ParsePositionResponse | null> => {
      const valid = files.filter(isParseableImageFile);
      if (!valid.length) {
        setError("画像ファイル（JPEG / PNG / HEIC など）を選んでください");
        return null;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      try {
        const results: ParsePositionResponse[] = [];
        for (let i = 0; i < valid.length; i++) {
          if (controller.signal.aborted) return null;
          const file = valid[i]!;
          options?.onProgress?.({
            current: i + 1,
            total: valid.length,
            fileName: file.name,
          });
          const result = await parseOneImage(file, {
            memberNameHints: options?.memberNameHints,
            signal: controller.signal,
          });
          if (result.positions.length) results.push(result);
        }

        if (!results.length) {
          throw new Error("画像から立ち位置を読み取れませんでした");
        }

        return valid.length === 1 ? results[0]! : mergeParseResults(results);
      } catch (e) {
        if (isAbortError(e)) return null;
        const raw =
          e instanceof Error ? e.message : "画像の解析に失敗しました";
        setError(formatParsePositionError(raw));
        return null;
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setLoading(false);
      }
    },
    [parseOneImage]
  );

  return {
    loading,
    error,
    clearError,
    reset,
    parseImageFile,
    parseImageFiles,
  };
}
