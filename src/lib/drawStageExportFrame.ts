import type { StageExportAppearance } from "./stageExportAppearance";

export type ExportFormationFrame = {
  startSec: number;
  dancers: Array<{
    name: string;
    color: string;
    x: number;
    y: number;
  }>;
};

type FloorRect = { x: number; y: number; w: number; h: number };

function fitStageLayout(
  width: number,
  height: number,
  appearance: StageExportAppearance
): {
  outer: FloorRect;
  main: FloorRect;
} {
  const outerW = appearance.showShell
    ? appearance.Wmm + 2 * appearance.Smm
    : appearance.Wmm || 12;
  const outerD = appearance.showShell
    ? appearance.Dmm + appearance.Bmm
    : appearance.Dmm || 8;
  const aspect = outerW / outerD;
  const pad = 28;
  const maxW = width - pad * 2;
  const maxH = height - pad * 2 - 24;
  let ow = maxW;
  let oh = ow / aspect;
  if (oh > maxH) {
    oh = maxH;
    ow = oh * aspect;
  }
  const ox = (width - ow) / 2;
  const oy = (height - oh) / 2 - 8;

  const outer: FloorRect = { x: ox, y: oy, w: ow, h: oh };

  if (!appearance.showShell || appearance.Wmm <= 0 || appearance.Dmm <= 0) {
    return { outer, main: outer };
  }

  const sw = appearance.Smm / outerW;
  const bw = appearance.Bmm / outerD;
  const mw = appearance.Wmm / outerW;
  const mh = appearance.Dmm / outerD;

  const main: FloorRect = {
    x: ox + ow * sw,
    y: oy + oh * bw,
    w: ow * mw,
    h: oh * mh,
  };
  return { outer, main };
}

function drawShellChrome(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  appearance: StageExportAppearance,
  outer: FloorRect,
  main: FloorRect
) {
  ctx.fillStyle = "#0a0f18";
  ctx.fillRect(0, 0, width, height);

  if (appearance.showShell && appearance.Bmm > 0) {
    const bh = main.y - outer.y;
    ctx.fillStyle = "#111827";
    ctx.fillRect(outer.x, outer.y, outer.w, bh);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(outer.x + 0.5, outer.y + 0.5, outer.w - 1, bh - 1);
    ctx.fillStyle = "rgba(148,163,184,0.75)";
    ctx.font = "11px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("舞台裏", outer.x + outer.w / 2, outer.y + bh / 2);
  }

  if (appearance.showShell && appearance.Smm > 0) {
    const sw = main.x - outer.x;
    ctx.fillStyle = "#111827";
    ctx.fillRect(outer.x, main.y, sw, main.h);
    ctx.fillRect(main.x + main.w, main.y, sw, main.h);
    ctx.fillStyle = "rgba(148,163,184,0.65)";
    ctx.font = "10px system-ui,sans-serif";
    ctx.save();
    ctx.translate(outer.x + sw / 2, main.y + main.h / 2);
    ctx.fillText("サイド", 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(main.x + main.w + sw / 2, main.y + main.h / 2);
    ctx.fillText("サイド", 0, 0);
    ctx.restore();
  }

  const grad = ctx.createLinearGradient(main.x, main.y, main.x, main.y + main.h);
  grad.addColorStop(0, "#0f1729");
  grad.addColorStop(0.42, "#0a0f18");
  grad.addColorStop(1, "#020617");
  ctx.fillStyle = grad;
  ctx.fillRect(main.x, main.y, main.w, main.h);

  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 2;
  ctx.strokeRect(main.x + 1, main.y + 1, main.w - 2, main.h - 2);
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 1;
  ctx.strokeRect(outer.x + 0.5, outer.y + 0.5, outer.w - 1, outer.h - 1);

  const bandH = Math.min(22, main.h * 0.08);
  ctx.fillStyle = "rgba(15,23,42,0.92)";
  ctx.fillRect(main.x, main.y + main.h - bandH, main.w, bandH);
  ctx.fillStyle = "rgba(226,232,240,0.85)";
  ctx.font = "bold 12px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("客席", main.x + main.w / 2, main.y + main.h - bandH / 2);
}

function drawGrid(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  appearance: StageExportAppearance,
  main: FloorRect
) {
  const cx = main.x + main.w / 2;
  ctx.strokeStyle = "rgba(251,191,36,0.92)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, main.y);
  ctx.lineTo(cx, main.y + main.h);
  ctx.stroke();

  if (!appearance.stepXPct || !appearance.stepYPct) return;

  const maxLines = 48;
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1;

  if (appearance.stageGridLinesVertical && appearance.stepXPct > 0) {
    for (let k = 1; k <= maxLines; k++) {
      const off = k * appearance.stepXPct;
      const r = 50 + off;
      const l = 50 - off;
      if (r <= 100) {
        const x = main.x + (r / 100) * main.w;
        ctx.beginPath();
        ctx.moveTo(x, main.y);
        ctx.lineTo(x, main.y + main.h);
        ctx.stroke();
      }
      if (l >= 0) {
        const x = main.x + (l / 100) * main.w;
        ctx.beginPath();
        ctx.moveTo(x, main.y);
        ctx.lineTo(x, main.y + main.h);
        ctx.stroke();
      }
      if (r > 100 && l < 0) break;
    }
  }

  if (appearance.stageGridLinesHorizontal && appearance.stepYPct > 0) {
    for (let k = 1; k <= maxLines; k++) {
      const off = k * appearance.stepYPct;
      const b = 50 + off;
      const t = 50 - off;
      if (b <= 100) {
        const y = main.y + (b / 100) * main.h;
        ctx.beginPath();
        ctx.moveTo(main.x, y);
        ctx.lineTo(main.x + main.w, y);
        ctx.stroke();
      }
      if (t >= 0) {
        const y = main.y + (t / 100) * main.h;
        ctx.beginPath();
        ctx.moveTo(main.x, y);
        ctx.lineTo(main.x + main.w, y);
        ctx.stroke();
      }
      if (b > 100 && t < 0) break;
    }
  }
}

function drawDancers(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  formation: ExportFormationFrame,
  main: FloorRect
) {
  const markerR = Math.max(10, Math.min(18, main.w * 0.028));

  formation.dancers.forEach((dancer, di) => {
    const x = main.x + dancer.x * main.w;
    const y = main.y + dancer.y * main.h;

    ctx.beginPath();
    ctx.arc(x, y, markerR, 0, Math.PI * 2);
    ctx.fillStyle = dancer.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const inner = dancer.name.trim() || String(di + 1);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(markerR * 0.85)}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(inner.slice(0, 3), x, y);

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "11px system-ui,sans-serif";
    ctx.fillText(dancer.name, x, y + markerR + 12);
  });
}

/** 舞台枠・グリッド・番号付きマーカーを canvas に描画（高速パス） */
export function drawStageExportFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  formations: ExportFormationFrame[],
  appearance: StageExportAppearance
) {
  const formation =
    [...formations].reverse().find((f) => f.startSec <= t) ?? formations[0];

  const { outer, main } = fitStageLayout(width, height, appearance);

  ctx.save();
  if (appearance.rotDeg !== 0) {
    const cx = outer.x + outer.w / 2;
    const cy = outer.y + outer.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((appearance.rotDeg * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  drawShellChrome(ctx, width, height, appearance, outer, main);
  drawGrid(ctx, appearance, main);
  if (formation) {
    drawDancers(ctx, formation, main);
  }

  ctx.restore();
}
