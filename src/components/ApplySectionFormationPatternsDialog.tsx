import { useEffect, useMemo, useState } from "react";
import type { LayoutPresetId } from "../lib/formationLayouts";
import type { SectionType } from "../types/audioAnalysis";
import {
  DEFAULT_SECTION_FORMATION_PATTERNS,
  SECTION_PATTERN_PICKER_OPTIONS,
  SECTION_TYPE_JP,
  sectionTypesPresent,
  type SectionPatternMap,
} from "../lib/formation/sectionFormationPatterns";
import type { MusicSection } from "../types/audioAnalysis";

type Props = {
  open: boolean;
  sections: MusicSection[];
  onApply: (map: SectionPatternMap) => void;
  onCancel: () => void;
};

/** セクション種別ごとの隊形を選んで一括適用 */
export function ApplySectionFormationPatternsDialog({
  open,
  sections,
  onApply,
  onCancel,
}: Props) {
  const types = useMemo(() => sectionTypesPresent(sections), [sections]);
  const [map, setMap] = useState<SectionPatternMap>(() => ({
    ...DEFAULT_SECTION_FORMATION_PATTERNS,
  }));

  useEffect(() => {
    if (open) {
      setMap({ ...DEFAULT_SECTION_FORMATION_PATTERNS });
    }
  }, [open]);

  if (!open) return null;

  const setType = (type: SectionType, preset: LayoutPresetId) => {
    setMap((prev) => ({ ...prev, [type]: preset }));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="section-fm-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(2, 6, 23, 0.72)",
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: "min(440px, 100%)",
          maxHeight: "min(80vh, 560px)",
          overflow: "auto",
          borderRadius: 12,
          border: "1px solid #334155",
          background: "#0f172a",
          color: "#e2e8f0",
          padding: "18px 18px 14px",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="section-fm-title"
          style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}
        >
          セクション隊形を一括適用
        </h2>
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 13,
            lineHeight: 1.55,
            color: "#94a3b8",
          }}
        >
          各セクションのキーフレームに、おすすめ隊形を割り当てます。
          サビ→V字、Aメロ→2列などがワンクリックで載ります。
        </p>

        {types.length === 0 ? (
          <p style={{ color: "#fbbf24", fontSize: 13 }}>
            先に音源解析でセクションを出してください。
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {types.map((type) => (
              <label
                key={type}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1.2fr",
                  gap: 8,
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 700 }}>{SECTION_TYPE_JP[type]}</span>
                <select
                  value={map[type] ?? DEFAULT_SECTION_FORMATION_PATTERNS[type]}
                  onChange={(e) =>
                    setType(type, e.target.value as LayoutPresetId)
                  }
                  style={{
                    borderRadius: 8,
                    border: "1px solid #475569",
                    background: "#020617",
                    color: "#e2e8f0",
                    padding: "6px 8px",
                    fontWeight: 600,
                  }}
                >
                  {SECTION_PATTERN_PICKER_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              borderRadius: 8,
              border: "1px solid #475569",
              background: "transparent",
              color: "#cbd5e1",
              padding: "8px 12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={types.length === 0}
            onClick={() => onApply(map)}
            style={{
              borderRadius: 8,
              border: "1px solid #a78bfa",
              background: "linear-gradient(180deg, #a78bfa, #7c3aed)",
              color: "#f8fafc",
              padding: "8px 12px",
              fontWeight: 700,
              cursor: types.length === 0 ? "not-allowed" : "pointer",
              opacity: types.length === 0 ? 0.5 : 1,
            }}
          >
            適用する
          </button>
        </div>
      </div>
    </div>
  );
}
