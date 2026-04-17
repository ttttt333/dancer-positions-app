import { Fragment, useCallback, useEffect, useState } from "react";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";
import {
  dancersWithPresetAndWingSurplus,
  LAYOUT_PRESET_OPTIONS,
  type LayoutPresetId,
} from "../lib/formationLayouts";
import { btnPrimary, btnSecondary } from "./StageBoard";
import { FormationPresetThumb } from "./FormationPresetThumb";

type Props = {
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  onStagePreviewChange?: (dancers: DancerSpot[] | null) => void;
  onClose: () => void;
  /** 反映確定後に呼ぶ（パネルを閉じる等） */
  onAfterApply?: () => void;
  /** プリセットを書き込むフォーメーション id（未指定時は activeFormationId） */
  formationTargetId?: string | null;
  /**
   * floating: 画面右固定（従来）。
   * embedded: 親（ステージ列）の下に流し込み。エディタの左ペイン用。
   */
  variant?: "floating" | "embedded";
};

/**
 * 「フォーメーション案」— 人数と多数のレイアウトプリセットから選ぶ。
 * floating は従来どおり右固定。embedded はエディタ左列のステージ下に配置する。
 */
export function FormationSuggestionPanel({
  project,
  setProject,
  onStagePreviewChange,
  onClose,
  onAfterApply,
  variant = "floating",
  formationTargetId = null,
}: Props) {
  const { viewMode } = project;
  const [count, setCount] = useState(6);
  const [pendingPreset, setPendingPreset] = useState<LayoutPresetId | null>(null);
  /** §6 人数が増えたとき、既存メイン人数ぶんだけプリセットを敷き、超過を袖へ */
  const [surplusToWings, setSurplusToWings] = useState(true);

  const targetFormationId =
    formationTargetId != null &&
    project.formations.some((f) => f.id === formationTargetId)
      ? formationTargetId
      : project.activeFormationId;

  useEffect(() => {
    const f = project.formations.find((x) => x.id === targetFormationId);
    if (!f) return;
    const raw = f.confirmedDancerCount ?? f.dancers.length;
    const n = Math.max(1, Math.min(80, Math.max(1, raw)));
    setCount(n);
    setPendingPreset(null);
    onStagePreviewChange?.(null);
  }, [targetFormationId, project.formations, onStagePreviewChange]);

  const nClamped = Math.max(1, Math.min(80, Math.floor(count) || 1));

  const previousBodyCount = (() => {
    const f = project.formations.find((x) => x.id === targetFormationId);
    if (!f) return nClamped;
    if (f.dancers.length > 0) {
      return f.confirmedDancerCount ?? f.dancers.length;
    }
    return f.confirmedDancerCount ?? nClamped;
  })();

  useEffect(() => {
    if (pendingPreset == null) return;
    onStagePreviewChange?.(
      dancersWithPresetAndWingSurplus(
        nClamped,
        pendingPreset,
        previousBodyCount,
        surplusToWings
      )
    );
  }, [
    nClamped,
    pendingPreset,
    previousBodyCount,
    surplusToWings,
    onStagePreviewChange,
  ]);

  const applyPreset = useCallback(
    (preset: LayoutPresetId) => {
      if (viewMode === "view") return;
      const n = nClamped;
      const f0 = project.formations.find((x) => x.id === targetFormationId);
      const prev =
        f0 && f0.dancers.length > 0
          ? f0.confirmedDancerCount ?? f0.dancers.length
          : f0?.confirmedDancerCount ?? n;
      const dancers = dancersWithPresetAndWingSurplus(n, preset, prev, surplusToWings);
      setProject((p) => ({
        ...p,
        formations: p.formations.map((f) =>
          f.id === targetFormationId ? { ...f, dancers, confirmedDancerCount: n } : f
        ),
      }));
      setPendingPreset(null);
      onStagePreviewChange?.(null);
      onAfterApply?.();
    },
    [
      nClamped,
      onAfterApply,
      onStagePreviewChange,
      setProject,
      viewMode,
      targetFormationId,
      surplusToWings,
      project.formations,
    ]
  );

  const pickPending = useCallback(
    (preset: LayoutPresetId) => {
      if (viewMode === "view") return;
      setPendingPreset(preset);
    },
    [viewMode]
  );

  const cancelPreview = useCallback(() => {
    setPendingPreset(null);
    onStagePreviewChange?.(null);
  }, [onStagePreviewChange]);

  const floatingFrame =
    variant === "floating"
      ? {
          position: "fixed" as const,
          zIndex: 45,
          top: 72,
          right: 12,
          width: "min(400px, calc(100vw - 24px))",
          maxHeight: "calc(100vh - 88px)",
          borderRadius: "12px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.55)",
        }
      : {
          position: "relative" as const,
          zIndex: 1,
          width: "100%",
          flex: "1 1 200px",
          minHeight: 180,
          maxHeight: "min(42vh, 400px)",
          marginTop: 10,
          borderRadius: "10px",
          boxShadow: "none",
        };

  return (
    <aside
      data-formation-suggestion-panel
      data-variant={variant}
      role="complementary"
      aria-label="フォーメーション案"
      style={{
        ...floatingFrame,
        display: "flex",
        flexDirection: "column",
        border: "1px solid #334155",
        background: "#0f172a",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: "10px 12px",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "10px",
        }}
      >
        <div>
          <h3
            style={{
              margin: "0 0 4px",
              fontSize: "14px",
              fontWeight: 700,
              color: "#e2e8f0",
            }}
          >
            フォーメーション案
          </h3>
          <p style={{ margin: 0, fontSize: "11px", color: "#64748b", lineHeight: 1.45 }}>
            上で人数を決め、下のカードから形を選ぶと
            {variant === "embedded" ? "上のステージ" : "左のステージ"}
            にプレビュー。
            <strong style={{ color: "#94a3b8" }}> この形で反映</strong>
            で選択中のフォーメーションに確定します。
          </p>
        </div>
        <button
          type="button"
          style={{ ...btnSecondary, padding: "4px 10px", fontSize: "12px", flexShrink: 0 }}
          onClick={onClose}
          aria-label="フォーメーション案を閉じる"
        >
          閉じる
        </button>
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: "8px 12px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px",
          borderBottom: "1px solid #1e293b",
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "#94a3b8",
          }}
        >
          人数
          <input
            type="number"
            min={1}
            max={80}
            value={count}
            disabled={viewMode === "view"}
            onChange={(e) => setCount(Number(e.target.value))}
            style={{
              width: "56px",
              padding: "4px 6px",
              borderRadius: "6px",
              border: "1px solid #475569",
              background: "#020617",
              color: "#e2e8f0",
              fontSize: "13px",
            }}
          />
        </label>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
          反映時 {nClamped} 人分で上書きします
        </span>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            color: "#94a3b8",
            cursor: viewMode === "view" ? "not-allowed" : "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={surplusToWings}
            disabled={viewMode === "view"}
            onChange={(e) => setSurplusToWings(e.target.checked)}
          />
          §6 余りを袖へ（増員時のみメイン人数ぶんをプリセット）
        </label>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "10px 10px 12px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))",
            gap: "8px",
          }}
        >
          {LAYOUT_PRESET_OPTIONS.map((opt, i) => {
            const selected = pendingPreset === opt.id;
            return (
              <Fragment key={opt.id}>
                {i === 0 ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#64748b",
                      letterSpacing: "0.06em",
                      padding: "2px 2px 4px",
                    }}
                  >
                    ピラミッド・段
                  </div>
                ) : null}
                {opt.id === "line" ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#64748b",
                      letterSpacing: "0.06em",
                      padding: "10px 2px 4px",
                      borderTop: "1px solid #1e293b",
                      marginTop: 4,
                    }}
                  >
                    定番の形
                  </div>
                ) : null}
                {opt.id === "scatter" ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#64748b",
                      letterSpacing: "0.06em",
                      padding: "10px 2px 4px",
                      borderTop: "1px solid #1e293b",
                      marginTop: 4,
                    }}
                  >
                    個性的な形
                  </div>
                ) : null}
                <button
                  type="button"
                  aria-pressed={selected}
                  disabled={viewMode === "view"}
                  onClick={() => pickPending(opt.id)}
                  style={{
                    ...(selected ? btnPrimary : btnSecondary),
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: "6px",
                    padding: "8px",
                    textAlign: "left",
                    minHeight: "88px",
                    borderRadius: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: selected ? "#f8fafc" : "#cbd5e1",
                    }}
                  >
                    <FormationPresetThumb preset={opt.id} width={40} />
                    <span style={{ fontSize: "12px", fontWeight: 600, lineHeight: 1.3 }}>
                      {opt.label}
                    </span>
                  </div>
                  <span style={{ fontSize: "10px", opacity: 0.85, lineHeight: 1.35 }}>
                    客席は下側。番号は左から順に割り当て
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: "10px 12px",
          borderTop: "1px solid #1e293b",
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          style={btnSecondary}
          disabled={viewMode === "view" || pendingPreset == null}
          onClick={cancelPreview}
        >
          プレビューをやめる
        </button>
        <button
          type="button"
          style={btnPrimary}
          disabled={viewMode === "view" || pendingPreset == null}
          onClick={() => pendingPreset && applyPreset(pendingPreset)}
        >
          この形で反映
        </button>
      </div>
    </aside>
  );
}
