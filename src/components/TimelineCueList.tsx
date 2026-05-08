import { createPortal } from "react-dom";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import type { ChoreographyProjectJson, Cue } from "../types/choreography";
import { formatMmSs, formatMmSsFloor, parseMmSsFlexible } from "../lib/timeFormat";
import { shell } from "../theme/choreoShell";

// ── テーマ定数 ──────────────────────────────────────────────
const C = {
  bg: shell.surface,            // "#10100e"
  bgRow: shell.bgChrome,        // "#0a0908"
  bgRowSel: "rgba(196,30,58,0.08)",
  border: shell.border,         // gold 8%
  borderRow: "rgba(212,175,55,0.06)",
  accent: shell.accent,         // "#d4af37"
  ruby: shell.ruby,             // "#c41e3a"
  rubySoft: "rgba(196,30,58,0.18)",
  text: shell.text,             // "#faf7f0"
  muted: shell.textMuted,       // "#a8a29e"
  subtle: shell.textSubtle,     // "#78716c"
  inputBg: "#060606",
  inputBorder: "rgba(196,30,58,0.5)",
  inputBorderFocus: shell.ruby,
  inputText: "#fce7f3",
  btnBg: "rgba(255,255,255,0.04)",
  btnBorder: "rgba(212,175,55,0.14)",
  btnHover: "rgba(212,175,55,0.1)",
  btnDanger: "rgba(196,30,58,0.14)",
  btnDangerBorder: "rgba(196,30,58,0.35)",
};

function CueTimeInput({
  timeSec,
  disabled,
  onCommit,
  variant = "default",
  ariaLabel,
}: {
  timeSec: number;
  disabled: boolean;
  onCommit: (v: number) => void;
  variant?: "default" | "cueRow";
  ariaLabel?: string;
}) {
  const isRow = variant === "cueRow";
  const [text, setText] = useState(() =>
    isRow ? formatMmSsFloor(timeSec) : formatMmSs(timeSec)
  );
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) {
      setText(isRow ? formatMmSsFloor(timeSec) : formatMmSs(timeSec));
    }
  }, [timeSec, focus, isRow]);
  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={text}
      onFocus={() => {
        setFocus(true);
        setText(isRow ? formatMmSsFloor(timeSec) : formatMmSs(timeSec));
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocus(false);
        const v = parseMmSsFlexible(text);
        if (v != null && Number.isFinite(v) && v >= 0) onCommit(v);
        else setText(isRow ? formatMmSsFloor(timeSec) : formatMmSs(timeSec));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      aria-label={ariaLabel ?? "時刻"}
      placeholder={isRow ? "" : "分:秒"}
      style={{
        padding: isRow ? "3px 5px" : "6px 8px",
        borderRadius: "5px",
        border: `1px solid ${isRow ? C.inputBorder : C.border}`,
        background: C.inputBg,
        color: isRow ? C.inputText : C.text,
        width: isRow ? "auto" : "100%",
        minWidth: isRow ? "36px" : "72px",
        maxWidth: isRow ? "46px" : "96px",
        fontSize: isRow ? "11px" : "13px",
        fontWeight: isRow ? 700 : undefined,
        fontVariantNumeric: "tabular-nums",
        fontFeatureSettings: '"tnum"',
        flexShrink: 0,
        outline: "none",
        transition: "border-color 0.15s",
      }}
    />
  );
}

// 小さいアイコンボタン
function IconBtn({
  onClick,
  disabled,
  danger,
  title,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 8px",
        borderRadius: 5,
        border: `1px solid ${danger ? C.btnDangerBorder : C.btnBorder}`,
        background: danger ? C.btnDanger : C.btnBg,
        color: danger ? "#fca5a5" : C.muted,
        fontSize: "11px",
        fontWeight: 600,
        lineHeight: 1,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export type TimelineCueListProps = {
  cuesSorted: Cue[];
  formations: ChoreographyProjectJson["formations"];
  viewMode: ChoreographyProjectJson["viewMode"];
  selectedCueIds: string[];
  onSelectedCueIdsChange: Dispatch<SetStateAction<string[]>>;
  updateCue: (id: string, patch: Partial<Cue>) => void;
  adjustFormationDancerCount: (formationId: string, delta: number) => void;
  duplicateCueSameSettings: (source: Cue) => void;
  removeCue: (id: string) => void;
  compactTopDock: boolean;
  cueListPortalTarget: HTMLElement | null;
};

/**
 * タイムライン下部のキュー一覧。`compactTopDock` 時はポータル先へ描画。
 */
export function TimelineCueList({
  cuesSorted,
  formations,
  viewMode,
  selectedCueIds,
  onSelectedCueIdsChange,
  updateCue,
  adjustFormationDancerCount,
  duplicateCueSameSettings,
  removeCue,
  compactTopDock,
  cueListPortalTarget,
}: TimelineCueListProps) {
  const cueListContent = (
    <div
      style={{
        flex: "1 1 0%",
        minHeight: 0,
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        background: C.bg,
      }}
    >
      {cuesSorted.length === 0 ? (
        <div style={{
          padding: "32px 16px",
          textAlign: "center",
          color: C.subtle,
          fontSize: "12px",
        }}>
          キューがありません
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: "4px 0", flex: "1 1 auto", minHeight: 0 }}>
          {cuesSorted.map((c, sortedIdx) => {
            const cueNum = sortedIdx + 1;
            const fname = formations.find((f) => f.id === c.formationId)?.name ?? "?";
            const cueFormation = formations.find((f) => f.id === c.formationId);
            const isSelected = selectedCueIds.includes(c.id);
            const listTitle = (c.name?.trim() ? `${c.name.trim()} · ` : "") + `形: ${fname}`;
            return (
              <li
                key={c.id}
                title={listTitle}
                role="button"
                tabIndex={0}
                onClick={(ev) => {
                  const t = ev.target as HTMLElement;
                  if (t.closest("input, select, textarea, button")) return;
                  if (ev.metaKey || ev.ctrlKey) {
                    onSelectedCueIdsChange((prev) =>
                      prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                    );
                  } else {
                    onSelectedCueIdsChange([c.id]);
                  }
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    if (ev.metaKey || ev.ctrlKey) {
                      onSelectedCueIdsChange((prev) =>
                        prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                      );
                    } else {
                      onSelectedCueIdsChange([c.id]);
                    }
                  }
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                  margin: "3px 8px",
                  borderRadius: 8,
                  border: `1px solid ${isSelected ? "rgba(196,30,58,0.45)" : C.borderRow}`,
                  background: isSelected ? C.bgRowSel : C.bgRow,
                  boxShadow: isSelected ? "0 0 12px rgba(196,30,58,0.1)" : "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  overflow: "hidden",
                }}
              >
                {/* 行: 番号 + 時刻 + 形成名 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 10px",
                  }}
                >
                  {/* キュー番号 */}
                  <span
                    aria-label={`キュー ${cueNum}`}
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 700,
                      fontSize: "11px",
                      color: isSelected ? C.ruby : C.subtle,
                      minWidth: "16px",
                      textAlign: "right",
                      flexShrink: 0,
                      transition: "color 0.15s",
                    }}
                  >
                    {cueNum}
                  </span>

                  {/* 縦区切り */}
                  <div style={{ width: 1, height: 20, background: C.border, flexShrink: 0 }} />

                  {/* 開始 → 終了 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <CueTimeInput
                      variant="cueRow"
                      ariaLabel={`キュー${cueNum} 開始時刻`}
                      timeSec={c.tStartSec}
                      disabled={viewMode === "view"}
                      onCommit={(v) => {
                        let tEnd = c.tEndSec;
                        const tStart = v;
                        if (tStart >= tEnd) tEnd = Math.round((tStart + 0.01) * 100) / 100;
                        updateCue(c.id, { tStartSec: tStart, tEndSec: tEnd });
                      }}
                    />
                    <span style={{ color: C.subtle, fontSize: "9px", flexShrink: 0 }}>→</span>
                    <CueTimeInput
                      variant="cueRow"
                      ariaLabel={`キュー${cueNum} 終了時刻`}
                      timeSec={c.tEndSec}
                      disabled={viewMode === "view"}
                      onCommit={(v) => {
                        let tStart = c.tStartSec;
                        const tEnd = v;
                        if (tEnd <= tStart) tStart = Math.round((tEnd - 0.01) * 100) / 100;
                        updateCue(c.id, { tStartSec: tStart, tEndSec: tEnd });
                      }}
                    />
                  </div>

                  {/* 縦区切り */}
                  <div style={{ width: 1, height: 20, background: C.border, flexShrink: 0 }} />

                  {/* 形成名 */}
                  <span
                    style={{
                      fontSize: "11px",
                      color: C.accent,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {fname}
                  </span>
                </div>

                {/* 行2: 人数 + アクション */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 10px 6px",
                    borderTop: `1px solid ${C.borderRow}`,
                    gap: 6,
                  }}
                >
                  {/* 人数コントロール */}
                  {cueFormation ? (
                    <div
                      title="人数を増減"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <button
                        type="button"
                        aria-label="人数を減らす"
                        disabled={viewMode === "view" || cueFormation.dancers.length <= 1}
                        onClick={(e) => { e.stopPropagation(); adjustFormationDancerCount(c.formationId, -1); }}
                        style={{
                          width: 22, height: 22,
                          borderRadius: 4,
                          border: `1px solid ${C.btnBorder}`,
                          background: C.btnBg,
                          color: C.muted,
                          fontSize: "14px", lineHeight: 1,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: (viewMode === "view" || cueFormation.dancers.length <= 1) ? "not-allowed" : "pointer",
                          opacity: (viewMode === "view" || cueFormation.dancers.length <= 1) ? 0.35 : 1,
                        }}
                      >−</button>
                      <span
                        style={{
                          minWidth: "20px",
                          textAlign: "center",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 700,
                          color: C.text,
                          fontSize: "12px",
                        }}
                      >
                        {cueFormation.dancers.length}
                        <span style={{ fontSize: "9px", color: C.subtle, marginLeft: 1 }}>人</span>
                      </span>
                      <button
                        type="button"
                        aria-label="人数を増やす"
                        disabled={viewMode === "view" || cueFormation.dancers.length >= 80}
                        onClick={(e) => { e.stopPropagation(); adjustFormationDancerCount(c.formationId, 1); }}
                        style={{
                          width: 22, height: 22,
                          borderRadius: 4,
                          border: `1px solid ${C.btnBorder}`,
                          background: C.btnBg,
                          color: C.muted,
                          fontSize: "14px", lineHeight: 1,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: (viewMode === "view" || cueFormation.dancers.length >= 80) ? "not-allowed" : "pointer",
                          opacity: (viewMode === "view" || cueFormation.dancers.length >= 80) ? 0.35 : 1,
                        }}
                      >+</button>
                    </div>
                  ) : (
                    <span style={{ color: C.subtle, fontSize: "11px" }}>—</span>
                  )}

                  {/* 複製・削除 */}
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    <IconBtn
                      disabled={viewMode === "view"}
                      title="同じ長さで複製"
                      onClick={(e) => { e.stopPropagation(); duplicateCueSameSettings(c); }}
                    >
                      複製
                    </IconBtn>
                    <IconBtn
                      disabled={viewMode === "view"}
                      danger
                      title="削除"
                      onClick={(e) => { e.stopPropagation(); removeCue(c.id); }}
                    >
                      削除
                    </IconBtn>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  if (!compactTopDock) return cueListContent;
  if (!cueListPortalTarget) return null;
  return createPortal(cueListContent, cueListPortalTarget);
}
