import {
  entriesFromFullNames,
  entriesFromRosterRows,
  type RosterHintEntry,
} from "./extractRosterNameHints";
import {
  isParseableImageFile,
  prepareImageFileForParse,
} from "./prepareImageForParse";
import { parseRosterFile } from "./rosterFileImport";
import { formatParsePositionError } from "./parsePositionErrors";

function apiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (raw == null || String(raw).trim() === "") return "";
  return String(raw).trim().replace(/\/+$/, "");
}

async function parseRosterNamesFromImage(file: File): Promise<string[]> {
  const prepared = await prepareImageFileForParse(file);
  const base = apiBaseUrl();
  const res = await fetch(`${base}/api/parse-roster-names`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: prepared.base64,
      imageMime: prepared.mimeType,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as
    | { names?: string[] }
    | { error?: string };

  if (!res.ok) {
    const msg =
      typeof data === "object" &&
      data &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `名簿画像の読み取りに失敗しました（${res.status}）`;
    throw new Error(msg);
  }

  if (!data || typeof data !== "object" || !Array.isArray(data.names)) {
    throw new Error("名簿画像の解析結果が不正です");
  }

  return data.names
    .map((n) => (typeof n === "string" ? n.trim() : ""))
    .filter(Boolean)
    .slice(0, 80);
}

export type ParsedRosterHints = {
  entries: RosterHintEntry[];
  sourceLabel: string;
  notice?: string;
};

/** 名簿ファイルまたは名簿写真からヒント用の名前リストを取得 */
export async function parseRosterHintsFromFile(
  file: File
): Promise<ParsedRosterHints> {
  try {
    if (isParseableImageFile(file)) {
      const names = await parseRosterNamesFromImage(file);
      const entries = entriesFromFullNames(names);
      if (!entries.length) {
        throw new Error("名簿写真から名前を検出できませんでした");
      }
      return {
        entries,
        sourceLabel: file.name,
        notice:
          "名簿写真から読み取った名前を、立ち位置画像の解析ヒントとして使います。",
      };
    }

    const result = await parseRosterFile(file);
    const entries = entriesFromRosterRows(result.rows);
    if (!entries.length) {
      throw new Error("名簿ファイルから名前を検出できませんでした");
    }
    return {
      entries,
      sourceLabel: file.name,
      notice: result.notice,
    };
  } catch (e) {
    const raw = e instanceof Error ? e.message : "名簿の読み込みに失敗しました";
    throw new Error(formatParsePositionError(raw));
  }
}
