import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";
import type { ViewRosterEntry } from "../lib/viewRoster";

export type StudentPick =
  | { kind: "all" }
  | { kind: "member"; id: string; label: string };

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
        style={{
          minHeight: "100dvh",
          width: "100%",
          background: shell.bgDeep,
          color: shell.text,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 20px 48px",
          boxSizing: "border-box",
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
                style={{ ...btnAccent, padding: "10px 18px", fontSize: 14 }}
              >
                はい
              </button>
              <button
                type="button"
                onClick={onRemindChooseOther}
                style={{ ...btnSecondary, padding: "10px 18px", fontSize: 14 }}
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
      style={{
        minHeight: "100dvh",
        width: "100%",
        background: shell.bgDeep,
        color: shell.text,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px 48px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
        }}
      >
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
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 16,
            color: "#94a3b8",
            fontWeight: 600,
          }}
        >
          あなたは誰ですか？
        </p>
        {entries.length === 0 ? (
          <div>
            <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 16 }}>
              名簿にメンバーがありません。全員同じ表示で閲覧を開始します。
            </p>
            <button
              type="button"
              onClick={() => onPick({ kind: "all" })}
              style={{ ...btnAccent, padding: "12px 20px", fontSize: 15, fontWeight: 700 }}
            >
              閲覧を開始
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            {entries.map((e) => (
              <button
                key={e.id + e.label}
                type="button"
                onClick={() =>
                  onPick({ kind: "member", id: e.id, label: e.label })
                }
                style={{
                  ...btnSecondary,
                  padding: "14px 12px",
                  fontSize: 16,
                  fontWeight: 700,
                  minHeight: 48,
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
                fontSize: 14,
                fontWeight: 600,
                borderColor: "rgba(100, 116, 139, 0.9)",
              }}
            >
              全員表示
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
