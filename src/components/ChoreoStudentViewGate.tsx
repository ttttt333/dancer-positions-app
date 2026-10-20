import { useState } from "react";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";
import type { ViewRosterEntry } from "../lib/viewRoster";
import { ChoreoViewerViralCta } from "./ChoreoViewerViralCta";

export type StudentPick =
  | { kind: "all" }
  | { kind: "member"; id: string; label: string };

/** 名前ボタン・全員（シート用／ゲート用の共通部） */
export function ChoreoMemberPickerPanel({
  entries,
  onPick,
  heading = "表示する人を選ぶ",
  subheading = "あなたの立ち位置を大きく表示するか、全員同じ大きさで表示します。",
  compact = false,
  publicSheet = false,
  hideAllButton = false,
}: {
  entries: ViewRosterEntry[];
  onPick: (p: StudentPick) => void;
  heading?: string;
  subheading?: string;
  /** シート内表示で余白を詰める */
  compact?: boolean;
  /** 生徒閲覧のメンバー変更シート — 全員スクロール表示 */
  publicSheet?: boolean;
  /** 名前の一覧だけ出す（全員表示ボタンを出さない） */
  hideAllButton?: boolean;
}) {
  return (
    <div
      className={[
        "choreo-member-picker",
        publicSheet ? "choreo-member-picker--sheet" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        textAlign: "center" as const,
        padding: compact ? "0" : "0 4px",
        maxWidth: publicSheet ? "none" : 420,
        width: "100%",
        margin: "0 auto",
        boxSizing: "border-box",
        paddingLeft: publicSheet
          ? 0
          : "max(4px, env(safe-area-inset-left, 0px))",
        paddingRight: publicSheet
          ? 0
          : "max(4px, env(safe-area-inset-right, 0px))",
        ...(publicSheet
          ? {
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column" as const,
            }
          : {}),
      }}
    >
      {heading ? (
        <p
          style={{
            margin: compact ? "0 0 8px" : "0 0 10px",
            fontSize: compact ? 15 : 17,
            color: "#e2e8f0",
            fontWeight: 700,
            lineHeight: 1.3,
            flexShrink: 0,
          }}
        >
          {heading}
        </p>
      ) : null}
      {!publicSheet ? (
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 13,
            color: "#94a3b8",
            lineHeight: 1.5,
            flexShrink: 0,
          }}
        >
          {subheading}
        </p>
      ) : null}
      {entries.length === 0 ? (
        <div>
          <p style={{ color: "#94a3b8", fontSize: 15, marginBottom: 16, lineHeight: 1.45 }}>
            名簿にメンバーがありません。全員同じ表示にします。
          </p>
          <button
            type="button"
            onClick={() => onPick({ kind: "all" })}
            style={{ ...btnAccent, padding: "14px 22px", fontSize: 16, fontWeight: 700, minHeight: 48 }}
          >
            全員表示で閲覧
          </button>
        </div>
      ) : (
        <div
          className={[
            "choreo-member-picker-scroll",
            publicSheet ? "choreo-member-picker-scroll--sheet" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="choreo-member-picker-grid">
            {entries.map((e) => (
              <button
                key={e.id + e.label}
                type="button"
                onClick={() =>
                  onPick({ kind: "member", id: e.id, label: e.label })
                }
                style={{
                  ...btnSecondary,
                  padding: "14px 10px",
                  fontSize: 16,
                  fontWeight: 700,
                  minHeight: 50,
                }}
              >
                {e.label}
              </button>
            ))}
            {hideAllButton ? null : (
            <button
              type="button"
              onClick={() => onPick({ kind: "all" })}
              style={{
                ...btnSecondary,
                gridColumn: "1 / -1",
                padding: "12px 12px",
                fontSize: 15,
                fontWeight: 600,
                borderColor: "rgba(100, 116, 139, 0.9)",
                minHeight: 48,
              }}
            >
              全員表示
            </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type Props = {
  pieceTitle: string;
  entries: ViewRosterEntry[];
  onPick: (p: StudentPick) => void;
  /** "remind" = 前回の続きを確認, "pick" = メンバー選択 */
  gateMode: "remind" | "pick";
  lastPick?: StudentPick | null;
  onRemindContinue?: () => void;
  onRemindChooseOther?: () => void;
};

export function ChoreoStudentViewGate({
  pieceTitle,
  entries,
  onPick,
  gateMode,
  lastPick,
  onRemindContinue,
  onRemindChooseOther,
}: Props) {
  const [pickStep, setPickStep] = useState<"mode" | "member">("mode");
  if (gateMode === "remind" && lastPick && onRemindContinue && onRemindChooseOther) {
    return (
      <div
        className="choreo-student-view-gate"
        style={{
          minHeight: "100dvh",
          width: "100%",
          maxWidth: "100vw",
          background: shell.bgDeep,
          color: shell.text,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding:
            "max(32px, env(safe-area-inset-top, 0px)) max(20px, env(safe-area-inset-right, 0px)) max(48px, env(safe-area-inset-bottom, 0px)) max(20px, env(safe-area-inset-left, 0px))",
          boxSizing: "border-box",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
          <p style={{ margin: "0 0 8px", fontSize: 28, lineHeight: 1.2 }} aria-hidden>
            🎵
          </p>
          <h1
            style={{
              margin: "0 0 24px",
              fontSize: 20,
              fontWeight: 700,
              color: "#e2e8f0",
            }}
          >
            {pieceTitle.trim() || "無題の作品"} - 閲覧モード
          </h1>
          <div
            style={{
              marginBottom: 0,
              padding: 16,
              borderRadius: 12,
              border: `1px solid ${shell.border}`,
              background: "rgba(15,23,42,0.85)",
            }}
          >
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "#94a3b8" }}>
              前回は
              {lastPick.kind === "all"
                ? "「全員表示」"
                : `「${lastPick.label}」`}
              でした。同じ表示にしますか？
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                onClick={onRemindContinue}
                style={{ ...btnAccent, padding: "12px 20px", fontSize: 16, minHeight: 48 }}
              >
                はい
              </button>
              <button
                type="button"
                onClick={onRemindChooseOther}
                style={{ ...btnSecondary, padding: "12px 20px", fontSize: 16, minHeight: 48 }}
              >
                他の人／選び直す
              </button>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <ChoreoViewerViralCta variant="gate" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      className="choreo-student-view-gate choreo-student-view-gate--pick"
      style={{
        minHeight: "100dvh",
        height: "100dvh",
        width: "100%",
        maxWidth: "100vw",
        background: shell.bgDeep,
        color: shell.text,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        padding:
          "max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px))",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div className="choreo-student-view-gate__pick-header">
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 28,
            lineHeight: 1.2,
            textAlign: "center",
          }}
          aria-hidden
        >
          🎵
        </p>
        <h1
          style={{
            margin: "0 0 12px",
            fontSize: 20,
            fontWeight: 700,
            color: "#e2e8f0",
            textAlign: "center",
          }}
        >
          {pieceTitle.trim() || "無題の作品"} - 閲覧モード
        </h1>
      </div>
      <div className="choreo-student-view-gate__pick-body">
        {pickStep === "mode" || entries.length === 0 ? (
          <div
            data-student-view-mode-choice
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              maxWidth: 420,
              width: "100%",
              margin: "auto",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 2px", fontSize: 17, color: "#e2e8f0", fontWeight: 700 }}>
              表示のしかたを選んでください
            </p>
            <button
              type="button"
              data-student-view-mode="all"
              onClick={() => onPick({ kind: "all" })}
              style={{ ...btnSecondary, ...modeBtn }}
            >
              <span style={{ fontSize: 18, fontWeight: 700 }}>全体表示</span>
              <span style={modeBtnHint}>全員を同じ大きさで表示します</span>
            </button>
            <button
              type="button"
              data-student-view-mode="member"
              disabled={entries.length === 0}
              onClick={() => setPickStep("member")}
              style={{ ...btnAccent, ...modeBtn, opacity: entries.length === 0 ? 0.45 : 1 }}
            >
              <span style={{ fontSize: 18, fontWeight: 700 }}>個別表示</span>
              <span style={{ ...modeBtnHint, color: "inherit", opacity: 0.85 }}>
                {entries.length === 0
                  ? "名簿にメンバーがいないため選べません"
                  : "自分の名前を選び、自分の立ち位置を大きく光らせます"}
              </span>
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              data-student-view-back
              onClick={() => setPickStep("mode")}
              style={{
                ...btnSecondary,
                alignSelf: "flex-start",
                padding: "8px 14px",
                fontSize: 14,
                minHeight: 40,
                marginBottom: 10,
                flexShrink: 0,
              }}
            >
              ← 戻る
            </button>
            <ChoreoMemberPickerPanel
              entries={entries}
              onPick={onPick}
              heading="あなたは誰ですか？"
              subheading="名前を選ぶと、あなたの立ち位置を大きく光らせて表示します。"
              compact
              publicSheet
              hideAllButton
            />
          </>
        )}
      </div>
      <div className="choreo-student-view-gate__viral">
        <ChoreoViewerViralCta variant="gate" />
      </div>
    </div>
  );
}

const modeBtn = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  gap: 4,
  padding: "18px 16px",
  minHeight: 76,
  width: "100%",
  boxSizing: "border-box" as const,
};

const modeBtnHint = {
  fontSize: 13,
  fontWeight: 500,
  color: "#94a3b8",
  lineHeight: 1.4,
};
