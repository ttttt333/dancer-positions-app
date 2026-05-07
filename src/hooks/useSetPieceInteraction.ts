import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import type { Formation, SetPiece } from "../types/choreography";
import type { StageBoardContextMenuState } from "../components/StageBoardContextMenuLayer";
import {
  applySetPieceResizePct,
  clamp,
  getSetPieceCoordRoot,
  MIN_SET_PIECE_H_PCT,
  MIN_SET_PIECE_W_PCT,
  round2,
  setPieceRotationDegDisplay,
  type SetPieceResizeHandle,
} from "../lib/stageBoardModelHelpers";

export type SetPieceDragSession =
  | {
      mode: "move";
      pieceId: string;
      offsetXPx: number;
      offsetYPx: number;
    }
  | {
      mode: "resize";
      pieceId: string;
      handle: SetPieceResizeHandle;
      start: { xPct: number; yPct: number; wPct: number; hPct: number };
      startClientX: number;
      startClientY: number;
      floorWpx: number;
      floorHpx: number;
    }
  | {
      mode: "rotate";
      pieceId: string;
      startRotationDeg: number;
      startPointerRad: number;
      centerClientX: number;
      centerClientY: number;
    }
  | null;

export type UseSetPieceInteractionParams = {
  viewMode: "edit" | "view";
  stageInteractionsEnabled: boolean;
  setPiecesEditable: boolean;
  writeFormation: Formation | undefined;
  snapGrid: boolean;
  gridStep: number;
  mmSnapGrid: { stepXPct: number; stepYPct: number } | null | undefined;
  stageMainFloorRef: RefObject<HTMLDivElement | null>;
  viewportTextOverlayRoot: HTMLElement | null;
  updateActiveFormation: (
    updater: (f: Formation) => Formation,
  ) => void;
  pointerToPctInRoot: (
    rootEl: HTMLElement,
    clientX: number,
    clientY: number,
    shiftKey: boolean,
    snapHorizontalCenter50mm?: boolean,
  ) => { xPct: number; yPct: number } | null;
  onSetPieceContextMenu: Dispatch<
    SetStateAction<StageBoardContextMenuState>
  >;
};

export function useSetPieceInteraction({
  viewMode,
  stageInteractionsEnabled,
  setPiecesEditable,
  writeFormation,
  snapGrid,
  gridStep,
  mmSnapGrid,
  stageMainFloorRef,
  viewportTextOverlayRoot,
  updateActiveFormation,
  pointerToPctInRoot,
  onSetPieceContextMenu,
}: UseSetPieceInteractionParams) {
  const setPieceDragRef = useRef<SetPieceDragSession>(null);
  const [selectedSetPieceId, setSelectedSetPieceId] = useState<string | null>(
    null,
  );

  const removeSetPieceById = useCallback(
    (pieceId: string) => {
      if (
        !writeFormation ||
        viewMode === "view" ||
        stageInteractionsEnabled === false
      )
        return;
      updateActiveFormation((f) => ({
        ...f,
        setPieces: (f.setPieces ?? []).filter((x) => x.id !== pieceId),
      }));
      setSelectedSetPieceId((id) => (id === pieceId ? null : id));
      onSetPieceContextMenu(null);
    },
    [
      writeFormation,
      updateActiveFormation,
      viewMode,
      stageInteractionsEnabled,
      onSetPieceContextMenu,
    ],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = setPieceDragRef.current;
      if (!d) return;
      if (d.mode === "move") {
        const piece = writeFormation?.setPieces?.find(
          (x) => x.id === d.pieceId,
        );
        const root = piece
          ? getSetPieceCoordRoot(
              piece,
              stageMainFloorRef.current,
              viewportTextOverlayRoot,
            )
          : stageMainFloorRef.current;
        if (!root) return;
        const next = pointerToPctInRoot(
          root,
          e.clientX - d.offsetXPx,
          e.clientY - d.offsetYPx,
          e.shiftKey,
        );
        if (!next) return;
        updateActiveFormation((f) => {
          const pieces = [...(f.setPieces ?? [])];
          const idx = pieces.findIndex((x) => x.id === d.pieceId);
          if (idx < 0) return f;
          const p = pieces[idx];
          const nx = clamp(next.xPct, 0, 100 - p.wPct);
          const ny = clamp(next.yPct, 0, 100 - p.hPct);
          pieces[idx] = { ...p, xPct: round2(nx), yPct: round2(ny) };
          return { ...f, setPieces: pieces };
        });
        return;
      }
      if (d.mode === "rotate") {
        const ang = Math.atan2(
          e.clientY - d.centerClientY,
          e.clientX - d.centerClientX,
        );
        const deltaDeg = ((ang - d.startPointerRad) * 180) / Math.PI;
        let rawRot = d.startRotationDeg + deltaDeg;
        if (e.shiftKey) {
          const step = 15;
          rawRot = Math.round(rawRot / step) * step;
        }
        updateActiveFormation((f) => {
          const pieces = [...(f.setPieces ?? [])];
          const idx = pieces.findIndex((x) => x.id === d.pieceId);
          if (idx < 0) return f;
          const p = pieces[idx];
          pieces[idx] = { ...p, rotationDeg: round2(rawRot) };
          return { ...f, setPieces: pieces };
        });
        return;
      }
      const dxPct = ((e.clientX - d.startClientX) / d.floorWpx) * 100;
      const dyPct = ((e.clientY - d.startClientY) / d.floorHpx) * 100;
      const snapDim = (axis: "x" | "y", v: number) => {
        let c = clamp(v, 0, 100);
        if (!snapGrid) return round2(c);
        if (mmSnapGrid) {
          const base = axis === "x" ? mmSnapGrid.stepXPct : mmSnapGrid.stepYPct;
          const step = e.shiftKey ? Math.max(0.05, base / 4) : base;
          c = clamp(Math.round(c / step) * step, 0, 100);
          return round2(c);
        }
        const step = e.shiftKey ? Math.max(0.25, gridStep / 4) : gridStep;
        c = clamp(Math.round(c / step) * step, 0, 100);
        return round2(c);
      };
      const raw = applySetPieceResizePct(
        d.handle,
        d.start.xPct,
        d.start.yPct,
        d.start.wPct,
        d.start.hPct,
        dxPct,
        dyPct,
      );
      let xPct = snapDim("x", raw.xPct);
      let yPct = snapDim("y", raw.yPct);
      let wPct = snapDim("x", raw.wPct);
      let hPct = snapDim("y", raw.hPct);
      wPct = Math.max(MIN_SET_PIECE_W_PCT, Math.min(wPct, 100 - xPct));
      hPct = Math.max(MIN_SET_PIECE_H_PCT, Math.min(hPct, 100 - yPct));
      xPct = clamp(xPct, 0, 100 - wPct);
      yPct = clamp(yPct, 0, 100 - hPct);
      updateActiveFormation((f) => {
        const pieces = [...(f.setPieces ?? [])];
        const idx = pieces.findIndex((x) => x.id === d.pieceId);
        if (idx < 0) return f;
        const p = pieces[idx];
        pieces[idx] = {
          ...p,
          xPct,
          yPct,
          wPct,
          hPct,
        };
        return { ...f, setPieces: pieces };
      });
    };
    const onUp = () => {
      setPieceDragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [
    pointerToPctInRoot,
    snapGrid,
    gridStep,
    updateActiveFormation,
    mmSnapGrid,
    writeFormation?.setPieces,
    viewportTextOverlayRoot,
    stageMainFloorRef,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)
        return;
      if (t instanceof HTMLElement && t.isContentEditable) return;
      if (!selectedSetPieceId || !setPiecesEditable) return;
      e.preventDefault();
      removeSetPieceById(selectedSetPieceId);
      setSelectedSetPieceId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedSetPieceId, setPiecesEditable, removeSetPieceById]);

  const handlePointerDownSetPiece = useCallback(
    (e: ReactPointerEvent, piece: SetPiece) => {
      if (e.button !== 0) return;
      if (!setPiecesEditable) return;
      setSelectedSetPieceId(piece.id);
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const el = getSetPieceCoordRoot(
        piece,
        stageMainFloorRef.current,
        viewportTextOverlayRoot,
      );
      if (!el) return;
      const r = el.getBoundingClientRect();
      const leftPx = r.left + (piece.xPct / 100) * r.width;
      const topPx = r.top + (piece.yPct / 100) * r.height;
      setPieceDragRef.current = {
        mode: "move",
        pieceId: piece.id,
        offsetXPx: e.clientX - leftPx,
        offsetYPx: e.clientY - topPx,
      };
    },
    [setPiecesEditable, stageMainFloorRef, viewportTextOverlayRoot],
  );

  const handlePointerDownSetPieceResize = useCallback(
    (e: ReactPointerEvent, piece: SetPiece, handle: SetPieceResizeHandle) => {
      if (e.button !== 0) return;
      if (!setPiecesEditable) return;
      e.stopPropagation();
      e.preventDefault();
      setSelectedSetPieceId(piece.id);
      const el = getSetPieceCoordRoot(
        piece,
        stageMainFloorRef.current,
        viewportTextOverlayRoot,
      );
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPieceDragRef.current = {
        mode: "resize",
        pieceId: piece.id,
        handle,
        start: {
          xPct: piece.xPct,
          yPct: piece.yPct,
          wPct: piece.wPct,
          hPct: piece.hPct,
        },
        startClientX: e.clientX,
        startClientY: e.clientY,
        floorWpx: r.width,
        floorHpx: r.height,
      };
    },
    [setPiecesEditable, stageMainFloorRef, viewportTextOverlayRoot],
  );

  const handlePointerDownSetPieceRotate = useCallback(
    (e: ReactPointerEvent, piece: SetPiece) => {
      if (e.button !== 0) return;
      if (!setPiecesEditable) return;
      e.stopPropagation();
      e.preventDefault();
      setSelectedSetPieceId(piece.id);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const el = getSetPieceCoordRoot(
        piece,
        stageMainFloorRef.current,
        viewportTextOverlayRoot,
      );
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + ((piece.xPct + piece.wPct / 2) / 100) * r.width;
      const cy = r.top + ((piece.yPct + piece.hPct / 2) / 100) * r.height;
      const startPointerRad = Math.atan2(e.clientY - cy, e.clientX - cx);
      setPieceDragRef.current = {
        mode: "rotate",
        pieceId: piece.id,
        startRotationDeg: setPieceRotationDegDisplay(piece),
        startPointerRad,
        centerClientX: cx,
        centerClientY: cy,
      };
    },
    [setPiecesEditable, stageMainFloorRef, viewportTextOverlayRoot],
  );

  const handleSetPieceBodyContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>, piece: SetPiece) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedSetPieceId(piece.id);
      onSetPieceContextMenu({
        kind: "setPiece",
        clientX: e.clientX,
        clientY: e.clientY,
        pieceId: piece.id,
      });
    },
    [onSetPieceContextMenu],
  );

  const handleSetPieceToggleInterpolate = useCallback(
    (p: SetPiece) => {
      updateActiveFormation((f) => ({
        ...f,
        setPieces: (f.setPieces ?? []).map((x) =>
          x.id === p.id ? { ...x, interpolateInGaps: !x.interpolateInGaps } : x,
        ),
      }));
    },
    [updateActiveFormation],
  );

  const resetSetPieceInteraction = useCallback(() => {
    setPieceDragRef.current = null;
    setSelectedSetPieceId(null);
  }, []);

  return {
    selectedSetPieceId,
    setSelectedSetPieceId,
    removeSetPieceById,
    handlePointerDownSetPiece,
    handlePointerDownSetPieceResize,
    handlePointerDownSetPieceRotate,
    handleSetPieceBodyContextMenu,
    handleSetPieceToggleInterpolate,
    resetSetPieceInteraction,
  };
}
