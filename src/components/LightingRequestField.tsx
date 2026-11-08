import { useEffect, useRef } from "react";
import {
  LIGHTING_TEXT_COLORS,
  LIGHTING_TEXT_SIZES,
  applyLightingTextStyle,
  lightingSelectionIsBold,
  normalizeLightingTextMarks,
  type LightingTextMark,
} from "../lib/lightingText";
import styles from "./LightingPlanMode.module.css";

type Value = {
  text: string;
  marks?: LightingTextMark[];
};

function styleOf(node: HTMLElement): { bold?: boolean; size?: number; color?: string } {
  const next: { bold?: boolean; size?: number; color?: string } = {};
  const weight = node.style.fontWeight;
  if (
    weight === "700" ||
    weight === "bold" ||
    node.tagName === "B" ||
    node.tagName === "STRONG"
  ) {
    next.bold = true;
  }
  const size = Number.parseInt(node.style.fontSize, 10);
  if ((LIGHTING_TEXT_SIZES as readonly number[]).includes(size)) next.size = size;
  const color = node.style.color.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color) && color !== "#111111") next.color = color;
  return next;
}

function readEditor(root: HTMLElement): Value {
  let text = "";
  const marks: LightingTextMark[] = [];
  const walk = (
    node: Node,
    style: { bold?: boolean; size?: number; color?: string }
  ) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const chunk = node.textContent ?? "";
      if (!chunk) return;
      const start = text.length;
      text += chunk;
      if (style.bold || style.size || style.color) {
        marks.push({
          start,
          end: text.length,
          ...(style.bold ? { bold: true } : {}),
          ...(style.size ? { size: style.size } : {}),
          ...(style.color ? { color: style.color } : {}),
        });
      }
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") {
      text += "\n";
      return;
    }
    const own = styleOf(node);
    const next = {
      bold: style.bold || own.bold,
      size: own.size ?? style.size,
      color: own.color ?? style.color,
    };
    for (const child of node.childNodes) walk(child, next);
  };
  for (const child of root.childNodes) walk(child, {});
  const clipped = text.slice(0, 2000);
  return {
    text: clipped,
    marks: normalizeLightingTextMarks(marks, clipped.length),
  };
}

function writeEditor(root: HTMLElement, value: Value) {
  root.replaceChildren();
  const body = value.text.slice(0, 2000);
  if (!body) return;
  const marks = value.marks ?? [];
  let cursor = 0;
  const cuts = new Set<number>([0, body.length]);
  for (const mark of marks) {
    cuts.add(Math.max(0, Math.min(body.length, mark.start)));
    cuts.add(Math.max(0, Math.min(body.length, mark.end)));
  }
  const points = [...cuts].sort((a, b) => a - b);
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i] ?? 0;
    const end = points[i + 1] ?? start;
    if (end <= start) continue;
    const span = document.createElement("span");
    const covering = marks.filter((mark) => mark.start <= start && mark.end >= end);
    if (covering.some((mark) => mark.bold)) span.style.fontWeight = "700";
    const size = covering.find((mark) => mark.size)?.size;
    const color = covering.find((mark) => mark.color)?.color;
    if (size) span.style.fontSize = `${size}px`;
    if (color) span.style.color = color;
    span.textContent = body.slice(start, end);
    root.appendChild(span);
    cursor = end;
  }
  if (cursor < body.length) {
    root.appendChild(document.createTextNode(body.slice(cursor)));
  }
}

function offsetIn(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

function selectionRange(root: HTMLElement): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = offsetIn(root, range.startContainer, range.startOffset);
  const end = offsetIn(root, range.endContainer, range.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function placeCaret(root: HTMLElement, start: number, end: number) {
  const selection = window.getSelection();
  if (!selection) return;
  const points: { node: Text; offset: number }[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let node = walker.nextNode() as Text | null;
  const want = [start, end];
  const found: ({ node: Text; offset: number } | null)[] = [null, null];
  while (node) {
    const len = node.data.length;
    want.forEach((target, index) => {
      if (!found[index] && seen + len >= target) {
        found[index] = { node, offset: target - seen };
      }
    });
    seen += len;
    node = walker.nextNode() as Text | null;
  }
  const anchor = found[0] ?? points[0];
  const focus = found[1] ?? anchor;
  if (!anchor || !focus) return;
  const range = document.createRange();
  range.setStart(anchor.node, anchor.offset);
  range.setEnd(focus.node, focus.offset);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function LightingRequestField({
  number,
  text,
  marks,
  disabled,
  onChange,
}: {
  number: number;
  text: string;
  marks?: LightingTextMark[];
  disabled: boolean;
  onChange: (value: Value) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const savedRange = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || focused.current) return;
    writeEditor(root, { text, marks });
  }, [text, marks]);

  const emit = () => {
    const root = rootRef.current;
    if (!root) return;
    onChange(readEditor(root));
  };

  const apply = (patch: { bold?: boolean | null; size?: number | null; color?: string | null }) => {
    const root = rootRef.current;
    if (!root || disabled) return;
    const current = readEditor(root);
    const range = savedRange.current ?? selectionRange(root) ?? { start: 0, end: 0 };
    const bold =
      patch.bold === true
        ? !lightingSelectionIsBold(current.text, current.marks, range.start, range.end)
        : patch.bold;
    const nextMarks = applyLightingTextStyle(current.text, current.marks, range.start, range.end, {
      ...patch,
      bold,
    });
    writeEditor(root, { text: current.text, marks: nextMarks });
    root.focus();
    placeCaret(root, range.start, range.end);
    onChange({ text: current.text, marks: nextMarks });
  };

  return (
    <div className={styles.lightStack}>
      <div
        className={styles.lightTools}
        onMouseDownCapture={() => {
          const root = rootRef.current;
          if (root) savedRange.current = selectionRange(root);
        }}
      >
        <button
          type="button"
          className={styles.toolButton}
          disabled={disabled}
          title="選択した文字を太字にします。選択がなければ全体です"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply({ bold: true })}
        >
          太字
        </button>
        <select
          className={styles.toolSelect}
          aria-label={`キュー ${number} の文字の大きさ`}
          defaultValue=""
          disabled={disabled}
          title="選択した文字の大きさを変えます。選択がなければ全体です"
          onChange={(event) => {
            const size = Number(event.target.value);
            event.target.value = "";
            if (LIGHTING_TEXT_SIZES.includes(size as (typeof LIGHTING_TEXT_SIZES)[number])) {
              apply({ size });
            }
          }}
        >
          <option value="">大きさ</option>
          {LIGHTING_TEXT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        {LIGHTING_TEXT_COLORS.map((color) => (
          <button
            key={color.id}
            type="button"
            className={styles.swatch}
            style={{ background: color.value }}
            aria-label={`キュー ${number} を${color.label}にする`}
            title={`${color.label}。選択した文字だけ変わります`}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              apply({ color: color.value === "#111111" ? null : color.value })
            }
          />
        ))}
      </div>
      <div
        ref={rootRef}
        className={styles.rich}
        role="textbox"
        aria-multiline="true"
        aria-label={`キュー ${number} の照明要望`}
        data-placeholder="赤系、サス、ピンスポ…"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          emit();
        }}
        onInput={emit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            document.execCommand("insertText", false, "\n");
            emit();
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          const plain = event.clipboardData.getData("text/plain").replace(/\r\n/g, "\n");
          document.execCommand("insertText", false, plain);
          emit();
        }}
      />
    </div>
  );
}
