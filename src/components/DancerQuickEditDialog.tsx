import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { DancerSpot } from "../types/choreography";
import {
  DANCER_COLOR_PALETTE_HEX as DANCER_PALETTE,
  modDancerColorIndex,
} from "../lib/dancerColorPalette";
import { sliceMarkerBadgeForStorage } from "../lib/markerBadge";
import {
  normalizeDancerFaceStamp,
  type DancerFaceStampId,
} from "../lib/dancerFaceStamp";
import {
  resolveDancerFigure3dId,
  type DancerFigure3dId,
} from "../lib/dancerFigure3d";
import type { DancerFigure3dApplyScope } from "../lib/applyDancerFigure3d";
import { EditorSideSheet } from "./EditorSideSheet";
import { DancerFaceStampPicker } from "./DancerFaceStampPicker";
import { DancerFigure3dPicker } from "./DancerFigure3dPicker";
import { DancerFigure3dApplyScopeToggle } from "./DancerFigure3dApplyScopeToggle";
import { DancerGenderPicker } from "./DancerGenderPicker";
import {
  memberRosterSelectOptions,
  memberRosterSkillOptions,
} from "../lib/memberRosterSheetFields";

const LABEL_MAX = 120;
const NOTE_MAX = 2000;
const GRADE_MAX = 32;
const SKILL_MAX = 24;
const GENDER_MAX = 32;

export type DancerQuickEditApply = {
  label: string;
  /** 名前を○の下に出すときの○内表示（数字のみ最大 4、その他は 3 文字） */
  markerBadge: string | undefined;
  colorIndex: number;
  heightCm: number | undefined;
  gradeLabel: string | undefined;
  genderLabel: string | undefined;
  skillRankLabel: string | undefined;
  note: string | undefined;
  /** null で表情クリア */
  faceStamp: DancerFaceStampId | null;
  /** 3D フィギュア（人型・動物） */
  figure3d: DancerFigure3dId;
  /** 3D フィギュアの適用範囲（省略時は全キュー） */
  figure3dScope?: DancerFigure3dApplyScope;
};

type Props = {
  open: boolean;
  dancer: DancerSpot | null;
  viewMode: "edit" | "view";
  onClose: () => void;
  onApply: (patch: DancerQuickEditApply) => void;
  /** スキル選択肢の上限（名簿人数）。未指定時は 20 */
  skillOptionCount?: number;
};

type DraftFields = {
  label: string;
  markerBadge: string;
  colorIndex: number;
  faceStamp: DancerFaceStampId | null;
  figure3d: DancerFigure3dId;
  figure3dScope: DancerFigure3dApplyScope;
  heightStr: string;
  gradeLabel: string;
  genderLabel: string;
  skillRankLabel: string;
  note: string;
};

function parseHeightCm(heightStr: string): number | undefined {
  const h = parseFloat(heightStr.replace(/,/g, "."));
  if (heightStr.trim() !== "" && Number.isFinite(h) && h > 0 && h < 300) {
    return Math.round(h * 10) / 10;
  }
  return undefined;
}

function buildApplyPatch(
  draft: DraftFields,
  opts?: { trimLabel?: boolean }
): DancerQuickEditApply {
  const labelRaw = opts?.trimLabel === false ? draft.label : draft.label.trim();
  const labelOut = labelRaw.slice(0, LABEL_MAX);
  const noteTrim = draft.note.trim().slice(0, NOTE_MAX);
  const g = draft.gradeLabel.trim().slice(0, GRADE_MAX);
  const gen = draft.genderLabel.trim().slice(0, GENDER_MAX);
  const sk = draft.skillRankLabel.trim().slice(0, SKILL_MAX);
  const badgeTrim = sliceMarkerBadgeForStorage(draft.markerBadge) ?? "";
  return {
    label: labelOut,
    markerBadge: badgeTrim ? badgeTrim : undefined,
    colorIndex: modDancerColorIndex(draft.colorIndex),
    heightCm: parseHeightCm(draft.heightStr),
    gradeLabel: g ? g : undefined,
    genderLabel: gen ? gen : undefined,
    skillRankLabel: sk ? sk : undefined,
    note: noteTrim ? noteTrim : undefined,
    faceStamp: draft.faceStamp,
    figure3d: draft.figure3d,
    figure3dScope: draft.figure3dScope,
  };
}

/**
 * 立ち位置の丸をダブルクリックしたときの編集窓。
 * 名前・身長・学年・性別・スキル・備考・印の色・表情スタンプ。名簿紐付け時は名簿側も更新。
 * 変更は即反映（OK／決定ボタンなし）。閉じるだけでシートを閉じる。
 */
export function DancerQuickEditDialog({
  open,
  dancer,
  viewMode,
  onClose,
  onApply,
  skillOptionCount = 20,
}: Props) {
  const [label, setLabel] = useState("");
  const [markerBadge, setMarkerBadge] = useState("");
  const [colorIndex, setColorIndex] = useState(0);
  const [faceStamp, setFaceStamp] = useState<DancerFaceStampId | null>(null);
  const [figure3d, setFigure3d] = useState<DancerFigure3dId>("human");
  const [figure3dScope, setFigure3dScope] =
    useState<DancerFigure3dApplyScope>("all");
  const [heightStr, setHeightStr] = useState("");
  const [gradeLabel, setGradeLabel] = useState("");
  const [genderLabel, setGenderLabel] = useState("");
  const [skillRankLabel, setSkillRankLabel] = useState("");
  const [note, setNote] = useState("");

  /** 自分の即反映で dancer が更新されても、入力中の値を潰さない */
  const editDancerIdRef = useRef<string | null>(null);
  const draftRef = useRef<DraftFields>({
    label: "",
    markerBadge: "",
    colorIndex: 0,
    faceStamp: null,
    figure3d: "human",
    figure3dScope: "all",
    heightStr: "",
    gradeLabel: "",
    genderLabel: "",
    skillRankLabel: "",
    note: "",
  });

  const syncDraftRef = useCallback((next: DraftFields) => {
    draftRef.current = next;
  }, []);

  useEffect(() => {
    if (!open || !dancer) {
      editDancerIdRef.current = null;
      return;
    }
    if (editDancerIdRef.current === dancer.id) return;
    editDancerIdRef.current = dancer.id;
    const next: DraftFields = {
      label: (dancer.label ?? "").slice(0, LABEL_MAX),
      markerBadge: sliceMarkerBadgeForStorage(dancer.markerBadge) ?? "",
      colorIndex: modDancerColorIndex(dancer.colorIndex),
      faceStamp: normalizeDancerFaceStamp(dancer.faceStamp) ?? null,
      figure3d: resolveDancerFigure3dId(dancer.figure3d),
      figure3dScope: "all",
      heightStr:
        typeof dancer.heightCm === "number" && Number.isFinite(dancer.heightCm)
          ? String(dancer.heightCm)
          : "",
      gradeLabel: (dancer.gradeLabel ?? "").slice(0, GRADE_MAX),
      genderLabel: (dancer.genderLabel ?? "").slice(0, GENDER_MAX),
      skillRankLabel: (dancer.skillRankLabel ?? "").slice(0, SKILL_MAX),
      note: dancer.note ?? "",
    };
    setLabel(next.label);
    setMarkerBadge(next.markerBadge);
    setColorIndex(next.colorIndex);
    setFaceStamp(next.faceStamp);
    setFigure3d(next.figure3d);
    setFigure3dScope(next.figure3dScope);
    setHeightStr(next.heightStr);
    setGradeLabel(next.gradeLabel);
    setGenderLabel(next.genderLabel);
    setSkillRankLabel(next.skillRankLabel);
    setNote(next.note);
    syncDraftRef(next);
  }, [open, dancer, syncDraftRef]);

  const disabled = viewMode === "view";

  const pushApply = useCallback(
    (
      patch: Partial<DraftFields>,
      opts?: { trimLabel?: boolean }
    ) => {
      if (disabled) return;
      const next = { ...draftRef.current, ...patch };
      draftRef.current = next;
      onApply(buildApplyPatch(next, opts));
    },
    [disabled, onApply]
  );

  const closeSheet = useCallback(() => {
    if (!disabled) {
      onApply(buildApplyPatch(draftRef.current, { trimLabel: true }));
    }
    onClose();
  }, [disabled, onApply, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeSheet();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeSheet]);

  if (!open || !dancer) return null;

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
      onClose={closeSheet}
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

        {block(
          "name",
          <>
            <span style={labelStyle}>名前</span>
            <input
              type="text"
              value={label}
              disabled={disabled}
              maxLength={LABEL_MAX}
              onChange={(e) => {
                const next = e.target.value.slice(0, LABEL_MAX);
                setLabel(next);
                pushApply({ label: next }, { trimLabel: false });
              }}
              onBlur={() => {
                const trimmed = label.trim().slice(0, LABEL_MAX);
                if (trimmed !== label) setLabel(trimmed);
                pushApply({ label: trimmed }, { trimLabel: true });
              }}
              style={inputStyle}
              autoFocus
            />
          </>
        )}

        {block(
          "marker",
          <>
            <span style={labelStyle}>
              ○の中の数字・略号（名前を「○の下」にしたときだけステージの丸に出ます）
            </span>
            <input
              type="text"
              value={markerBadge}
              disabled={disabled}
              maxLength={4}
              placeholder="例: 1  A  12  150"
              onChange={(e) => {
                const next =
                  sliceMarkerBadgeForStorage(e.target.value) ?? "";
                setMarkerBadge(next);
                pushApply({ markerBadge: next });
              }}
              style={inputStyle}
            />
          </>
        )}

        {block(
          "height",
          <>
            <span style={labelStyle}>身長（cm・舞台には表示しません）</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="例: 162"
              value={heightStr}
              disabled={disabled}
              onChange={(e) => {
                const next = e.target.value;
                setHeightStr(next);
                draftRef.current = { ...draftRef.current, heightStr: next };
              }}
              onBlur={() => pushApply({ heightStr })}
              style={inputStyle}
            />
          </>
        )}

        {block(
          "grade",
          <>
            <span style={labelStyle}>学年</span>
            <input
              type="text"
              value={gradeLabel}
              disabled={disabled}
              maxLength={GRADE_MAX}
              placeholder="例: 高校1年"
              onChange={(e) => {
                const next = e.target.value.slice(0, GRADE_MAX);
                setGradeLabel(next);
                pushApply({ gradeLabel: next });
              }}
              style={inputStyle}
            />
          </>
        )}

        {block(
          "gender",
          <>
            <span style={labelStyle}>性別（男子＝青・女子＝ピンク）</span>
            <DancerGenderPicker
              value={genderLabel}
              disabled={disabled}
              onChange={(nextRaw) => {
                const next = nextRaw.slice(0, GENDER_MAX);
                setGenderLabel(next);
                pushApply({ genderLabel: next });
              }}
            />
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 11,
                color: "#64748b",
                lineHeight: 1.4,
              }}
            >
              もう一度押すと未設定に戻ります。未設定のときは下の印の色が使われます。
            </p>
          </>
        )}

        {block(
          "figure3d",
          <>
            <span style={labelStyle}>3Dの見た目</span>
            <p
              style={{
                margin: "0 0 8px",
                fontSize: 11,
                color: "#64748b",
                lineHeight: 1.4,
              }}
            >
              3D表示で使う人型・動物を選びます。適用範囲を選べます。
            </p>
            <DancerFigure3dApplyScopeToggle
              value={figure3dScope}
              onChange={(next) => {
                setFigure3dScope(next);
                pushApply({ figure3dScope: next });
              }}
              disabled={disabled}
            />
            <DancerFigure3dPicker
              value={figure3d}
              disabled={disabled}
              onChange={(next) => {
                setFigure3d(next);
                pushApply({ figure3d: next });
              }}
            />
          </>
        )}

        {block(
          "skill",
          <>
            <span style={labelStyle}>スキル</span>
            <select
              value={skillRankLabel}
              disabled={disabled}
              aria-label="スキル"
              title="名簿人数分の番号から選びます（小さいほど上手）"
              onChange={(e) => {
                const next = e.target.value.slice(0, SKILL_MAX);
                setSkillRankLabel(next);
                pushApply({ skillRankLabel: next });
              }}
              style={inputStyle}
            >
              <option value="">—</option>
              {memberRosterSelectOptions(
                memberRosterSkillOptions(skillOptionCount),
                skillRankLabel
              ).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </>
        )}

        {block(
          "note",
          <>
            <span style={labelStyle}>備考（舞台には表示しません）</span>
            <textarea
              value={note}
              disabled={disabled}
              placeholder="メモ・注意事項など"
              onChange={(e) => {
                const next = e.target.value.slice(0, NOTE_MAX);
                setNote(next);
                pushApply({ note: next });
              }}
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
        )}

        <div style={{ marginBottom: "14px" }}>
          <span style={labelStyle}>表情スタンプ（丸の中）</span>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 11,
              color: "#64748b",
              lineHeight: 1.4,
            }}
          >
            LINEスタンプ風の表情。付けると名前は丸の下に出ます。
          </p>
          <DancerFaceStampPicker
            value={faceStamp}
            disabled={disabled}
            onChange={(next) => {
              setFaceStamp(next);
              pushApply({ faceStamp: next });
            }}
          />
        </div>

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
                onClick={() => {
                  setColorIndex(i);
                  pushApply({ colorIndex: i });
                }}
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
            onClick={closeSheet}
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
            閉じる
          </button>
        </div>
      </div>
    </EditorSideSheet>
  );
}
