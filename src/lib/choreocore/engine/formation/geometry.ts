import type { FormationSlot, FormationSlotRole } from "../types/FormationTypes";

export function clampUnit(value: number): number {
  if (value < -1) return -1;
  if (value > 1) return 1;
  return value;
}

function slot(
  x: number,
  y: number,
  visualWeight = 1,
  role: FormationSlotRole = "DEFAULT",
  groupId = 0
): FormationSlot {
  return {
    x: clampUnit(x),
    y: clampUnit(y),
    visualWeight,
    role,
    groupId,
  };
}

function linspace(count: number, start: number, end: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(start + end) / 2];
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(start + ((end - start) * i) / (count - 1));
  }
  return out;
}

/** Push overlapping unit slots apart without randomness. */
export function separateSlots(
  slots: FormationSlot[],
  minDist: number
): FormationSlot[] {
  const out = slots.map((s) => ({ ...s }));
  const min2 = minDist * minDist;
  for (let iter = 0; iter < 8; iter += 1) {
    let moved = false;
    for (let i = 0; i < out.length; i += 1) {
      for (let j = i + 1; j < out.length; j += 1) {
        const a = out[i]!;
        const b = out[j]!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min2 || d2 === 0) {
          if (d2 === 0) {
            a.x = clampUnit(a.x - minDist * 0.5);
            b.x = clampUnit(b.x + minDist * 0.5);
            moved = true;
          }
          continue;
        }
        const d = Math.sqrt(d2);
        const push = (minDist - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        a.x = clampUnit(a.x + ux * push);
        a.y = clampUnit(a.y + uy * push);
        b.x = clampUnit(b.x - ux * push);
        b.y = clampUnit(b.y - uy * push);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return out;
}

export function applySpread(slots: FormationSlot[], spread: number): FormationSlot[] {
  const s = Math.max(0.12, Math.min(1, spread));
  return slots.map((slotItem) => ({
    ...slotItem,
    x: clampUnit(slotItem.x * s),
    y: clampUnit(slotItem.y * s),
  }));
}

export function layoutLine(
  count: number,
  y = 0,
  xSpread = 0.92,
  groupId = 0
): FormationSlot[] {
  return linspace(count, -xSpread, xSpread).map((x, i) => {
    const center = count <= 1 || Math.abs(i - (count - 1) / 2) < 0.6;
    return slot(x, y, center ? 1.2 : 1, center ? "MAIN" : "DEFAULT", groupId);
  });
}

export function layoutDoubleLine(count: number, rows = 2): FormationSlot[] {
  const rowCount = Math.max(1, Math.min(rows, count));
  const base = Math.floor(count / rowCount);
  const extra = count % rowCount;
  const ys = linspace(rowCount, -0.45, 0.45);
  const out: FormationSlot[] = [];
  let remaining = count;
  for (let r = 0; r < rowCount; r += 1) {
    const n = r < extra ? base + 1 : base;
    if (n <= 0 || remaining <= 0) continue;
    const take = Math.min(n, remaining);
    out.push(...layoutLine(take, ys[r] ?? 0, 0.9, r));
    remaining -= take;
  }
  return out;
}

export function layoutV(
  count: number,
  wide: boolean,
  apexY: number
): FormationSlot[] {
  if (count === 1) return [slot(0, apexY, 1.5, "CENTER")];
  const xSpan = wide ? 0.98 : 0.72;
  const tipY = apexY;
  const baseY = -apexY * 0.85;
  const left = Math.floor((count - 1) / 2);
  const right = count - 1 - left;
  const out: FormationSlot[] = [slot(0, tipY, 1.6, "CENTER")];
  linspace(left, 1, left).forEach((i) => {
    const t = left === 0 ? 1 : i / left;
    out.push(slot(-t * xSpan, tipY + t * (baseY - tipY), 1, "WING", 1));
  });
  linspace(right, 1, right).forEach((i) => {
    const t = right === 0 ? 1 : i / right;
    out.push(slot(t * xSpan, tipY + t * (baseY - tipY), 1, "WING", 2));
  });
  return out.slice(0, count);
}

export function layoutDiagonal(count: number, direction: 1 | -1): FormationSlot[] {
  const xs = linspace(count, -0.9, 0.9);
  return xs.map((x, i) => {
    const y = direction * x * 0.75;
    const main = i === Math.floor((count - 1) / 2);
    return slot(x, y, main ? 1.3 : 1, main ? "MAIN" : "DEFAULT");
  });
}

export function layoutDoubleDiagonal(count: number): FormationSlot[] {
  const a = Math.ceil(count / 2);
  const b = count - a;
  const first = layoutDiagonal(a, 1).map((s) => ({
    ...s,
    y: clampUnit(s.y - 0.22),
    groupId: 0,
  }));
  const second = layoutDiagonal(b, -1).map((s) => ({
    ...s,
    y: clampUnit(s.y + 0.22),
    groupId: 1,
  }));
  return [...first, ...second];
}

export function layoutTriangle(count: number): FormationSlot[] {
  if (count === 1) return [slot(0, 0, 1.5, "CENTER")];
  if (count === 2) return [slot(-0.4, 0.2), slot(0.4, 0.2)];
  const vertices: FormationSlot[] = [
    slot(0, 0.72, 1.5, "CENTER"),
    slot(-0.82, -0.62, 1, "WING", 1),
    slot(0.82, -0.62, 1, "WING", 2),
  ];
  if (count <= 3) return vertices.slice(0, count);
  const remaining = count - 3;
  const edges: Array<[FormationSlot, FormationSlot]> = [
    [vertices[0]!, vertices[1]!],
    [vertices[0]!, vertices[2]!],
    [vertices[1]!, vertices[2]!],
  ];
  const extras: FormationSlot[] = [];
  for (let i = 0; i < remaining; i += 1) {
    const [a, b] = edges[i % 3]!;
    const perEdge = Math.floor(i / 3) + 1;
    const t = (perEdge + 1) / (perEdge + 2);
    extras.push(slot(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 1, "DEFAULT", i % 3));
  }
  return [...vertices, ...extras];
}

export function layoutDiamond(count: number, withCenter: boolean): FormationSlot[] {
  const verts: FormationSlot[] = [
    slot(0, 0.78, 1.4, "MAIN"),
    slot(0.78, 0, 1, "WING", 1),
    slot(0, -0.78, 1, "DEFAULT"),
    slot(-0.78, 0, 1, "WING", 2),
  ];
  if (count <= 4) {
    if (count === 4) return verts;
    if (withCenter && count === 5) return [slot(0, 0, 1.6, "CENTER"), ...verts.slice(0, 4)];
    return verts.slice(0, count);
  }
  const out = withCenter && count % 2 === 1 ? [slot(0, 0, 1.7, "CENTER"), ...verts] : [...verts];
  let i = 0;
  while (out.length < count) {
    const a = verts[i % 4]!;
    const b = verts[(i + 1) % 4]!;
    const t = 0.35 + (Math.floor(i / 4) % 3) * 0.15;
    out.push(slot(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
    i += 1;
  }
  return out.slice(0, count);
}

export function gridDims(count: number): { cols: number; rows: number } {
  if (count <= 0) return { cols: 0, rows: 0 };
  if (count === 9) return { cols: 3, rows: 3 };
  if (count === 10) return { cols: 5, rows: 2 };
  if (count === 12) return { cols: 4, rows: 3 };
  if (count === 15) return { cols: 5, rows: 3 };
  if (count === 16) return { cols: 4, rows: 4 };
  if (count === 20) return { cols: 5, rows: 4 };
  if (count === 24) return { cols: 6, rows: 4 };
  if (count === 30) return { cols: 6, rows: 5 };
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  return { cols, rows };
}

export function layoutGrid(count: number): FormationSlot[] {
  const { cols, rows } = gridDims(count);
  const xs = linspace(cols, -0.9, 0.9);
  const ys = linspace(rows, 0.7, -0.7);
  const out: FormationSlot[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (out.length >= count) break;
      const cx = (cols - 1) / 2;
      const weight = Math.abs(c - cx) < 0.6 ? 1.25 : 1;
      out.push(slot(xs[c] ?? 0, ys[r] ?? 0, weight, weight > 1 ? "MAIN" : "DEFAULT", r));
    }
  }
  return out;
}

export function layoutArc(
  count: number,
  radius = 0.78,
  start = Math.PI * 0.15,
  end = Math.PI * 0.85
): FormationSlot[] {
  const angles = linspace(count, start, end);
  return angles.map((angle, i) => {
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius - 0.15;
    const mid = i === Math.floor((count - 1) / 2);
    return slot(x, y, mid ? 1.4 : 1, mid ? "CENTER" : "DEFAULT");
  });
}

export function layoutCluster(count: number): FormationSlot[] {
  if (count === 1) return [slot(0, 0, 1.5, "CENTER")];
  const out: FormationSlot[] = [slot(0, 0, 1.6, "CENTER")];
  let placed = 1;
  let ring = 1;
  while (placed < count) {
    const onRing = Math.min(count - placed, ring * 6);
    const radius = 0.22 * ring;
    const angles = linspace(onRing, 0, Math.PI * 2 - Math.PI * 2 / Math.max(onRing, 1));
    for (let i = 0; i < onRing; i += 1) {
      const a = angles[i] ?? 0;
      out.push(slot(Math.cos(a) * radius, Math.sin(a) * radius, 1, "DEFAULT"));
    }
    placed += onRing;
    ring += 1;
  }
  return separateSlots(out.slice(0, count), 0.12);
}

export function layoutCenterWings(count: number): FormationSlot[] {
  if (count === 1) return [slot(0, 0, 1.6, "CENTER")];
  const centerN = Math.max(1, Math.round(count * 0.22));
  const remain = count - centerN;
  const leftN = Math.floor(remain / 2);
  const rightN = remain - leftN;
  const out: FormationSlot[] = [];
  out.push(
    ...layoutLine(centerN, 0, Math.min(0.22, 0.08 * centerN)).map((s, i) => ({
      ...s,
      visualWeight: 1.5,
      role: i === Math.floor((centerN - 1) / 2) ? ("CENTER" as const) : ("MAIN" as const),
      groupId: 0,
    }))
  );
  if (leftN > 0) {
    out.push(
      ...layoutLine(leftN, 0.05, 0.28).map((s) =>
        slot(s.x - 0.62, s.y, 1, "WING", 1)
      )
    );
  }
  if (rightN > 0) {
    out.push(
      ...layoutLine(rightN, 0.05, 0.28).map((s) =>
        slot(s.x + 0.62, s.y, 1, "WING", 2)
      )
    );
  }
  return out.slice(0, count);
}

export function defaultSplitSizes(count: number): number[] {
  if (count <= 1) return [count];
  if (count === 24) return [8, 8, 8];
  if (count >= 21 && count % 3 === 0) {
    const g = count / 3;
    return [g, g, g];
  }
  if (count >= 18 && count % 3 === 0) {
    const g = count / 3;
    return [g, g, g];
  }
  if (count % 2 === 0) return [count / 2, count / 2];
  return [Math.floor(count / 2), Math.ceil(count / 2)];
}

export function groupPartitions(count: number): number[][] {
  const partitions: number[][] = [defaultSplitSizes(count)];
  if (count === 24) {
    partitions.push([6, 12, 6], [4, 8, 8, 4]);
  } else if (count === 20) {
    partitions.push([5, 10, 5], [4, 6, 6, 4]);
  } else if (count >= 21 && count % 2 === 0) {
    partitions.push([count / 2, count / 2]);
    const a = Math.round(count * 0.25);
    const c = a;
    const b = count - a - c;
    if (b > 0) partitions.push([a, b, c]);
  }
  return partitions;
}

export function layoutSplit(count: number, sizes?: number[]): FormationSlot[] {
  const groups = sizes && sizes.length >= 2 ? sizes : defaultSplitSizes(count);
  const n = groups.length;
  const xs = linspace(n, -0.82, 0.82);
  const out: FormationSlot[] = [];
  for (let g = 0; g < n; g += 1) {
    const size = groups[g]!;
    const cx = xs[g] ?? 0;
    const local = size <= 4 ? layoutLine(size, 0, 0.18) : layoutGrid(size);
    for (const s of local) {
      out.push(
        slot(
          s.x * (size <= 4 ? 1 : 0.22) + cx,
          s.y * 0.55,
          s.visualWeight,
          g === 0 || g === n - 1 ? "WING" : "MAIN",
          g
        )
      );
    }
  }
  return separateSlots(out.slice(0, count), 0.11);
}

export function pyramidRows(count: number): number[] {
  const rows: number[] = [];
  let used = 0;
  let odd = 1;
  while (used + odd <= count) {
    rows.push(odd);
    used += odd;
    odd += 2;
  }
  if (used < count) {
    if (rows.length === 0) return [count];
    rows[rows.length - 1]! += count - used;
  }
  return rows;
}

export function layoutPyramid(count: number): FormationSlot[] {
  const rows = pyramidRows(count);
  const ys = linspace(rows.length, 0.82, -0.7);
  const out: FormationSlot[] = [];
  for (let r = 0; r < rows.length; r += 1) {
    const n = rows[r]!;
    const spread = 0.22 + (r / Math.max(1, rows.length - 1)) * 0.7;
    const line = layoutLine(n, ys[r] ?? 0, spread, r);
    if (r === 0 && line[0]) {
      line[0] = { ...line[0], visualWeight: 1.7, role: "CENTER" };
    }
    out.push(...line);
  }
  return out.slice(0, count);
}

export function layoutArrow(count: number): FormationSlot[] {
  return layoutV(count, false, 0.7).map((s, i) =>
    i === 0 ? { ...s, visualWeight: 1.8, role: "CENTER" } : s
  );
}

export function layoutCenter(count: number): FormationSlot[] {
  if (count === 1) return [slot(0, 0, 1.8, "CENTER")];
  const centerN = 1;
  const remain = count - centerN;
  const leftN = Math.floor(remain / 2);
  const rightN = remain - leftN;
  const out: FormationSlot[] = [slot(0, 0, 1.8, "CENTER")];
  if (leftN > 0) {
    out.push(
      ...layoutLine(leftN, 0, 0.35).map((s) => slot(s.x - 0.5, s.y * 0.4, 1, "WING", 1))
    );
  }
  if (rightN > 0) {
    out.push(
      ...layoutLine(rightN, 0, 0.35).map((s) => slot(s.x + 0.5, s.y * 0.4, 1, "WING", 2))
    );
  }
  return separateSlots(out.slice(0, count), 0.1);
}

export function layoutSolo(kind: string): FormationSlot[] {
  switch (kind) {
    case "left":
      return [slot(-0.55, 0, 1.2, "MAIN")];
    case "right":
      return [slot(0.55, 0, 1.2, "MAIN")];
    case "front":
      return [slot(0, -0.55, 1.2, "MAIN")];
    case "back":
      return [slot(0, 0.55, 1.2, "MAIN")];
    case "diagonal":
      return [slot(0.45, 0.45, 1.2, "MAIN")];
    default:
      return [slot(0, 0, 1.8, "CENTER")];
  }
}

export function layoutPair(kind: string): FormationSlot[] {
  switch (kind) {
    case "front-back":
      return [slot(0, -0.35, 1.1, "MAIN"), slot(0, 0.35, 1.1, "MAIN", 1)];
    case "diagonal":
      return [slot(-0.4, 0.35, 1, "DEFAULT"), slot(0.4, -0.35, 1, "DEFAULT", 1)];
    case "mirror":
      return [slot(-0.42, 0.1, 1.1, "WING", 1), slot(0.42, 0.1, 1.1, "WING", 2)];
    case "center-pair":
      return [slot(-0.18, 0, 1.3, "CENTER"), slot(0.18, 0, 1.3, "CENTER")];
    default:
      return [slot(-0.32, 0, 1.2, "MAIN", 1), slot(0.32, 0, 1.2, "MAIN", 2)];
  }
}

export function layoutSquare(count: number): FormationSlot[] {
  if (count <= 4) {
    const pts = [
      slot(-0.4, 0.4),
      slot(0.4, 0.4),
      slot(-0.4, -0.4),
      slot(0.4, -0.4),
    ];
    return pts.slice(0, count);
  }
  return layoutGrid(count);
}
