import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { DancerSpot } from "../types/choreography";
import {
  DANCER_COLOR_PALETTE_HEX as DANCER_PALETTE,
  modDancerColorIndex,
} from "../lib/dancerColorPalette";
import { EditorSideSheet } from "./EditorSideSheet";

const LABEL_MAX = 120;
const MARKER_BADGE_MAX = 3;
const NOTE_MAX = 2000;
const GRADE_MAX = 32;
const SKILL_MAX = 24;
const GENDER_MAX = 32;

export type DancerQuickEditApply = {
  label: string;
  /** 名前を○の下に出すときの○内表示（最大 3 文字） */
  markerBadge: string | undefined;
  colorIndex: number;
  heightCm: number | undefined;
  gradeLabel: string | undefined;
  genderLabel: string | undefined;
  skillRankLabel: string | undefined;
  note: string | undefined;
};

type Props = {
  open: boolean;
  dancer: DancerSpot | null;
  viewMode: "edit" | "view";
  onClose: () => void;
  onApply: (patch: DancerQuickEditApply) => void;
  /** 渡したときだけ表示。ステージの「名前の表示」と同じプロジェクト設定を即時変更 */
  dancerLabelPosition?: "inside" | "below";
  onDancerLabelPositionChange?: (v: "inside" | "below") => void;
};

/**
 * 立ち位置の丸をダブルクリックしたときの編集窓。
 * 名前・身長・学年・性別・スキル・備考・印の色。名簿紐付け時は名簿側も更新。
 */
export function DancerQuickEditDialog({
  open,
  dancer,
  viewMode,
  onClose,
  onApply,
  dancerLabelPosition,
  onDancerLabelPositionChange,
}: Props) {
  const [label, setLabel] = useState("");
  const [markerBadge, setMarkerBadge] = useState("");
  const [colorIndex, setColorIndex] = useState(0);
  const [heightStr, setHeightStr] = useState("");
  const [gradeLabel, setGradeLabel] = useState("");
  const [genderLabel, setGenderLabel] = useState("");
  const [skillRankLabel, setSkillRankLabel] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open || !dancer) return;
    setLabel((dancer.label ?? "").slice(0, LABEL_MAX));
    setMarkerBadge((dancer.markerBadge ?? "").slice(0, MARKER_BADGE_MAX));
    setColorIndex(modDancerColorIndex(dancer.colorIndex));
    setHeightStr(
      typeof dancer.heightCm === "number" && Number.isFinite(dancer.heightCm)
        ? String(dancer.heightCm)
        : ""
    );
    setGradeLabel((dancer.gradeLabel ?? "").slice(0, GRADE_MAX));
    setGenderLabel((dancer.genderLabel ?? "").slice(0, GENDER_MAX));
    setSkillRankLabel((dancer.skillRankLabel ?? "").slice(0, SKILL_MAX));
    setNote(dancer.note ?? "");
  }, [open, dancer]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !dancer) return null;

  const disabled = viewMode === "view";

  const commit = () => {
    const labelTrim = label.trim().slice(0, LABEL_MAX);
    const noteTrim = note.trim().slice(0, NOTE_MAX);
    const noteOut = noteTrim ? noteTrim : undefined;

    let heightCm: number | undefined;
    const h = parseFloat(heightStr.replace(/,/g, "."));
    if (heightStr.trim() !== "" && Number.isFinite(h) && h > 0 && h < 300) {
      heightCm = Math.round(h * 10) / 10;
    } else {
      heightCm = undefined;
    }

    const g = gradeLabel.trim().slice(0, GRADE_MAX);
    const gen = genderLabel.trim().slice(0, GENDER_MAX);
    const sk = skillRankLabel.trim().slice(0, SKILL_MAX);
    const badgeTrim = markerBadge.trim().slice(0, MARKER_BADGE_MAX);

    onApply({
      label: labelTrim,
      markerBadge: badgeTrim ? badgeTrim : undefined,
      colorIndex: modDancerColorIndex(colorIndex),
      heightCm,
      gradeLabel: g ? g : undefined,
      genderLabel: gen ? gen : undefined,
      skillRankLabel: sk ? sk : undefined,
      note: noteOut,
    });
    onClose();
  };

  const labelStyle: CSSProperties = {
    display: "block",
    fontSize: "11px",
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: "4px",
    letterSpacing: "0.02em",
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #334155",
    background: "#020617",
    color: "#f1f5f9",
    fontSize: "14px",
    outline: "none",
  };

  const block = (key: string, children: ReactNode) => (
    <div key={key} style={{ marginBottom: "12px" }}>
      {children}
    </div>
  );

  return (
    <EditorSideSheet
      open
      zIndex={80}
      width="min(360px, 44vw)"
      onClose={onClose}
      ariaLabelledBy="dancer-quick-edit-title"
    >
      <div
        style={{
          padding: "14px 16px",
          color: "#e2e8f0",
        }}
      >
        <h2
          id="dancer-quick-edit-title"
          style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 700 }}
        >
          立ち位置のメンバー
        </h2>

        {block("name", (
          <>
            <span style={labelStyle}>名前</span>
            <input
              type="text"
              value={label}
              disabled={disabled}
              maxLength={LABEL_MAX}
              onChange={(e) =>
                setLabel(e.target.value.slice(0, LABEL_MAX))
              }
              style={inputStyle}
              autoFocus
            />
          </>
        ))}

        {dancerLabelPosition != null && onDancerLabelPositionChange
          ? block("namePlace", (
              <>
                <span style={labelStyle}>名前の表示（全体の見え方）</span>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    width: "100%",
                  }}
                  title="○の下では印の中は番号・略号。連番は右クリックメニューなどで変更できます。"
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onDancerLabelPositionChange("inside")}
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border:
                        dancerLabelPosition === "inside"
                          ? "1px solid rgba(99,102,241,0.9)"
                          : "1px solid #334155",
                      background:
                        dancerLabelPosition === "inside"
                          ? "rgba(99,102,241,0.22)"
                          : "#020617",
                      color:
                        dancerLabelPosition === "inside"
                          ? "#e0e7ff"
                          : "#94a3b8",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    ○の中に名前
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onDancerLabelPositionChange("below")}
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border:
                        dancerLabelPosition === "below"
                          ? "1px solid rgba(99,102,241,0.9)"
                          : "1px solid #334155",
                      background:
                        dancerLabelPosition === "below"
                          ? "rgba(99,102,241,0.22)"
                          : "#020617",
                      color:
                        dancerLabelPosition === "below"
                          ? "#e0e7ff"
                          : "#94a3b8",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    ○の下に名前
                  </button>
                </div>
              </>
            ))
          : null}

        {block("marker", (
          <>
            <span style={labelStyle}>
              ○の中の数字・略号（名前を「○の下」にしたときだけステージの丸に出ます）
            </span>
            <input
              type="text"
              value={markerBadge}
              disabled={disabled}
              maxLength={MARKER_BADGE_MAX}
              placeholder="例: 1  A  12"
              onChange={(e) =>
                setMarkerBadge(e.target.value.slice(0, MARKER_BADGE_MAX))
              }
              style={inputStyle}
            />
          </>
        ))}

        {block("height", (
          <>
            <span style={labelStyle}>身長（cm・舞台には表示しません）</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="例: 162"
              value={heightStr}
              disabled={disabled}
              onChange={(e) => setHeightStr(e.target.value)}
              style={inputStyle}
            />
          </>
        ))}

        {block("grade", (
          <>
            <span style={labelStyle}>学年</span>
            <input
              type="text"
              value={gradeLabel}
              disabled={disabled}
              maxLength={GRADE_MAX}
              placeholder="例: 高校1年"
              onChange={(e) =>
                setGradeLabel(e.target.value.slice(0, GRADE_MAX))
              }
              style={inputStyle}
            />
          </>
        ))}

        {block("gender", (
          <>
            <span style={labelStyle}>性別</span>
            <input
              type="text"
              value={genderLabel}
              disabled={disabled}
              maxLength={GENDER_MAX}
              placeholder="例: 女・男"
              onChange={(e) =>
                setGenderLabel(e.target.value.slice(0, GENDER_MAX))
              }
              style={inputStyle}
            />
          </>
        ))}

        {block("skill", (
          <>
            <span style={labelStyle}>スキル</span>
            <input
              type="text"
              value={skillRankLabel}
              disabled={disabled}
              maxLength={SKILL_MAX}
              placeholder="例: 2・A"
              onChange={(e) =>
                setSkillRankLabel(e.target.value.slice(0, SKILL_MAX))
              }
              style={inputStyle}
            />
          </>
        ))}

        {block("note", (
          <>
            <span style={labelStyle}>備考（舞台には表示しません）</span>
            <textarea
              value={note}
              disabled={disabled}
              placeholder="メモ・注意事項など"
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
                minHeight: "72px",
                fontSize: "12px",
                lineHeight: 1.45,
              }}
            />
          </>
        ))}

        <div style={{ marginBottom: "14px" }}>
          <span style={labelStyle}>印の色</span>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "6px",
            }}
          >
            {DANCER_PALETTE.map((hex, i) => (
              <button
                key={hex}
                type="button"
                disabled={disabled}
                title={`色 ${i + 1}`}
                onClick={() => setColorIndex(i)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border:
                    colorIndex === i
                      ? "3px solid #a5b4fc"
                      : "2px solid rgba(255,255,255,0.25)",
                  background: hex,
                  cursor: disabled ? "not-allowed" : "pointer",
                  padding: 0,
                  boxSizing: "border-box",
                }}
              />
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #475569",
              background: "#1e293b",
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={commit}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #14532d",
              background: "#166534",
              color: "#dcfce7",
              cursor: disabled ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            OK
          </button>
        </div>
      </div>
    </EditorSideSheet>
  );
}
