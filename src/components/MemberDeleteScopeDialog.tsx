import type { CSSProperties } from "react";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";
import type { MemberDeleteScope } from "../lib/removeMemberFromStage";

type Props = {
  memberLabel?: string;
  count?: number;
  onChoose: (scope: MemberDeleteScope) => void;
  onCancel: () => void;
};

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2400,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const card: CSSProperties = {
  width: "min(420px, 100%)",
  borderRadius: 14,
  border: `1px solid ${shell.borderStrong}`,
  background: shell.surfaceRaised,
  color: shell.text,
  padding: "18px 18px 16px",
  boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
};

/**
 * メンバー削除時に適用範囲（このキュー / すべてのキュー）を選ばせる。
 */
export function MemberDeleteScopeDialog({
  memberLabel,
  count = 1,
  onChoose,
  onCancel,
}: Props) {
  const who =
    count > 1
      ? `選択中の ${count} 人`
      : memberLabel?.trim()
        ? `「${memberLabel.trim()}」`
        : "このメンバー";

  return (
    <div
      style={backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-delete-scope-title"
      onClick={onCancel}
    >
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <h2
          id="member-delete-scope-title"
          style={{
            margin: "0 0 8px",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          メンバーを削除
        </h2>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 13,
            lineHeight: 1.55,
            color: shell.textMuted,
          }}
        >
          {who}を舞台から削除します。どの範囲に反映しますか？
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <button
            type="button"
            style={{
              ...btnAccent,
              width: "100%",
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 700,
            }}
            onClick={() => onChoose("cue")}
          >
            このキューのみ
          </button>
          <button
            type="button"
            style={{
              ...btnSecondary,
              width: "100%",
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 700,
              borderColor: shell.borderStrong,
              color: shell.text,
            }}
            onClick={() => onChoose("all")}
          >
            すべてのキューに反映
          </button>
          <button
            type="button"
            style={{
              ...btnSecondary,
              width: "100%",
              padding: "10px 14px",
              fontSize: 13,
            }}
            onClick={onCancel}
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
