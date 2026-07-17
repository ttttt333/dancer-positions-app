import type { CSSProperties } from "react";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";
import type { DancerSizeApplyScope } from "../lib/applyDancerSizeOverrides";

export type StageSizeApplyKind = "marker" | "name";

type Props = {
  kind: StageSizeApplyKind;
  onChoose: (scope: DancerSizeApplyScope) => void;
  onCancel: () => void;
};

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
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
 * ○サイズ / 名下フォント変更後に、適用範囲（このキュー / すべて）を選ばせる。
 */
export function StageSizeApplyScopeDialog({ kind, onChoose, onCancel }: Props) {
  const title =
    kind === "marker" ? "丸の大きさを変更" : "名前の大きさを変更";
  const body =
    kind === "marker"
      ? "変更した丸の大きさを、どこに適用しますか？"
      : "変更した名前の大きさを、どこに適用しますか？";

  return (
    <div
      style={backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="stage-size-apply-title"
      onClick={onCancel}
    >
      <div
        style={card}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="stage-size-apply-title"
          style={{
            margin: "0 0 8px",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 13,
            lineHeight: 1.55,
            color: shell.textMuted,
          }}
        >
          {body}
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
            このキューの中だけ変える
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
            すべてのキューに適用する
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
            キャンセル（変更しない）
          </button>
        </div>
      </div>
    </div>
  );
}
