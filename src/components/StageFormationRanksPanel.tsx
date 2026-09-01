import type { CSSProperties, ReactNode } from "react";
import type { DepthSwapInspect } from "../lib/stageDepthPreview";
import { btnSecondary } from "./stageButtonStyles";

const card: CSSProperties = {
  border: "1px solid #1e293b",
  borderRadius: 10,
  padding: "10px 10px 12px",
  marginBottom: 12,
  background: "#080b12",
};

const sectionTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#94a3b8",
  margin: "0 0 6px",
};

const sectionHint: CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  margin: "0 0 8px",
  lineHeight: 1.45,
};

const rowCard: CSSProperties = {
  display: "flex",
  alignItems: "center",
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#020617",
  color: "#e2e8f0",
  fontSize: 16,
  fontWeight: 800,
  minHeight: 48,
  boxSizing: "border-box",
};

function RankButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      style={{
        ...btnSecondary,
        width: "100%",
        padding: "10px 12px",
        fontSize: 13,
        fontWeight: 600,
        minHeight: 44,
        lineHeight: 1.35,
        whiteSpace: "normal",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

export type StageFormationRanksPanelProps = {
  inspect: DepthSwapInspect;
  onSwapPair: (colA: number, colB: number, noChange: boolean) => void;
  onKamiteShimote: () => void;
  onRotate: (dir: "cw" | "ccw") => void;
};

/**
 * ⋯「その他の操作」→ 隊列タブと同じカード構成。
 * 列は1列ずつ並べ、2列を1つに括らない。
 */
export function StageFormationRanksPanel({
  inspect,
  onSwapPair,
  onKamiteShimote,
  onRotate,
}: StageFormationRanksPanelProps) {
  return (
    <div data-formation-ranks-panel>
      <div style={card}>
        <div style={sectionTitle}>列の前後交代（横位置はそのまま）</div>
        <p style={sectionHint}>
          {inspect.axis === "depth-rows"
            ? "前後の段を自動判定し、選んだ段どうしの前後だけ入れ替えます。"
            : "横位置の縦列を自動判定し、選んだ列どうしの前後だけ入れ替えます。"}
          {inspect.summary ? `（${inspect.summary}）` : null}
        </p>
        {inspect.groupCount >= 1 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {inspect.groupLines.map((line, i) => {
              const pair = inspect.pairs.find((p) => p.colA === i);
              if (!pair) {
                return (
                  <div key={`${line}-${i}`} style={rowCard}>
                    {line}
                  </div>
                );
              }
              return (
                <RankButton
                  key={`${line}-${i}`}
                  title={
                    pair.noChange
                      ? `${line}の前後は隣の列と同じです`
                      : `${line}と次の列の前後を交換（左右は動かない）`
                  }
                  onClick={() =>
                    onSwapPair(pair.colA, pair.colB, pair.noChange)
                  }
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#e2e8f0",
                    }}
                  >
                    {line}
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 3,
                      fontSize: 12,
                      fontWeight: 600,
                      color: pair.noChange ? "#64748b" : "#94a3b8",
                    }}
                  >
                    {pair.noChange
                      ? "変化なし"
                      : `次の列と前後入れ替え · 移動 ${pair.movementLabel}`}
                  </span>
                </RankButton>
              );
            })}
          </div>
        ) : (
          <p style={{ ...sectionHint, margin: 0 }}>
            列を判定するには、横位置が分かれる 2 人以上を選んでください。
          </p>
        )}
      </div>

      <div style={card}>
        <div style={sectionTitle}>上手・下手の交代（前後はそのまま）</div>
        <p style={sectionHint}>選択範囲の左右を反転します。前後は動きません。</p>
        <RankButton title="選択範囲の左右を反転" onClick={onKamiteShimote}>
          上手 ⇄ 下手
        </RankButton>
      </div>

      <div style={{ ...card, marginBottom: 0 }}>
        <div style={sectionTitle}>位置の入れ替え（2人以上）</div>
        <p style={sectionHint}>
          形はそのまま、人だけを重心まわりに 1 つずらします。
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <RankButton title="右回りに1人ずらす" onClick={() => onRotate("cw")}>
            右回り 1人
          </RankButton>
          <RankButton title="左回りに1人ずらす" onClick={() => onRotate("ccw")}>
            左回り 1人
          </RankButton>
        </div>
      </div>
    </div>
  );
}
