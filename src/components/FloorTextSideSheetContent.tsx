import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { FloorTextPlaceSession } from "../types/choreography";
import {
  createDefaultFloorTextPlaceSession,
  FLOOR_TEXT_BODY_MAX_LEN,
} from "../lib/floorTextPlaceSession";
import styles from "./FloorTextSideSheetContent.module.css";

const COLOR_SWATCHES = [
  { hex: "#ffffff", label: "白" },
  { hex: "#fef08a", label: "黄" },
  { hex: "#fb923c", label: "オレンジ" },
  { hex: "#f87171", label: "赤" },
  { hex: "#f472b6", label: "ピンク" },
  { hex: "#c084fc", label: "紫" },
  { hex: "#60a5fa", label: "青" },
  { hex: "#34d399", label: "緑" },
  { hex: "#a3e635", label: "黄緑" },
  { hex: "#94a3b8", label: "グレー" },
  { hex: "#1e293b", label: "黒" },
  { hex: "#fcd34d", label: "ゴールド" },
] as const;

export type FloorTextSideSheetContentProps = {
  open: boolean;
  floorTextPlaceSession: FloorTextPlaceSession | null;
  setFloorTextPlaceSession: Dispatch<SetStateAction<FloorTextPlaceSession | null>>;
  commitFloorTextPlace: () => boolean;
  onClose: () => void;
  onCancel: () => void;
  onCommitted: () => void;
  t: (key: string) => string;
};

export function FloorTextSideSheetContent({
  open,
  floorTextPlaceSession,
  setFloorTextPlaceSession,
  commitFloorTextPlace,
  onClose,
  onCancel,
  onCommitted,
  t,
}: FloorTextSideSheetContentProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setValidationError(null);
      return;
    }
    if (!floorTextPlaceSession) {
      setFloorTextPlaceSession(createDefaultFloorTextPlaceSession());
    }
  }, [open, floorTextPlaceSession, setFloorTextPlaceSession]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      textareaRef.current?.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(id);
  }, [open, floorTextPlaceSession?.editTargetId]);

  const updateSession = useCallback(
    (updater: (prev: FloorTextPlaceSession) => FloorTextPlaceSession) => {
      setFloorTextPlaceSession((prev) => {
        const base = prev ?? createDefaultFloorTextPlaceSession();
        return updater(base);
      });
      setValidationError(null);
    },
    [setFloorTextPlaceSession]
  );

  const handleCommit = useCallback(() => {
    const body = floorTextPlaceSession?.body.trim() ?? "";
    if (!body) {
      setValidationError(t("editor.layout.floorTextAlert"));
      textareaRef.current?.focus({ preventScroll: true });
      return;
    }
    if (commitFloorTextPlace()) {
      onCommitted();
    }
  }, [commitFloorTextPlace, floorTextPlaceSession?.body, onCommitted, t]);

  const bodyLen = floorTextPlaceSession?.body.length ?? 0;
  const currentColor = (
    floorTextPlaceSession?.color &&
    /^#[0-9a-fA-F]{6}$/i.test(floorTextPlaceSession.color)
      ? floorTextPlaceSession.color
      : "#fef08a"
  ).toLowerCase();

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 id="floor-text-sheet-title" className={styles.title}>
          <span style={{ color: "#818cf8", display: "flex", opacity: 0.9 }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="4 7 4 4 20 4 20 7" />
              <line x1="9" y1="20" x2="15" y2="20" />
              <line x1="12" y1="4" x2="12" y2="20" />
            </svg>
          </span>
          {floorTextPlaceSession?.editTargetId ? "テキストを編集" : "床テキスト"}
        </h2>
        <button
          type="button"
          className={styles.closeBtn}
          aria-label={t("editor.layout.close")}
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className={styles.body}>
        <p className={styles.hint}>
          {floorTextPlaceSession?.editTargetId
            ? "内容を編集して保存できます。"
            : "文字を入力し、ステージをタップまたはドラッグで位置を指定してから決定してください。"}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className={styles.fieldLabel} htmlFor="floor-text-body-input">
            テキスト
          </label>
          <textarea
            ref={textareaRef}
            id="floor-text-body-input"
            rows={5}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            placeholder={t("editor.layout.floorTextPlaceholder")}
            value={floorTextPlaceSession?.body ?? ""}
            maxLength={FLOOR_TEXT_BODY_MAX_LEN}
            className={`${styles.textarea}${validationError ? ` ${styles.textareaError}` : ""}`}
            onChange={(e) =>
              updateSession((s) => ({ ...s, body: e.target.value }))
            }
          />
          <div className={styles.charCount}>
            {bodyLen}/{FLOOR_TEXT_BODY_MAX_LEN}
          </div>
          {validationError ? (
            <p className={styles.error} role="alert">
              {validationError}
            </p>
          ) : null}
        </div>

        <div className={styles.scopeRow}>
          {(["formation", "global"] as const).map((scope) => {
            const active = (floorTextPlaceSession?.scope ?? "formation") === scope;
            return (
              <button
                key={scope}
                type="button"
                className={`${styles.scopeBtn}${active ? ` ${styles.scopeBtnActive}` : ""}`}
                onClick={() => updateSession((s) => ({ ...s, scope }))}
              >
                {scope === "formation" ? "このキューのみ" : "全キューに表示"}
              </button>
            );
          })}
        </div>

        <div className={styles.sizeRow}>
          <label htmlFor="floor-text-size-range">
            サイズ: {floorTextPlaceSession?.fontSizePx ?? 24}px
          </label>
          <input
            id="floor-text-size-range"
            type="range"
            min={8}
            max={72}
            value={floorTextPlaceSession?.fontSizePx ?? 24}
            onChange={(e) =>
              updateSession((s) => ({
                ...s,
                fontSizePx: Number(e.target.value),
              }))
            }
          />
        </div>

        <div className={styles.colorSection}>
          <div className={styles.colorRow}>
            <label htmlFor="floor-text-color-input">{t("editor.layout.textColor")}</label>
            <input
              id="floor-text-color-input"
              type="color"
              className={styles.colorPicker}
              value={currentColor}
              onChange={(e) =>
                updateSession((s) => ({ ...s, color: e.target.value }))
              }
            />
          </div>
          <div className={styles.palette}>
            {COLOR_SWATCHES.map(({ hex, label }) => {
              const selected = currentColor === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  type="button"
                  title={label}
                  className={`${styles.swatch}${selected ? ` ${styles.swatchSelected}` : ""}`}
                  style={{ background: hex }}
                  onClick={() => updateSession((s) => ({ ...s, color: hex }))}
                />
              );
            })}
          </div>
        </div>

        <button type="button" className={styles.primaryBtn} onClick={handleCommit}>
          {floorTextPlaceSession?.editTargetId
            ? "✓ 変更を保存"
            : "✓ 決定（ステージに配置）"}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </div>
  );
}
