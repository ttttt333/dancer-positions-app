import { useEffect, useId, useRef, useState } from "react";
import { btnAccent, btnSecondary } from "../components/stageButtonStyles";
import { shell } from "../theme/choreoShell";

type Props = {
  title: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  cancelLabel: string;
  initialValue?: string;
  /** キャンセル時。未指定ならキャンセルボタン非表示 */
  onCancel?: () => void;
  onConfirm: (name: string) => void;
};

/** 新規作品の名前入力（作成開始前） */
export function NewProjectNameDialog({
  title,
  label,
  placeholder,
  confirmLabel,
  cancelLabel,
  initialValue = "",
  onCancel,
  onConfirm,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    if (!canSubmit) return;
    onConfirm(trimmed);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${inputId}-title`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding:
          "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
        background: "rgba(0,0,0,0.72)",
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{
          width: "min(100%, 420px)",
          background: shell.surfaceRaised,
          border: `1px solid ${shell.borderStrong}`,
          borderRadius: 16,
          padding: "22px 20px 18px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
        }}
      >
        <h1
          id={`${inputId}-title`}
          style={{
            margin: "0 0 8px",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h1>
        <label
          htmlFor={inputId}
          style={{
            display: "block",
            fontSize: 13,
            color: shell.textMuted,
            marginBottom: 8,
          }}
        >
          {label}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          maxLength={80}
          autoComplete="off"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: 10,
            border: `1px solid ${shell.borderStrong}`,
            background: shell.bgDeep,
            color: shell.text,
            fontSize: 16,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: onCancel ? "space-between" : "flex-end",
            gap: 10,
            marginTop: 18,
          }}
        >
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              style={{ ...btnSecondary, padding: "10px 16px", fontSize: 14 }}
            >
              {cancelLabel}
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              ...btnAccent,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 700,
              opacity: canSubmit ? 1 : 0.45,
              cursor: canSubmit ? "pointer" : "default",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
