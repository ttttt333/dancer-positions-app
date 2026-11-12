/**
 * フローライブラリを端末に書き込む直前の形。
 * 名前・dancer id・色・並びは残し、一覧で再構成できる重複と、
 * タイムラインが引き伸ばせる波形ピークだけを縮める。
 */
import type { Cue, DancerSpot, Formation, SavedSpotLayout } from "../types/choreography";
import type {
  FlowCueSnapshot,
  FlowFormationSnapshot,
  FlowLibraryItem,
  FlowLibraryMemento,
} from "./flowLibrary";

/** 保存用ピーク本数。描画側は `refinePeaksForTimeline` で尺に合わせて引き伸ばす。 */
export const FLOW_LIBRARY_STORED_PEAKS_MAX = 4096;

const PCT_DECIMALS = 1000;

function roundPct(n: number): number {
  if (!Number.isFinite(n)) return n;
  return Math.round(n * PCT_DECIMALS) / PCT_DECIMALS;
}

function quantizePeak(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(1, Math.max(0, n)) * PCT_DECIMALS) / PCT_DECIMALS;
}

function bucketMax(src: number[], bins: number): number[] {
  const out = new Array<number>(bins);
  for (let i = 0; i < bins; i++) {
    const start = Math.floor((i / bins) * src.length);
    const end = Math.max(start + 1, Math.floor(((i + 1) / bins) * src.length));
    let peak = 0;
    for (let j = start; j < end; j++) {
      const v = src[j] ?? 0;
      if (v > peak) peak = v;
    }
    out[i] = peak;
  }
  return out;
}

/** 包絡（ビン内の最大）を残して保存本数まで落とす。短い列は量子化するだけ。 */
export function downsamplePeaksForStorage(
  peaks: number[] | null | undefined
): number[] | undefined {
  if (!peaks?.length) return undefined;
  const finite = peaks.filter((n) => typeof n === "number" && Number.isFinite(n));
  if (!finite.length) return undefined;
  const src =
    finite.length > FLOW_LIBRARY_STORED_PEAKS_MAX
      ? bucketMax(finite, FLOW_LIBRARY_STORED_PEAKS_MAX)
      : finite;
  return src.map(quantizePeak);
}

function compactDancerSpot(d: DancerSpot): DancerSpot {
  const next: DancerSpot = {
    ...d,
    xPct: roundPct(d.xPct),
    yPct: roundPct(d.yPct),
  };
  if (typeof d.centerDistanceLabelXPct === "number") {
    next.centerDistanceLabelXPct = roundPct(d.centerDistanceLabelXPct);
  }
  return next;
}

function compactPaths(
  paths: Record<string, { cpX: number; cpY: number }> | undefined
): Record<string, { cpX: number; cpY: number }> | undefined {
  if (!paths) return paths;
  const next: Record<string, { cpX: number; cpY: number }> = {};
  for (const [id, cp] of Object.entries(paths)) {
    next[id] = { cpX: roundPct(cp.cpX), cpY: roundPct(cp.cpY) };
  }
  return next;
}

function compactFormation(f: Formation): Formation {
  const { stageSnapshot: _stageSnapshot, ...rest } = f;
  return {
    ...rest,
    dancers: f.dancers.map(compactDancerSpot),
  };
}

function compactCue(c: Cue): Cue {
  const paths = compactPaths(c.dancerCustomPaths);
  if (!paths) return c;
  return { ...c, dancerCustomPaths: paths };
}

function compactLightFormation(f: FlowFormationSnapshot): FlowFormationSnapshot {
  return {
    ...f,
    dancers: f.dancers.map((d) => ({
      ...d,
      xPct: roundPct(d.xPct),
      yPct: roundPct(d.yPct),
    })),
  };
}

function compactLightCue(c: FlowCueSnapshot): FlowCueSnapshot {
  const paths = compactPaths(c.dancerCustomPaths);
  if (!paths) return c;
  return { ...c, dancerCustomPaths: paths };
}

function compactLayout(layout: SavedSpotLayout): SavedSpotLayout {
  return {
    ...layout,
    dancers: layout.dancers.map(compactDancerSpot),
  };
}

function compactMemento(m: FlowLibraryMemento | undefined): FlowLibraryMemento | undefined {
  if (!m) return m;
  const {
    flowEmbeddedAudioBase64: _b64,
    flowEmbeddedAudioMimeType: _mime,
    wavePeaks: _peaks,
    savedSpotLayouts,
    ...rest
  } = m;
  const peaks = downsamplePeaksForStorage(m.wavePeaks);
  return {
    ...rest,
    savedSpotLayouts: (savedSpotLayouts ?? []).map(compactLayout),
    ...(peaks ? { wavePeaks: peaks } : {}),
  };
}

/**
 * IndexedDB / フォールバックへ書く形。
 * `formationsFull` と `cuesFull` があるときは軽い複製を空にする。
 * 読み出し時の normalize が同じ一覧用スナップショットを組み直す。
 */
export function compactFlowLibraryItemForPersist(item: FlowLibraryItem): FlowLibraryItem {
  const memento = compactMemento(item.memento);
  const hasFull =
    (item.formationsFull?.length ?? 0) > 0 && (item.cuesFull?.length ?? 0) > 0;
  const next: FlowLibraryItem = {
    ...item,
    ...(memento ? { memento } : {}),
  };
  if (!memento) delete next.memento;
  if (!hasFull) {
    return {
      ...next,
      formations: item.formations.map(compactLightFormation),
      cues: item.cues.map(compactLightCue),
    };
  }
  return {
    ...next,
    formations: [],
    cues: [],
    formationsFull: item.formationsFull!.map(compactFormation),
    cuesFull: item.cuesFull!.map(compactCue),
  };
}

/** すでに保存されている生 JSON が、もう一度書き直す価値があるか。 */
export function rawFlowItemHasStorageWaste(raw: unknown): boolean {
  if (raw == null || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  const memento =
    o.memento != null && typeof o.memento === "object"
      ? (o.memento as Record<string, unknown>)
      : null;
  const peaks = memento?.wavePeaks;
  if (Array.isArray(peaks) && peaks.length > FLOW_LIBRARY_STORED_PEAKS_MAX) return true;
  if (
    typeof memento?.flowEmbeddedAudioBase64 === "string" &&
    memento.flowEmbeddedAudioBase64.length > 0
  ) {
    return true;
  }
  const hasFull =
    Array.isArray(o.formationsFull) &&
    o.formationsFull.length > 0 &&
    Array.isArray(o.cuesFull) &&
    o.cuesFull.length > 0;
  const hasLight =
    Array.isArray(o.formations) &&
    o.formations.length > 0 &&
    Array.isArray(o.cues) &&
    o.cues.length > 0;
  return hasFull && hasLight;
}
