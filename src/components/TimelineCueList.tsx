import { createPortal } from "react-dom";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import type { ChoreographyProjectJson, Cue } from "../types/choreography";
import { formatMmSs, formatMmSsFloor, parseMmSsFlexible } from "../lib/timeFormat";
import { btnSecondary } from "./stageButtonStyles";

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
        padding: isRow ? "2px 3px" : "6px 8px",
        borderRadius: "6px",
        border: `1px solid ${isRow ? "#db2777" : "#334155"}`,
        background: "#020617",
        color: isRow ? "#fce7f3" : "#e2e8f0",
        width: isRow ? "auto" : "100%",
        minWidth: isRow ? "31px" : "72px",
        maxWidth: isRow ? "42px" : "96px",
        fontSize: isRow ? "11px" : "13px",
        fontWeight: isRow ? 600 : undefined,
        fontVariantNumeric: "tabular-nums",
        fontFeatureSettings: '"tnum"',
        flexShrink: 0,
      }}
    />
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
    <>
      <div
        style={{
          flex: "1 1 0%",
          minHeight: 0,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ul style={{ listStyle: "none", margin: 0, padding: 0, flex: "1 1 auto", minHeight: 0 }}>
          {cuesSorted.map((c, sortedIdx) => {
            const cueNum = sortedIdx + 1;
            const fname = formations.find((f) => f.id === c.formationId)?.name ?? "?";
            const cueFormation = formations.find((f) => f.id === c.formationId);
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
                  gap: "6px",
                  padding: "6px 0",
                  borderBottom: "1px solid #1e293b",
                  borderLeft: selectedCueIds.includes(c.id)
                    ? "3px solid #ef4444"
                    : "3px solid transparent",
                  paddingLeft: "8px",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    overflowX: "auto",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "auto minmax(27px, auto) minmax(27px, auto) auto auto",
                      gap: "8px",
                      alignItems: "end",
                      width: "100%",
                      minWidth: "min(100%, 560px)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                        alignItems: "flex-end",
                        justifyContent: "flex-end",
                      }}
                    >
                      <span
                        aria-label={`キュー ${cueNum}`}
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 700,
                          fontSize: "13px",
                          color: "#94a3b8",
                          minWidth: "1.5em",
                          textAlign: "right",
                          lineHeight: 1.25,
                        }}
                      >
                        {cueNum}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <CueTimeInput
                        variant="cueRow"
                        ariaLabel={`キュー${cueNum} 開始時刻`}
                        timeSec={c.tStartSec}
                        disabled={viewMode === "view"}
                        onCommit={(v) => {
                          let tEnd = c.tEndSec;
                          const tStart = v;
                          if (tStart >= tEnd) {
                            tEnd = Math.round((tStart + 0.01) * 100) / 100;
                          }
                          updateCue(c.id, { tStartSec: tStart, tEndSec: tEnd });
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <CueTimeInput
                        variant="cueRow"
                        ariaLabel={`キュー${cueNum} 終了時刻`}
                        timeSec={c.tEndSec}
                        disabled={viewMode === "view"}
                        onCommit={(v) => {
                          let tStart = c.tStartSec;
                          const tEnd = v;
                          if (tEnd <= tStart) {
                            tStart = Math.round((tEnd - 0.01) * 100) / 100;
                          }
                          updateCue(c.id, { tStartSec: tStart, tEndSec: tEnd });
                        }}
                      />
                    </div>
                    {cueFormation ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                          flexShrink: 0,
                          justifySelf: "start",
                          justifyContent: "flex-end",
                        }}
                      >
                        <div
                          title="人数を増減"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          <button
                            type="button"
                            aria-label="人数を減らす"
                            disabled={viewMode === "view" || cueFormation.dancers.length <= 1}
                            onClick={() => adjustFormationDancerCount(c.formationId, -1)}
                            style={{
                              ...btnSecondary,
                              padding: "4px 8px",
                              minWidth: "28px",
                              fontSize: "14px",
                              lineHeight: 1,
                            }}
                          >
                            −
                          </button>
                          <span
                            style={{
                              minWidth: "22px",
                              textAlign: "center",
                              fontVariantNumeric: "tabular-nums",
                              fontWeight: 700,
                              color: "#e2e8f0",
                              fontSize: "12px",
                            }}
                          >
                            {cueFormation.dancers.length}
                          </span>
                          <button
                            type="button"
                            aria-label="人数を増やす"
                            disabled={viewMode === "view" || cueFormation.dancers.length >= 80}
                            onClick={() => adjustFormationDancerCount(c.formationId, 1)}
                            style={{
                              ...btnSecondary,
                              padding: "4px 8px",
                              minWidth: "28px",
                              fontSize: "14px",
                              lineHeight: 1,
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "#64748b", fontSize: "11px" }}>—</span>
                    )}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                        justifySelf: "end",
                        justifyContent: "flex-end",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          flexWrap: "nowrap",
                          justifyContent: "flex-end",
                          alignItems: "center",
                        }}
                      >
                        <button
                          type="button"
                          disabled={viewMode === "view"}
                          title="同じ長さで複製"
                          style={{ ...btnSecondary, padding: "6px 8px", fontSize: "11px" }}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            duplicateCueSameSettings(c);
                          }}
                        >
                          複製
                        </button>
                        <button
                          type="button"
                          disabled={viewMode === "view"}
                          style={{ ...btnSecondary, padding: "6px 8px", fontSize: "11px" }}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            removeCue(c.id);
                          }}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );

  if (!compactTopDock) return cueListContent;
  if (!cueListPortalTarget) return null;
  return createPortal(cueListContent, cueListPortalTarget);
}
