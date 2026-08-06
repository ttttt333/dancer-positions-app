/**
 * 人数ちょうど向けの実践的隊列レイアウト（メートル・中央原点）
 * アイドル／ダンス指導でよく使う並びだけに限定する。
 */

import type { Position } from "./types";

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export type LayoutKind =
  | "line"
  | "two_row"
  | "three_row"
  | "diag"
  | "vee"
  | "arc"
  | "cluster"
  | "split"
  | "stagger"
  | "wedge"
  | "cross";

export type RealisticLayout = {
  id: string;
  name: string;
  kind: LayoutKind;
  /** quiet | verse | lift | chorus | break */
  moods: Array<"quiet" | "verse" | "lift" | "chorus" | "break">;
  /** サビ頭で最優先するインパクト隊列 */
  impact?: boolean;
  positions: Position[];
};

function line(n: number, y: number, span = 9.5): Position[] {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 0, y }];
  return Array.from({ length: n }, (_, i) => ({
    x: -span / 2 + (i / (n - 1)) * span,
    y,
  }));
}

function twoRows(n: number, yFront: number, yBack: number, span = 9): Position[] {
  const front = Math.ceil(n / 2);
  const back = n - front;
  return [
    ...line(front, yFront, span * (front / Math.max(front, back))),
    ...line(back, yBack, span * (back / Math.max(front, back))),
  ];
}

function threeRows(n: number): Position[] {
  const a = Math.ceil(n / 3);
  const b = Math.ceil((n - a) / 2);
  const c = n - a - b;
  return [
    ...line(a, 2.0, 8.5),
    ...line(b, 0.3, 9.2),
    ...line(c, -1.6, 8.5),
  ];
}

function diagonal(n: number, frontLeft: boolean): Position[] {
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = frontLeft ? -4.2 + t * 8.4 : 4.2 - t * 8.4;
    const y = 2.2 - t * 4.2;
    return { x, y };
  });
}

function vee(n: number, tipFront: boolean): Position[] {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 0, y: tipFront ? 2.2 : -1.8 }];
  const tipY = tipFront ? 2.3 : -2.0;
  const baseY = tipFront ? -1.6 : 2.0;
  const out: Position[] = [{ x: 0, y: tipY }];
  const rest = n - 1;
  const left = Math.ceil(rest / 2);
  const right = rest - left;
  for (let i = 0; i < left; i++) {
    const t = (i + 1) / (left + 0.5);
    out.push({ x: -t * 4.5, y: tipY + (baseY - tipY) * t });
  }
  for (let i = 0; i < right; i++) {
    const t = (i + 1) / (right + 0.5);
    out.push({ x: t * 4.5, y: tipY + (baseY - tipY) * t });
  }
  return out;
}

function arc(n: number, y: number, bow: number): Position[] {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 0, y }];
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const x = -4.6 + t * 9.2;
    const yy = y + Math.sin(t * Math.PI) * bow;
    return { x, y: clamp(yy, -3.2, 3.2) };
  });
}

function cluster(n: number, cy: number, radius: number): Position[] {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 0, y: cy }];
  const out: Position[] = [];
  // 粗い螺旋／リングで密集
  for (let i = 0; i < n; i++) {
    const ring = Math.floor(i / 6);
    const idx = i % 6;
    const r = 0.35 + ring * radius * 0.55;
    const a = (Math.PI * 2 * idx) / 6 + ring * 0.35;
    out.push({
      x: clamp(Math.cos(a) * r * 1.2, -4.5, 4.5),
      y: clamp(cy + Math.sin(a) * r * 0.9, -3.0, 3.0),
    });
  }
  return out;
}

function splitLR(n: number, y: number): Position[] {
  const left = Math.ceil(n / 2);
  const right = n - left;
  return [
    ...line(left, y, Math.min(4.2, 1.1 * left)).map((p) => ({
      x: p.x - 2.6,
      y: p.y,
    })),
    ...line(right, y, Math.min(4.2, 1.1 * right)).map((p) => ({
      x: p.x + 2.6,
      y: p.y,
    })),
  ];
}

function stagger(n: number, tight: boolean): Position[] {
  const dx = tight ? 1.35 : 1.7;
  const dy = tight ? 1.0 : 1.25;
  const cols = Math.ceil(Math.sqrt(n * 1.4));
  const out: Position[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const offset = r % 2 === 0 ? 0 : dx / 2;
    const rowW = Math.min(cols, n - r * cols);
    const x0 = -((rowW - 1) * dx) / 2;
    out.push({
      x: clamp(x0 + c * dx + offset, -5.2, 5.2),
      y: clamp(1.8 - r * dy, -3.0, 3.0),
    });
  }
  return out;
}

function wedge(n: number): Position[] {
  // 手前が広く奥が狭い
  if (n <= 3) return twoRows(n, 1.6, -0.8);
  const front = Math.ceil(n * 0.55);
  const back = n - front;
  return [...line(front, 1.9, 9.5), ...line(back, -1.2, 6.5)];
}

/** クロスチェンジ風（2本の斜め線） */
function cross(n: number): Position[] {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 0, y: 0 }];
  const a = Math.ceil(n / 2);
  const b = n - a;
  const armA = Array.from({ length: a }, (_, i) => {
    const t = a === 1 ? 0.5 : i / (a - 1);
    return { x: -4.2 + t * 8.4, y: 2.0 - t * 4.0 };
  });
  const armB = Array.from({ length: b }, (_, i) => {
    const t = b === 1 ? 0.5 : i / (b - 1);
    return { x: -4.2 + t * 8.4, y: -2.0 + t * 4.0 };
  });
  return [...armA, ...armB];
}

/**
 * 人数 n 用の現実的レイアウト一覧を生成する。
 */
export function buildRealisticLayouts(n: number): RealisticLayout[] {
  const count = Math.max(1, Math.min(25, Math.round(n)));
  const L = (
    id: string,
    name: string,
    kind: LayoutKind,
    moods: RealisticLayout["moods"],
    positions: Position[],
    impact = false
  ): RealisticLayout => ({ id, name, kind, moods, positions, impact });

  const list: RealisticLayout[] = [
    L("line_mid", "横一列（中）", "line", ["quiet", "verse", "break"], line(count, 0.4)),
    L("line_front", "横一列（手前）", "line", ["lift", "chorus"], line(count, 2.1)),
    L("line_back", "横一列（奥）", "line", ["quiet", "break"], line(count, -1.8)),
    L("line_wide", "横一列（広め）", "line", ["chorus", "lift"], line(count, 1.0, 10.5), true),
    L("two_mid", "2列", "two_row", ["verse", "lift"], twoRows(count, 1.4, -1.0)),
    L(
      "two_front",
      "2列（前寄り）",
      "two_row",
      ["lift", "chorus"],
      twoRows(count, 2.0, 0.1)
    ),
    L("diag_fl", "斜め（左前→右奥）", "diag", ["verse", "lift"], diagonal(count, true)),
    L("diag_fr", "斜め（右前→左奥）", "diag", ["verse", "lift"], diagonal(count, false)),
    L("vee_front", "大V字（手前先端）", "vee", ["chorus", "lift"], vee(count, true), true),
    L("vee_back", "逆V字", "vee", ["chorus"], vee(count, false), true),
    L("arc_front", "扇形（手前）", "arc", ["lift", "chorus"], arc(count, 1.6, 1.3), true),
    L("arc_soft", "浅い弧", "arc", ["verse", "lift"], arc(count, 0.6, 0.7)),
    L("cluster_mid", "中央密集", "cluster", ["quiet", "break"], cluster(count, 0.2, 1.1)),
    L("cluster_front", "手前密集", "cluster", ["break", "chorus"], cluster(count, 1.6, 1.0)),
    L("split_mid", "左右分割", "split", ["lift", "chorus"], splitLR(count, 0.5), true),
    L("cross", "クロスチェンジ", "cross", ["chorus", "lift"], cross(count), true),
    L("stagger", "千鳥", "stagger", ["verse", "lift"], stagger(count, false)),
    L("stagger_tight", "千鳥（密）", "stagger", ["quiet", "verse"], stagger(count, true)),
    L("wedge", "手前ワイド", "wedge", ["chorus", "lift"], wedge(count), true),
  ];

  if (count >= 7) {
    list.push(
      L("three_rows", "3列", "three_row", ["verse", "lift"], threeRows(count))
    );
  }

  return list;
}
