import type { Dispatch, SetStateAction } from "react";
import type { ChoreographyProjectJson, Cue } from "../types/choreography";
import { sortCuesByStart } from "../core/timelineController";
import { GAP_APPROACH_OPTIONS } from "../lib/gapDancerInterpolation";
import { btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";

export type WaveCueMenuState = {
  cueId: string;
  clientX: number;
  clientY: number;
} | null;

export type GapRouteMenuState = {
  nextCueId: string;
  clientX: number;
  clientY: number;
} | null;

export type WaveCueConfirmState =
  | null
  | { kind: "duplicate" | "formationBox"; cueId: string };

export type TimelineWaveMenusProps = {
  viewMode: ChoreographyProjectJson["viewMode"];
  currentTime: number;
  cuesSorted: Cue[];
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  waveCueMenu: WaveCueMenuState;
  setWaveCueMenu: Dispatch<SetStateAction<WaveCueMenuState>>;
  gapRouteMenu: GapRouteMenuState;
  setGapRouteMenu: Dispatch<SetStateAction<GapRouteMenuState>>;
  waveCueConfirm: WaveCueConfirmState;
  setWaveCueConfirm: Dispatch<SetStateAction<WaveCueConfirmState>>;
  splitCueAtPlayhead: (cueId: string) => void;
  removeCue: (id: string) => void;
  duplicateCueAfterSource: (cue: Cue) => void;
  duplicateCueAtTimelineEnd: (cue: Cue) => void;
  saveCueFormationToBoxList: (cueId: string) => void;
};

/**
 * 波形まわりのオーバーレイ UI：キュー右クリックメニュー・ギャップ経路・確認ダイアログ。
 */
export function TimelineWaveMenus({
  viewMode,
  currentTime,
  cuesSorted,
  setProject,
  waveCueMenu,
  setWaveCueMenu,
  gapRouteMenu,
  setGapRouteMenu,
  waveCueConfirm,
  setWaveCueConfirm,
  splitCueAtPlayhead,
  removeCue,
  duplicateCueAfterSource,
  duplicateCueAtTimelineEnd,
  saveCueFormationToBoxList,
}: TimelineWaveMenusProps) {
  const waveCueMenuTargetCue = waveCueMenu
    ? cuesSorted.find((c) => c.id === waveCueMenu.cueId)
    : undefined;
  const canSplitAtPlayhead =
    !!waveCueMenuTargetCue &&
    currentTime > waveCueMenuTargetCue.tStartSec + 0.02 &&
    currentTime < waveCueMenuTargetCue.tEndSec - 0.02;

  const waveCueMenuPanel =
    waveCueMenu && !waveCueConfirm ? (
      <>
        <button
          type="button"
          aria-label="メニューを閉じる"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2498,
            border: "none",
            background: "transparent",
            cursor: "default",
          }}
          onClick={() => setWaveCueMenu(null)}
        />
        <div
          role="menu"
          aria-label="キューの操作"
          style={{
            position: "fixed",
            left: Math.max(
              8,
              Math.min(
                waveCueMenu.clientX,
                (typeof window !== "undefined" ? window.innerWidth : 800) - 240
              )
            ),
            top: Math.max(
              8,
              Math.min(
                waveCueMenu.clientY,
                (typeof window !== "undefined" ? window.innerHeight : 600) - 150
              )
            ),
            zIndex: 2499,
            minWidth: "220px",
            maxWidth: "min(300px, calc(100vw - 16px))",
            padding: "8px",
            borderRadius: "10px",
            border: `1px solid ${shell.border}`,
            background: shell.surface,
            boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
          }}
        >
          <button
            type="button"
            role="menuitem"
            disabled={viewMode === "view" || !canSplitAtPlayhead}
            style={{
              ...btnSecondary,
              display: "block",
              width: "100%",
              textAlign: "left",
              marginBottom: "6px",
              fontSize: "12px",
              padding: "8px 10px",
              cursor:
                viewMode === "view" || !canSplitAtPlayhead ? "not-allowed" : "pointer",
              opacity: canSplitAtPlayhead ? 1 : 0.4,
            }}
            onClick={() => {
              if (viewMode === "view" || !canSplitAtPlayhead) return;
              splitCueAtPlayhead(waveCueMenu.cueId);
              setWaveCueMenu(null);
            }}
          >
            ✂️ ここで分割（赤いバーの位置）
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={viewMode === "view"}
            style={{
              ...btnSecondary,
              display: "block",
              width: "100%",
              textAlign: "left",
              marginBottom: "6px",
              fontSize: "12px",
              padding: "8px 10px",
              cursor: viewMode === "view" ? "not-allowed" : "pointer",
            }}
            onClick={() => {
              if (viewMode === "view") return;
              setWaveCueMenu(null);
              setWaveCueConfirm({ kind: "duplicate", cueId: waveCueMenu.cueId });
            }}
          >
            複製する
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={viewMode === "view"}
            style={{
              ...btnSecondary,
              display: "block",
              width: "100%",
              textAlign: "left",
              marginBottom: "6px",
              fontSize: "12px",
              padding: "8px 10px",
              cursor: viewMode === "view" ? "not-allowed" : "pointer",
            }}
            onClick={() => {
              if (viewMode === "view") return;
              setWaveCueMenu(null);
              setWaveCueConfirm({
                kind: "formationBox",
                cueId: waveCueMenu.cueId,
              });
            }}
          >
            立ち位置リストに追加
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={viewMode === "view"}
            style={{
              ...btnSecondary,
              display: "block",
              width: "100%",
              textAlign: "left",
              fontSize: "12px",
              padding: "8px 10px",
              borderColor: "rgba(248, 113, 113, 0.55)",
              color: "#fecaca",
              cursor: viewMode === "view" ? "not-allowed" : "pointer",
            }}
            onClick={() => {
              if (viewMode === "view") return;
              removeCue(waveCueMenu.cueId);
              setWaveCueMenu(null);
            }}
          >
            削除
          </button>
          <div style={{ borderTop: `1px solid ${shell.border}`, margin: "6px 0 4px" }} />
          <button
            type="button"
            role="menuitem"
            style={{
              ...btnSecondary,
              display: "block",
              width: "100%",
              textAlign: "center",
              fontSize: "12px",
              padding: "8px 10px",
              color: "#94a3b8",
            }}
            onClick={() => setWaveCueMenu(null)}
          >
            キャンセル
          </button>
        </div>
      </>
    ) : null;

  const gapRouteMenuPanel =
    gapRouteMenu && !waveCueConfirm ? (
      <>
        <button
          type="button"
          aria-label="経路メニューを閉じる"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2498,
            border: "none",
            background: "transparent",
            cursor: "default",
          }}
          onClick={() => setGapRouteMenu(null)}
        />
        <div
          role="menu"
          aria-label="キュー間の立ち位置の入り方"
          style={{
            position: "fixed",
            left: Math.max(
              8,
              Math.min(
                gapRouteMenu.clientX,
                (typeof window !== "undefined" ? window.innerWidth : 800) - 320
              )
            ),
            top: Math.max(
              8,
              Math.min(
                gapRouteMenu.clientY,
                (typeof window !== "undefined" ? window.innerHeight : 600) - 120
              )
            ),
            zIndex: 2499,
            width: "min(300px, calc(100vw - 16px))",
            maxHeight: "min(72vh, 520px)",
            overflowY: "auto",
            padding: "10px",
            borderRadius: "10px",
            border: `1px solid ${shell.border}`,
            background: shell.surface,
            boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
          }}
          onClick={(ev) => ev.stopPropagation()}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#94a3b8",
              marginBottom: "8px",
              lineHeight: 1.35,
            }}
          >
            金枠のキュー同士の間の白いブロック上で開きます。直前のキュー終了〜このキュー開始の動き方（再生の補間）。上手＝画面右（x
            大）、客席側＝手前（y 大）。
          </div>
          {GAP_APPROACH_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="menuitem"
              disabled={viewMode === "view"}
              style={{
                ...btnSecondary,
                display: "block",
                width: "100%",
                textAlign: "left",
                marginBottom: "5px",
                fontSize: "11px",
                padding: "7px 8px",
                lineHeight: 1.35,
                whiteSpace: "normal",
                cursor: viewMode === "view" ? "not-allowed" : "pointer",
              }}
              onClick={() => {
                const nextId = gapRouteMenu.nextCueId;
                setGapRouteMenu(null);
                if (viewMode === "view") return;
                setProject((p) => ({
                  ...p,
                  cues: sortCuesByStart(
                    p.cues.map((c) =>
                      c.id === nextId
                        ? {
                            ...c,
                            gapApproachFromPrev: opt.id === "linear" ? undefined : opt.id,
                          }
                        : c
                    )
                  ),
                }));
              }}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            disabled={viewMode === "view"}
            style={{
              ...btnSecondary,
              display: "block",
              width: "100%",
              textAlign: "left",
              marginTop: "4px",
              fontSize: "11px",
              padding: "7px 8px",
              cursor: viewMode === "view" ? "not-allowed" : "pointer",
            }}
            onClick={() => {
              const nextId = gapRouteMenu.nextCueId;
              setGapRouteMenu(null);
              if (viewMode === "view") return;
              setProject((p) => ({
                ...p,
                cues: sortCuesByStart(
                  p.cues.map((c) =>
                    c.id === nextId ? { ...c, gapApproachFromPrev: undefined } : c
                  )
                ),
              }));
            }}
          >
            設定をクリア（線形のみ）
          </button>
          <div style={{ borderTop: `1px solid ${shell.border}`, margin: "6px 0 4px" }} />
          <button
            type="button"
            role="menuitem"
            style={{
              ...btnSecondary,
              display: "block",
              width: "100%",
              textAlign: "center",
              fontSize: "11px",
              padding: "7px 8px",
              color: "#94a3b8",
            }}
            onClick={() => setGapRouteMenu(null)}
          >
            キャンセル
          </button>
        </div>
      </>
    ) : null;

  const waveCueConfirmPanel = waveCueConfirm ? (
    <>
      <button
        type="button"
        aria-label="確認を閉じる"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2500,
          border: "none",
          background: "rgba(2, 6, 23, 0.35)",
          cursor: "pointer",
        }}
        onClick={() => setWaveCueConfirm(null)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wave-cue-confirm-title"
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 2501,
          width: "min(360px, calc(100vw - 32px))",
          padding: "18px 20px",
          borderRadius: "12px",
          border: `1px solid ${shell.border}`,
          background: shell.surface,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <h3
          id="wave-cue-confirm-title"
          style={{
            margin: "0 0 10px",
            fontSize: "15px",
            fontWeight: 600,
            color: "#e2e8f0",
          }}
        >
          {waveCueConfirm.kind === "duplicate" ? "キューを複製" : "立ち位置リストへ"}
        </h3>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: "13px",
            color: "#cbd5e1",
            lineHeight: 1.55,
          }}
        >
          {waveCueConfirm.kind === "duplicate"
            ? "同じ立ち位置の区間を複製します。置き場所を選んでください。"
            : "このキューの立ち位置を「形の箱」（立ち位置リスト）に追加します。名前は人数に応じて自動で付けます。"}
        </p>
        {waveCueConfirm.kind === "duplicate" ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <button
              type="button"
              style={{
                ...btnSecondary,
                padding: "9px 14px",
                fontSize: "13px",
                fontWeight: 600,
                textAlign: "left",
                width: "100%",
                borderColor: "#6366f1",
                color: "#e0e7ff",
              }}
              onClick={() => {
                const cue = cuesSorted.find((c) => c.id === waveCueConfirm.cueId);
                if (cue) duplicateCueAfterSource(cue);
                setWaveCueConfirm(null);
              }}
            >
              このキューの直後
              <span
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "#a5b4fc",
                  marginTop: "3px",
                }}
              >
                金枠の右（波形の次の区間）に、すぐ近くに追加
              </span>
            </button>
            <button
              type="button"
              style={{
                ...btnSecondary,
                padding: "9px 14px",
                fontSize: "13px",
                fontWeight: 600,
                textAlign: "left",
                width: "100%",
                borderColor: "#0ea5e9",
                color: "#e0f2fe",
              }}
              onClick={() => {
                const cue = cuesSorted.find((c) => c.id === waveCueConfirm.cueId);
                if (cue) duplicateCueAtTimelineEnd(cue);
                setWaveCueConfirm(null);
              }}
            >
              タイムラインの最後
              <span
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "#7dd3fc",
                  marginTop: "3px",
                }}
              >
                最後のキュー終了位置の直後（全体の末尾）に追加
              </span>
            </button>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            type="button"
            style={{
              ...btnSecondary,
              padding: "8px 16px",
              fontSize: "13px",
              minWidth: "88px",
            }}
            onClick={() => setWaveCueConfirm(null)}
          >
            キャンセル
          </button>
          {waveCueConfirm.kind === "formationBox" ? (
            <button
              type="button"
              style={{
                ...btnSecondary,
                padding: "8px 16px",
                fontSize: "13px",
                minWidth: "88px",
                borderColor: "#6366f1",
                color: "#e0e7ff",
                fontWeight: 600,
              }}
              onClick={() => {
                saveCueFormationToBoxList(waveCueConfirm.cueId);
                setWaveCueConfirm(null);
              }}
            >
              追加する
            </button>
          ) : null}
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      {waveCueMenuPanel}
      {gapRouteMenuPanel}
      {waveCueConfirmPanel}
    </>
  );
}
