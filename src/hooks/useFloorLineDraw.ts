import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { Formation, StageFloorMarkup } from "../types/choreography";
import { generateId } from "../lib/generateId";
import { clamp, round2 } from "../lib/stageBoardModelHelpers";

export type FloorLineSession = {
  points: [number, number][];
  lastClientX: number;
  lastClientY: number;
} | null;

export type UseFloorLineDrawParams = {
  updateActiveFormation: (updater: (f: Formation) => Formation) => void;
  writeFormation: Formation | undefined;
  setPiecesEditable: boolean;
};

/**
 * 床のフリーハンド線ドラフトと確定（`StageBoardBody` の `beginFloorLineDraw` 相当）。
 */
export function useFloorLineDraw({
  updateActiveFormation,
  writeFormation,
  setPiecesEditable,
}: UseFloorLineDrawParams): {
  floorLineSessionRef: MutableRefObject<FloorLineSession>;
  floorLineDraft: [number, number][] | null;
  setFloorLineDraft: Dispatch<SetStateAction<[number, number][] | null>>;
  beginFloorLineDraw: (clientX: number, clientY: number, r: DOMRect) => void;
  resetFloorLineDraw: () => void;
} {
  const floorLineSessionRef = useRef<FloorLineSession>(null);
  const [floorLineDraft, setFloorLineDraft] = useState<
    [number, number][] | null
  >(null);

  const resetFloorLineDraw = useCallback(() => {
    floorLineSessionRef.current = null;
    setFloorLineDraft(null);
  }, []);

  const beginFloorLineDraw = useCallback(
    (clientX: number, clientY: number, r: DOMRect) => {
      if (!writeFormation || !setPiecesEditable) return;
      if (r.width <= 0 || r.height <= 0) return;
      const xPct = round2(clamp(((clientX - r.left) / r.width) * 100, 0, 100));
      const yPct = round2(clamp(((clientY - r.top) / r.height) * 100, 0, 100));
      const session = {
        points: [[xPct, yPct]] as [number, number][],
        lastClientX: clientX,
        lastClientY: clientY,
      };
      floorLineSessionRef.current = session;
      setFloorLineDraft([[xPct, yPct]]);
      const move = (ev: PointerEvent) => {
        const s = floorLineSessionRef.current;
        if (!s) return;
        const dx = ev.clientX - s.lastClientX;
        const dy = ev.clientY - s.lastClientY;
        if (Math.hypot(dx, dy) < 4) return;
        if (s.points.length >= 200) return;
        const nx = round2(
          clamp(((ev.clientX - r.left) / r.width) * 100, 0, 100),
        );
        const ny = round2(
          clamp(((ev.clientY - r.top) / r.height) * 100, 0, 100),
        );
        s.points.push([nx, ny]);
        s.lastClientX = ev.clientX;
        s.lastClientY = ev.clientY;
        setFloorLineDraft([...s.points]);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        const s = floorLineSessionRef.current;
        floorLineSessionRef.current = null;
        setFloorLineDraft(null);
        if (!s || s.points.length < 2) return;
        let len = 0;
        for (let i = 1; i < s.points.length; i++) {
          const a = s.points[i - 1]!;
          const b = s.points[i]!;
          len += Math.hypot(b[0] - a[0], b[1] - a[1]);
        }
        if (len < 0.35) return;
        const newLine: StageFloorMarkup = {
          kind: "line",
          id: generateId(),
          pointsPct: s.points,
          widthPx: 3,
          color: "#fbbf24",
        };
        updateActiveFormation((f) => ({
          ...f,
          floorMarkup: [...(f.floorMarkup ?? []), newLine],
        }));
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [writeFormation, setPiecesEditable, updateActiveFormation],
  );

  return {
    floorLineSessionRef,
    floorLineDraft,
    setFloorLineDraft,
    beginFloorLineDraw,
    resetFloorLineDraw,
  };
}
