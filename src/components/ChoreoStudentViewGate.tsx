import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";
import type { ViewRosterEntry } from "../lib/viewRoster";

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
}: {
  entries: ViewRosterEntry[];
  onPick: (p: StudentPick) => void;
  heading?: string;
  subheading?: string;
  /** シート内表示で余白を詰める */
  compact?: boolean;
  /** 生徒閲覧のメンバー変更シート — 全員スクロール表示 */
  publicSheet?: boolean;
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
        <ChoreoMemberPickerPanel
          entries={entries}
          onPick={onPick}
          heading="あなたは誰ですか？"
          subheading="スマホでも見やすい閲覧モードです。あなたの立ち位置を大きく光らせるか、全員同じ大きさで表示するかを選びます。"
          compact
          publicSheet
        />
      </div>
    </div>
  );
}
