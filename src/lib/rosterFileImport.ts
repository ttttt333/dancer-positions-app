/**
 * 名簿ファイルの汎用取り込みヘルパー。
 *
 * 対応形式:
 *   - CSV / TSV / TXT  … テキストとして読み、`parseCsvToRows` で行配列に
 *   - XLSX / XLS / XLSM / ODS … `xlsx`(SheetJS) を動的 import して 1 枚目のシートを行配列に
 *   - HTML / HTM       … `DOMParser` で <table> または <li> を行配列に
 *   - PDF              … `pdfjs-dist` を動的 import してページごとに行を再構築
 *
 * すべて `string[][]`（行 × 列）で返すので、上位は `dedupeRowsToMembers` /
 * `buildCrewFromRows` にそのまま渡せばメンバー一覧を作れる。
 *
 * 巨大ライブラリ（xlsx ≒ 350KB / pdfjs ≒ 1MB+）は動的 import なので、
 * ユーザーが該当形式を選んだときだけバンドルが追加で読み込まれる。
 */

import { parseCsvToRows } from "./projectExportFormats";

export type RosterFileKind =
  | "csv"
  | "tsv"
  | "txt"
  | "xlsx"
  | "xls"
  | "xlsm"
  | "ods"
  | "html"
  | "htm"
  | "pdf";

export const ROSTER_FILE_ACCEPT =
  ".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ods,.html,.htm,.pdf," +
  "text/csv,text/tab-separated-values,text/plain,text/html," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet," +
  "application/vnd.ms-excel," +
  "application/vnd.oasis.opendocument.spreadsheet," +
  "application/pdf";

export interface RosterParseResult {
  /** 取り込んだ行配列（最初の行が見出しなら自動判定される） */
  rows: string[][];
  /** ファイル名から拡張子を除いた名前（名簿の既定名候補） */
  baseName: string;
  /** 判定したファイル種別 */
  kind: RosterFileKind;
  /** PDF など、構造を完全に保てない形式での補足メッセージ */
  notice?: string;
}

function detectKind(file: File): RosterFileKind | null {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (
    ext === "csv" ||
    ext === "tsv" ||
    ext === "txt" ||
    ext === "xlsx" ||
    ext === "xls" ||
    ext === "xlsm" ||
    ext === "ods" ||
    ext === "html" ||
    ext === "htm" ||
    ext === "pdf"
  ) {
    return ext;
  }
  // MIME からの推定（ドラッグ&ドロップなど）
  const mime = file.type.toLowerCase();
  if (mime === "text/csv") return "csv";
  if (mime === "text/tab-separated-values") return "tsv";
  if (mime === "text/plain") return "txt";
  if (mime === "text/html") return "html";
  if (mime === "application/pdf") return "pdf";
  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
    return "xlsx";
  if (mime === "application/vnd.ms-excel") return "xls";
  if (mime === "application/vnd.oasis.opendocument.spreadsheet") return "ods";
  return null;
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("ファイルを読めませんでした"));
    r.readAsText(file, "UTF-8");
  });
}

function smartSplitFallback(text: string): string[][] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");
  return lines.map((l) => {
    if (l.includes("\t")) return l.split("\t").map((c) => c.trim());
    if (l.includes(";")) return l.split(";").map((c) => c.trim());
    if (l.includes(",")) return l.split(",").map((c) => c.trim());
    return [l.trim()];
  });
}

function parseCsvOrTsv(text: string): string[][] {
  let rows = parseCsvToRows(text);
  if (rows.length === 0 || (rows.length === 1 && rows[0].length === 1)) {
    rows = smartSplitFallback(text);
  }
  return rows;
}

async function parseSpreadsheet(file: File): Promise<string[][]> {
  // XLSX / XLS / XLSM / ODS すべて SheetJS が同じ API で読める
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const arr = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  return arr.map((row) =>
    (row as unknown[]).map((cell) =>
      cell == null ? "" : String(cell).trim()
    )
  );
}

async function parseHtml(file: File): Promise<string[][]> {
  const text = await readAsText(file);
  const doc = new DOMParser().parseFromString(text, "text/html");

  // 1) <table> があれば最初のテーブルを使う
  const table = doc.querySelector("table");
  if (table) {
    const trs = Array.from(table.querySelectorAll("tr"));
    const rows = trs
      .map((tr) =>
        Array.from(tr.querySelectorAll("th, td")).map((c) =>
          (c.textContent ?? "").replace(/\s+/g, " ").trim()
        )
      )
      .filter((r) => r.some((c) => c !== ""));
    if (rows.length > 0) return rows;
  }

  // 2) <ul>/<ol> があれば <li> を 1 列扱いで返す
  const lis = Array.from(doc.querySelectorAll("li"));
  if (lis.length > 0) {
    return lis
      .map((li) => [(li.textContent ?? "").replace(/\s+/g, " ").trim()])
      .filter((r) => r[0] !== "");
  }

  // 3) フォールバック: 本文をテキストにして CSV/TSV パスへ
  const plain = (doc.body?.innerText ?? doc.body?.textContent ?? "").trim();
  return parseCsvOrTsv(plain);
}

async function parsePdf(file: File): Promise<string[][]> {
  // pdfjs は worker を別ファイルで読む必要がある。
  // Vite では `?url` で worker のビルド済みパスを取得できる。
  const [pdfjsModule, workerUrlModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  const pdfjs = pdfjsModule as typeof import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (workerUrlModule as { default: string })
    .default;

  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;

  const allRows: string[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    type Item = { str: string; x: number; y: number };
    const items: Item[] = (content.items as unknown[])
      .map((raw) => {
        const it = raw as { str?: string; transform?: number[] };
        const tr = it.transform ?? [1, 0, 0, 1, 0, 0];
        return {
          str: (it.str ?? "").trim(),
          x: tr[4] ?? 0,
          y: Math.round(tr[5] ?? 0),
        };
      })
      .filter((it) => it.str !== "");

    // 同じ y 座標（小さなブレは round で吸収）を 1 行とみなす
    const linesByY = new Map<number, Item[]>();
    for (const it of items) {
      const arr = linesByY.get(it.y) ?? [];
      arr.push(it);
      linesByY.set(it.y, arr);
    }
    const ys = Array.from(linesByY.keys()).sort((a, b) => b - a); // 上から下
    for (const y of ys) {
      const cells = (linesByY.get(y) ?? [])
        .sort((a, b) => a.x - b.x)
        .map((it) => it.str);
      if (cells.length > 0) allRows.push(cells);
    }
  }
  return allRows;
}

const KIND_LABEL: Record<RosterFileKind, string> = {
  csv: "CSV",
  tsv: "TSV",
  txt: "テキスト",
  xlsx: "Excel (xlsx)",
  xls: "Excel (xls)",
  xlsm: "Excel (xlsm)",
  ods: "OpenDocument (ods)",
  html: "HTML",
  htm: "HTML",
  pdf: "PDF",
};

const EXT_RE = /\.(csv|tsv|txt|xlsx|xls|xlsm|ods|html|htm|pdf)$/i;

/** ファイル名から拡張子を除いた基底名（名簿の既定名候補） */
export function baseNameFromFile(file: File): string {
  return file.name.replace(EXT_RE, "").trim();
}

/** ラベル（ユーザー向け表示）を返す */
export function labelForKind(kind: RosterFileKind): string {
  return KIND_LABEL[kind];
}

/**
 * ファイルから名簿用の行データを取り出す。
 * - 形式は拡張子と MIME から判定。
 * - 失敗時は throw する（呼び出し側で `window.alert` などに表示）。
 */
export async function parseRosterFile(file: File): Promise<RosterParseResult> {
  const kind = detectKind(file);
  if (!kind) {
    throw new Error(
      "対応していないファイル形式です。CSV / TSV / TXT / XLSX / XLS / ODS / HTML / PDF を選んでください。"
    );
  }

  let rows: string[][] = [];
  let notice: string | undefined;

  switch (kind) {
    case "csv":
    case "tsv":
    case "txt": {
      const text = await readAsText(file);
      rows = parseCsvOrTsv(text);
      break;
    }
    case "xlsx":
    case "xls":
    case "xlsm":
    case "ods": {
      rows = await parseSpreadsheet(file);
      break;
    }
    case "html":
    case "htm": {
      rows = await parseHtml(file);
      break;
    }
    case "pdf": {
      rows = await parsePdf(file);
      notice =
        "PDF はレイアウト依存のため、列の順番や名前の区切りが崩れることがあります。" +
        "取り込み後にメンバー一覧をご確認ください。";
      break;
    }
  }

  return {
    rows,
    baseName: baseNameFromFile(file),
    kind,
    notice,
  };
}
