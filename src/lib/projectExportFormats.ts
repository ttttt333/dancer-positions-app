import type { AudienceEdge, ChoreographyProjectJson } from "../types/choreography";
import { modDancerColorIndex } from "./dancerColorPalette";
import { sortCuesByStart } from "./cueInterval";
import { formatMmSs, parseMmSsFlexible } from "./timeFormat";
import { formatMeterCmLabel, formatStageMmSummary } from "./stageDimensions";

export type ProjectExportFormatId =
  | "json"
  | "png"
  | "pdf_print"
  | "csv_excel"
  | "html_gdocs";

export const PROJECT_EXPORT_FORMAT_OPTIONS: {
  id: ProjectExportFormatId;
  label: string;
  hint?: string;
}[] = [
  { id: "json", label: "JSON（作品データ・再読込可）" },
  { id: "png", label: "PNG（ステージ画像）", hint: "ステージ枠を画像で保存" },
  {
    id: "pdf_print",
    label: "PDF（印刷で保存）",
    hint: "一覧を別ウィンドウで開き、印刷から「PDFに保存」",
  },
  {
    id: "csv_excel",
    label: "Excel（CSV・UTF-8）",
    hint: "表計算で開く。日本語は BOM 付き。キュー id・ダンサー座標列あり（§12）。右パネルで CSV 取り込み（§13）",
  },
  {
    id: "html_gdocs",
    label: "Googleドキュメント用（HTML）",
    hint: "ドライブにアップロード後「Googleドキュメントで開く」等",
  },
];

const AUD_JA: Record<AudienceEdge, string> = {
  top: "上",
  bottom: "下",
};

/** CSV「作品」ブロックの客席ラベル → audienceEdge（旧「左」「右」は下に読み替え） */
function audienceEdgeFromCsvLabel(v: string): AudienceEdge | undefined {
  const t = v.trim();
  if (t === "上") return "top";
  if (t === "下") return "bottom";
  if (t === "左" || t === "右") return "bottom";
  return undefined;
}

function safeBaseName(title: string): string {
  const t = title.replace(/[/\\?%*:|"<>]/g, "_").trim().slice(0, 80);
  return t || "choreography";
}

function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadProjectJson(project: ChoreographyProjectJson) {
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, `${safeBaseName(project.pieceTitle)}.json`);
}

function csvCell(s: string): string {
  const t = String(s ?? "");
  if (/[",\r\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function csvLine(cells: string[]): string {
  return cells.map(csvCell).join(",") + "\r\n";
}

export function downloadProjectCsvForExcel(project: ChoreographyProjectJson) {
  const lines: string[] = [];
  lines.push(csvLine(["セクション", "キー", "値"]));
  lines.push(csvLine(["作品", "作品名", project.pieceTitle || ""]));
  lines.push(
    csvLine([
      "作品",
      "想定人数",
      project.pieceDancerCount != null ? String(project.pieceDancerCount) : "",
    ])
  );
  lines.push(csvLine(["作品", "客席の位置", AUD_JA[project.audienceEdge] ?? project.audienceEdge]));
  const stage = formatStageMmSummary(project.stageWidthMm, project.stageDepthMm);
  lines.push(csvLine(["作品", "メイン寸法", stage || "未設定"]));
  lines.push(
    csvLine([
      "作品",
      "サイド（片側）",
      project.sideStageMm != null ? formatMeterCmLabel(project.sideStageMm) : "",
    ])
  );
  lines.push(
    csvLine([
      "作品",
      "バックステージ",
      project.backStageMm != null ? formatMeterCmLabel(project.backStageMm) : "",
    ])
  );
  lines.push(
    csvLine([
      "作品",
      "場ミリ間隔",
      project.centerFieldGuideIntervalMm != null
        ? `${project.centerFieldGuideIntervalMm} mm`
        : "",
    ])
  );
  lines.push(csvLine([]));
  lines.push(csvLine(["フォーメーション", "名前", "人数", "確定人数", "メモ"]));
  for (const f of project.formations) {
    lines.push(
      csvLine([
        "フォーメーション",
        f.name,
        String(f.dancers.length),
        f.confirmedDancerCount != null ? String(f.confirmedDancerCount) : "",
        (f.note ?? "").replace(/\r\n/g, "\n").replace(/\n/g, " "),
      ])
    );
  }
  lines.push(csvLine([]));
  lines.push(
    csvLine([
      "キュー",
      "id",
      "キュー名",
      "開始",
      "終了",
      "フォーメーション",
      "キューメモ",
    ])
  );
  const sorted = sortCuesByStart(project.cues);
  for (const c of sorted) {
    const fname =
      project.formations.find((x) => x.id === c.formationId)?.name ?? c.formationId;
    lines.push(
      csvLine([
        "キュー",
        c.id,
        (c.name ?? "").replace(/\r\n/g, "\n").replace(/\n/g, " "),
        formatMmSs(c.tStartSec),
        formatMmSs(c.tEndSec),
        fname,
        (c.note ?? "").replace(/\r\n/g, "\n").replace(/\n/g, " "),
      ])
    );
  }
  lines.push(csvLine([]));
  lines.push(
    csvLine([
      "ダンサー",
      "フォーメーション",
      "並び順",
      "id",
      "label",
      "xPct",
      "yPct",
      "colorIndex",
      "note",
      "crewMemberId",
    ])
  );
  for (const f of project.formations) {
    f.dancers.forEach((d, idx) => {
      lines.push(
        csvLine([
          "ダンサー",
          f.name,
          String(idx),
          d.id,
          d.label,
          String(d.xPct),
          String(d.yPct),
          String(d.colorIndex ?? 0),
          (d.note ?? "").replace(/\r\n/g, "\n").replace(/\n/g, " "),
          d.crewMemberId ?? "",
        ])
      );
    });
  }
  const body = lines.join("");
  const bom = "\ufeff";
  const blob = new Blob([bom + body], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, `${safeBaseName(project.pieceTitle)}_台本.csv`);
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildReportBodyHtml(project: ChoreographyProjectJson, forPrint: boolean): string {
  const stage = formatStageMmSummary(project.stageWidthMm, project.stageDepthMm);
  const sorted = sortCuesByStart(project.cues);
  const cueRows = sorted
    .map((c) => {
      const fname =
        project.formations.find((x) => x.id === c.formationId)?.name ?? "?";
      return `<tr><td>${esc(c.name ?? "")}</td><td>${esc(
        formatMmSs(c.tStartSec)
      )}</td><td>${esc(formatMmSs(c.tEndSec))}</td><td>${esc(fname)}</td><td>${esc(
        c.note ?? ""
      )}</td></tr>`;
    })
    .join("");
  const formRows = project.formations
    .map(
      (f) =>
        `<tr><td>${esc(f.name)}</td><td>${f.dancers.length}</td><td>${
          f.confirmedDancerCount ?? "—"
        }</td><td>${esc(f.note ?? "")}</td></tr>`
    )
    .join("");
  const title = esc(project.pieceTitle || "（無題）");
  const meta = `
    <p><strong>想定人数</strong>：${
      project.pieceDancerCount != null ? esc(String(project.pieceDancerCount)) : "—"
    }</p>
    <p><strong>客席の位置</strong>：${esc(AUD_JA[project.audienceEdge] ?? project.audienceEdge)}</p>
    <p><strong>メイン寸法</strong>：${esc(stage || "未設定")}</p>
    <p><strong>サイド（片側）</strong>：${
      project.sideStageMm != null ? esc(formatMeterCmLabel(project.sideStageMm)) : "—"
    }</p>
    <p><strong>バックステージ</strong>：${
      project.backStageMm != null ? esc(formatMeterCmLabel(project.backStageMm)) : "—"
    }</p>
    <p><strong>場ミリ間隔</strong>：${
      project.centerFieldGuideIntervalMm != null
        ? esc(`${project.centerFieldGuideIntervalMm} mm`)
        : "—"
    }</p>
  `;
  const printNote = forPrint
    ? `<p class="note">この画面で <strong>印刷（Ctrl+P / ⌘P）</strong> から「PDF に保存」を選ぶと PDF として保存できます。</p>`
    : "";
  return `
    <h1>${title}</h1>
    ${printNote}
    <h2>作品・舞台</h2>
    ${meta}
    <h2>フォーメーション</h2>
    <table>
      <thead><tr><th>名前</th><th>人数</th><th>確定人数</th><th>メモ</th></tr></thead>
      <tbody>${formRows}</tbody>
    </table>
    <h2>キュー一覧</h2>
    <table>
      <thead><tr><th>キュー名</th><th>開始</th><th>終了</th><th>フォーメーション</th><th>メモ</th></tr></thead>
      <tbody>${cueRows}</tbody>
    </table>
  `;
}

export function downloadProjectHtmlForGoogleDocs(project: ChoreographyProjectJson) {
  const inner = buildReportBodyHtml(project, false);
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>${esc(project.pieceTitle || "台本")}</title>
<style>
  body { font-family: system-ui, sans-serif; color: #111; max-width: 900px; margin: 24px auto; padding: 0 16px; }
  h1 { font-size: 1.5rem; }
  h2 { font-size: 1.1rem; margin-top: 1.5rem; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 0.9rem; }
  th, td { border: 1px solid #bbb; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; }
</style>
</head>
<body>
${inner}
<p style="margin-top:2rem;font-size:0.85rem;color:#555;">Google ドライブにアップロードし、右クリックから「アプリで開く」→「Googleドキュメント」などで取り込めます（表示は環境により異なります）。</p>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  triggerDownload(blob, `${safeBaseName(project.pieceTitle)}_台本.html`);
}

export function openPrintablePdfReport(project: ChoreographyProjectJson) {
  const inner = buildReportBodyHtml(project, true);
  const w = window.open("", "_blank");
  if (!w) {
    alert("ポップアップがブロックされているため、印刷用ウィンドウを開けませんでした。");
    return;
  }
  const docHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>${esc(project.pieceTitle || "台本")}</title>
<style>
  @media print {
    body { margin: 0; padding: 12mm; }
    .note { border: none !important; }
  }
  body { font-family: system-ui, "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
    color: #111; max-width: 900px; margin: 24px auto; padding: 0 16px; }
  h1 { font-size: 1.5rem; }
  h2 { font-size: 1.1rem; margin-top: 1.5rem; border-bottom: 1px solid #333; padding-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 0.85rem; }
  th, td { border: 1px solid #444; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #eee; }
  .note { margin: 16px 0; padding: 12px; background: #f8f8f8; border: 1px solid #ccc; font-size: 0.9rem; }
</style>
</head>
<body>
${inner}
</body>
</html>`;
  w.document.write(docHtml);
  w.document.close();
  w.focus();
  const runPrint = () => {
    try {
      w.print();
    } catch {
      /* ignore */
    }
  };
  if (w.document.readyState === "complete") {
    setTimeout(runPrint, 300);
  } else {
    w.onload = () => setTimeout(runPrint, 300);
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** RFC 4180 風の 1 行パース（ダブルクォート・エスケープ） */
export function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

export function parseCsvToRows(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return t
    .split("\n")
    .map((l) => parseCsvRow(l))
    .filter((row) => row.some((c) => String(c).trim() !== ""));
}

type LegacyCueRow = {
  name: string;
  tStart: number;
  tEnd: number;
  formName: string;
  note: string;
};

/**
 * §12 / §13: ChoreoGrid が書き出した CSV（UTF-8・BOM 可）を現在の作品へマージする。
 * フォーメーションは名前一致、キューは id 列があれば id、なければ並び順で上書き。
 */
export function importProjectFromChoreogridCsv(
  csvText: string,
  mergeInto: ChoreographyProjectJson
): ChoreographyProjectJson {
  const rows = parseCsvToRows(csvText);
  const next: ChoreographyProjectJson = {
    ...mergeInto,
    formations: mergeInto.formations.map((f) => ({
      ...f,
      dancers: f.dancers.map((d) => ({ ...d })),
    })),
    cues: mergeInto.cues.map((c) => ({ ...c })),
  };

  const legacyCueRows: LegacyCueRow[] = [];

  for (const row of rows) {
    if (row.length < 2) continue;
    const sec = row[0]?.trim();
    if (sec === "作品" && row.length >= 3) {
      const k = row[1]?.trim();
      const v = row[2] ?? "";
      if (k === "作品名") next.pieceTitle = v;
      if (k === "想定人数") {
        const n = parseInt(v, 10);
        next.pieceDancerCount = Number.isFinite(n) ? n : null;
      }
      if (k === "客席の位置") {
        const ae = audienceEdgeFromCsvLabel(v);
        if (ae !== undefined) next.audienceEdge = ae;
      }
    }
    if (sec === "フォーメーション" && row.length >= 5) {
      const name = row[1]?.trim();
      const fm = next.formations.find((f) => f.name === name);
      if (!fm) continue;
      const cconf = parseInt(row[3] ?? "", 10);
      const note = (row[4] ?? "").trim();
      fm.note = note || undefined;
      if (Number.isFinite(cconf)) fm.confirmedDancerCount = cconf;
    }
    if (sec === "キュー") {
      const idCell = (row[1] ?? "").trim();
      if (row.length >= 7 && UUID_RE.test(idCell)) {
        const cname = row[2] ?? "";
        const tStart = parseMmSsFlexible(row[3] ?? "");
        const tEnd = parseMmSsFlexible(row[4] ?? "");
        const formName = row[5]?.trim() ?? "";
        const note = (row[6] ?? "").trim();
        if (tStart == null || tEnd == null || tEnd <= tStart) continue;
        const cue = next.cues.find((c) => c.id === idCell);
        const fid = next.formations.find((f) => f.name === formName)?.id;
        if (cue && fid) {
          cue.name = cname || undefined;
          cue.tStartSec = tStart;
          cue.tEndSec = tEnd;
          cue.formationId = fid;
          cue.note = note || undefined;
        }
      } else if (row.length >= 6) {
        const cname = row[1] ?? "";
        const tStart = parseMmSsFlexible(row[2] ?? "");
        const tEnd = parseMmSsFlexible(row[3] ?? "");
        const formName = row[4]?.trim() ?? "";
        const note = (row[5] ?? "").trim();
        if (tStart != null && tEnd != null && tEnd > tStart) {
          legacyCueRows.push({ name: cname, tStart, tEnd, formName, note });
        }
      }
    }
    if (sec === "ダンサー" && row.length >= 9) {
      const formName = row[1]?.trim();
      const fm = next.formations.find((f) => f.name === formName);
      if (!fm) continue;
      const did = (row[3] ?? "").trim();
      const label = row[4] ?? "";
      const xPct = parseFloat(row[5] ?? "");
      const yPct = parseFloat(row[6] ?? "");
      const colorIndex = parseInt(row[7] ?? "0", 10) || 0;
      const note = (row[8] ?? "").trim();
      const crewMemberId = (row[9] ?? "").trim();
      if (!Number.isFinite(xPct) || !Number.isFinite(yPct)) continue;
      const d = fm.dancers.find((x) => x.id === did);
      if (d) {
        d.label = label.slice(0, 8) || d.label;
        d.xPct = Math.min(98, Math.max(2, xPct));
        d.yPct = Math.min(98, Math.max(2, yPct));
        d.colorIndex = modDancerColorIndex(colorIndex);
        d.note = note || undefined;
        d.crewMemberId = crewMemberId || undefined;
      }
    }
  }

  const sortedIds = sortCuesByStart(next.cues).map((c) => c.id);
  if (legacyCueRows.length > 0 && legacyCueRows.length === sortedIds.length) {
    legacyCueRows.forEach((u, idx) => {
      const id = sortedIds[idx];
      const cue = next.cues.find((c) => c.id === id);
      const fid = next.formations.find((f) => f.name === u.formName)?.id;
      if (!cue || !fid) return;
      cue.name = u.name || undefined;
      cue.tStartSec = u.tStart;
      cue.tEndSec = u.tEnd;
      cue.formationId = fid;
      cue.note = u.note || undefined;
    });
  }

  next.cues = sortCuesByStart(next.cues);
  return next;
}
