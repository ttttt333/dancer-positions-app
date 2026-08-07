/**
 * sectionType / pattern → メートル座標（中央原点、+y=客席側手前）
 */

import type { ClassProfile, FormationPatternId, MemberPosition, PoseLevel } from "./types";

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function snap(v: number, mode: ClassProfile["gridSnapMode"]): number {
  if (mode === "integer") return Math.round(v);
  return Math.round(v * 20) / 20;
}

function line(
  n: number,
  y: number,
  span: number,
  ids: string[]
): Omit<MemberPosition, "poseLevel">[] {
  if (n <= 0) return [];
  if (n === 1) return [{ memberId: ids[0]!, x: 0, y }];
  return Array.from({ length: n }, (_, i) => ({
    memberId: ids[i]!,
    x: -span / 2 + (i / (n - 1)) * span,
    y,
  }));
}

export function buildPatternPositions(
  pattern: FormationPatternId,
  memberIds: string[],
  profile: ClassProfile,
  salt = 0
): MemberPosition[] {
  const n = memberIds.length;
  const ids = [...memberIds];
  const mode = profile.gridSnapMode;
  let raw: Omit<MemberPosition, "poseLevel">[] = [];

  switch (pattern) {
    case "center_condensed": {
      const r = Math.min(1.6, 0.35 + n * 0.12);
      raw = ids.map((id, i) => {
        const a = (Math.PI * 2 * i) / Math.max(1, n) + salt * 0.1;
        return {
          memberId: id,
          x: Math.cos(a) * r * 0.9,
          y: 0.8 + Math.sin(a) * r * 0.5,
        };
      });
      break;
    }
    case "silhouette_line":
      raw = line(n, 0.2, Math.min(10, 1.2 * n), ids);
      break;
    case "split_lr": {
      const left = Math.ceil(n / 2);
      const L = ids.slice(0, left);
      const R = ids.slice(left);
      raw = [
        ...line(L.length, 0.6, Math.min(4, L.length * 1.1), L).map((p) => ({
          ...p,
          x: p.x - 2.8,
        })),
        ...line(R.length, 0.6, Math.min(4, R.length * 1.1), R).map((p) => ({
          ...p,
          x: p.x + 2.8,
        })),
      ];
      break;
    }
    case "small_groups": {
      const g = Math.max(2, Math.ceil(n / 3));
      raw = ids.map((id, i) => {
        const gi = Math.floor(i / g);
        const li = i % g;
        const gc = Math.ceil(n / g);
        return {
          memberId: id,
          x: (gi - (gc - 1) / 2) * 3.2 + (li - (g - 1) / 2) * 0.9,
          y: 1.2 - (gi % 2) * 1.4,
        };
      });
      break;
    }
    case "vee": {
      if (n === 1) {
        raw = [{ memberId: ids[0]!, x: 0, y: 2.2 }];
        break;
      }
      raw = [{ memberId: ids[0]!, x: 0, y: 2.3 }];
      const rest = ids.slice(1);
      const left = Math.ceil(rest.length / 2);
      for (let i = 0; i < left; i++) {
        const t = (i + 1) / (left + 0.5);
        raw.push({
          memberId: rest[i]!,
          x: -t * 4.5,
          y: 2.3 - t * 3.6,
        });
      }
      for (let i = left; i < rest.length; i++) {
        const t = (i - left + 1) / (rest.length - left + 0.5);
        raw.push({
          memberId: rest[i]!,
          x: t * 4.5,
          y: 2.3 - t * 3.6,
        });
      }
      break;
    }
    case "double_u": {
      // W字: 2つの谷
      raw = ids.map((id, i) => {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const x = -4.8 + t * 9.6;
        const y = 1.8 - Math.abs(Math.sin(t * Math.PI * 2)) * 2.2;
        return { memberId: id, x, y };
      });
      break;
    }
    case "wide_spread":
      raw = line(n, 1.6, Math.min(11, 1.5 * n), ids);
      break;
    case "fast_shift": {
      const front = Math.ceil(n / 2);
      raw = [
        ...line(front, 2.0, 9, ids.slice(0, front)),
        ...line(n - front, -1.2, 8, ids.slice(front)),
      ];
      break;
    }
    case "circle": {
      const r = Math.min(3.2, 1.2 + n * 0.15);
      raw = ids.map((id, i) => {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        return {
          memberId: id,
          x: Math.cos(a) * r * 1.2,
          y: Math.sin(a) * r * 0.85,
        };
      });
      break;
    }
    case "dynamic_cross": {
      const a = Math.ceil(n / 2);
      const A = ids.slice(0, a);
      const B = ids.slice(a);
      raw = [
        ...A.map((id, i) => {
          const t = A.length === 1 ? 0.5 : i / (A.length - 1);
          return { memberId: id, x: -4 + t * 8, y: 2 - t * 4 };
        }),
        ...B.map((id, i) => {
          const t = B.length === 1 ? 0.5 : i / (B.length - 1);
          return { memberId: id, x: -4 + t * 8, y: -2 + t * 4 };
        }),
      ];
      break;
    }
    case "front_asymmetry": {
      raw = ids.map((id, i) => ({
        memberId: id,
        x: -3 + i * 1.1 + (i % 2) * 0.8,
        y: 2.0 - (i % 3) * 0.7,
      }));
      break;
    }
    default:
      raw = line(n, 0.5, 9, ids);
  }

  return raw.map((p) => ({
    memberId: p.memberId,
    x: snap(clamp(p.x, -5.5, 5.5), mode),
    y: snap(clamp(p.y, -3.2, 3.2), mode),
    poseLevel: "stand" as PoseLevel,
  }));
}
