/* eslint-disable react-hooks/set-state-in-effect -- floorMarkupTool / writeFormation に追随するクリアは従来パターン */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import type {
  FloorTextPlaceSession,
  Formation,
  StageFloorMarkup,
  StageFloorTextMarkup,
} from "../types/choreography";
import type { FloorMarkupTool } from "../components/StageFloorMarkupFloatingToolbars";
import type {
  FloorTextDraftPayload,
  FloorTextMarkupBlockProps,
  FloorTextResizeDragPayload,
  FloorTextTapOrDragPayload,
} from "../components/FloorTextMarkupBlock";
import {
  EMPTY_FLOOR_TEXT_DRAFT,
  floorTextLayer,
  floorTextMarkupScale,
  round2,
  clamp,
} from "../lib/stageBoardModelHelpers";

export type UseFloorMarkupTextParams = {
  viewMode: "edit" | "view";
  setPiecesEditable: boolean;
  playbackOrPreview: boolean;
  previewDancers: boolean;
  floorTextPlaceSession: FloorTextPlaceSession | null;
  onFloorTextPlaceSessionChange:
    | ((s: FloorTextPlaceSession) => void)
    | undefined;
  viewportTextOverlayRoot: HTMLElement | null;
  floorMarkupTool: FloorMarkupTool;
  setFloorMarkupTool: Dispatch<SetStateAction<FloorMarkupTool>>;
  writeFormation: Formation | undefined;
  displayFloorMarkup: StageFloorMarkup[];
  updateActiveFormation: (updater: (f: Formation) => Formation) => void;
  /** 床テキスト右クリック — 親の `setStageContextMenu` 等をここで呼ぶ */
  onFloorTextContextMenu: (
    markupId: string,
    clientX: number,
    clientY: number,
  ) => void;
};

export function useFloorMarkupText({
  viewMode,
  setPiecesEditable,
  playbackOrPreview,
  previewDancers,
  floorTextPlaceSession,
  onFloorTextPlaceSessionChange,
  viewportTextOverlayRoot,
  floorMarkupTool,
  setFloorMarkupTool,
  writeFormation,
  displayFloorMarkup,
  updateActiveFormation,
  onFloorTextContextMenu,
}: UseFloorMarkupTextParams) {
  const floorMarkupTextDragRef = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    startXPct: number;
    startYPct: number;
    layer: "stage" | "screen";
  } | null>(null);

  const floorTextTapOrDragRef = useRef<FloorTextTapOrDragPayload | null>(null);
  const floorTextResizeDragRef = useRef<FloorTextResizeDragPayload | null>(
    null,
  );
  const floorTextPlaceDragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startXPct: number;
    startYPct: number;
    session: FloorTextPlaceSession;
  } | null>(null);

  const [floorTextDraft, setFloorTextDraft] = useState({
    ...EMPTY_FLOOR_TEXT_DRAFT,
  });
  const [floorTextEditId, setFloorTextEditId] = useState<string | null>(null);
  const [selectedFloorTextId, setSelectedFloorTextId] = useState<string | null>(
    null,
  );
  const [floorTextInlineRect, setFloorTextInlineRect] = useState<{
    id: string;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (floorMarkupTool !== "text") {
      setFloorTextEditId(null);
      setFloorTextInlineRect(null);
    }
  }, [floorMarkupTool]);

  useEffect(() => {
    if (!floorTextPlaceSession) return;
    setFloorMarkupTool(null);
    setFloorTextEditId(null);
    floorTextTapOrDragRef.current = null;
  }, [floorTextPlaceSession, setFloorMarkupTool]);

  useEffect(() => {
    const root = viewportTextOverlayRoot;
    const sess = floorTextPlaceSession;
    const onChange = onFloorTextPlaceSessionChange;
    if (!sess || !onChange || !root || !setPiecesEditable || !writeFormation)
      return;
    const onPointerDownCapture = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (!root.contains(t)) return;
      if (
        t.closest(
          "button, input, textarea, select, option, a[href], [role='dialog'], [role='menu'], [data-floor-text-place-preview], [data-floor-text-box], [data-floor-markup]",
        )
      )
        return;
      if (t.closest("[data-dancer-id], [data-set-piece-id]")) return;
      const r = root.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      e.preventDefault();
      const xPct = round2(
        clamp(((e.clientX - r.left) / r.width) * 100, 0, 100),
      );
      const yPct = round2(
        clamp(((e.clientY - r.top) / r.height) * 100, 0, 100),
      );
      onChange({ ...sess, xPct, yPct });
    };
    window.addEventListener("pointerdown", onPointerDownCapture, true);
    return () =>
      window.removeEventListener("pointerdown", onPointerDownCapture, true);
  }, [
    floorTextPlaceSession,
    onFloorTextPlaceSessionChange,
    viewportTextOverlayRoot,
    setPiecesEditable,
    writeFormation,
  ]);

  useEffect(() => {
    if (!floorTextEditId || !writeFormation) return;
    const fm = writeFormation.floorMarkup ?? [];
    if (!fm.some((x) => x.id === floorTextEditId && x.kind === "text")) {
      setFloorTextEditId(null);
      setFloorTextDraft({ ...EMPTY_FLOOR_TEXT_DRAFT });
    }
  }, [writeFormation, floorTextEditId]);

  useEffect(() => {
    if (!selectedFloorTextId || !writeFormation) return;
    const fm = writeFormation.floorMarkup ?? [];
    if (!fm.some((x) => x.id === selectedFloorTextId && x.kind === "text")) {
      setSelectedFloorTextId(null);
      setFloorTextInlineRect(null);
    }
  }, [writeFormation, selectedFloorTextId]);

  const removeFloorMarkupById = useCallback(
    (id: string) => {
      if (!writeFormation || !setPiecesEditable) return;
      updateActiveFormation((f) => ({
        ...f,
        floorMarkup: (f.floorMarkup ?? []).filter((x) => x.id !== id),
      }));
    },
    [writeFormation, setPiecesEditable, updateActiveFormation],
  );

  const handleFloorTextMarkupContextMenu = useCallback(
    (markupId: string, clientX: number, clientY: number) => {
      onFloorTextContextMenu(markupId, clientX, clientY);
    },
    [onFloorTextContextMenu],
  );

  const handleFloorTextSelectMarkupTool = useCallback(
    (markupId: string, draft: FloorTextDraftPayload) => {
      setFloorTextEditId(markupId);
      setSelectedFloorTextId(markupId);
      setFloorTextDraft(draft);
    },
    [],
  );

  const handleFloorTextDoubleClickInline = useCallback(
    (
      m: StageFloorTextMarkup,
      bounds: DOMRect,
      draft: FloorTextDraftPayload,
    ) => {
      setFloorTextInlineRect({
        id: m.id,
        left: bounds.left,
        top: bounds.top,
        width: Math.max(140, bounds.width),
        height: Math.max(40, bounds.height),
      });
      setFloorMarkupTool("text");
      setFloorTextEditId(m.id);
      setSelectedFloorTextId(m.id);
      setFloorTextDraft(draft);
    },
    [setFloorMarkupTool],
  );

  const handleFloorTextColorUpdate = useCallback(
    (id: string, color: string) => {
      updateActiveFormation((f) => ({
        ...f,
        floorMarkup: (f.floorMarkup ?? []).map((x) =>
          x.id === id && x.kind === "text" ? { ...x, color } : x,
        ),
      }));
    },
    [updateActiveFormation],
  );

  const handleFloorTextFontFamilyUpdate = useCallback(
    (id: string, fontFamily: string) => {
      updateActiveFormation((f) => ({
        ...f,
        floorMarkup: (f.floorMarkup ?? []).map((x) =>
          x.id === id && x.kind === "text" ? { ...x, fontFamily } : x,
        ),
      }));
    },
    [updateActiveFormation],
  );

  const floorTextMarkupSharedProps = useMemo(
    (): Omit<FloorTextMarkupBlockProps, "markup" | "coordLayer"> => ({
      viewMode,
      setPiecesEditable,
      playbackOrPreview,
      previewDancers,
      floorTextPlaceSession,
      floorMarkupTool,
      selectedFloorTextId,
      floorTextEditId,
      floorTextInlineRectId: floorTextInlineRect?.id,
      floorTextResizeDragRef,
      floorTextTapOrDragRef,
      onContextMenuFloorText: handleFloorTextMarkupContextMenu,
      onRemoveFloorMarkup: removeFloorMarkupById,
      onSelectTextMarkupTool: handleFloorTextSelectMarkupTool,
      onDoubleClickInlineEdit: handleFloorTextDoubleClickInline,
      onUpdateTextColor: handleFloorTextColorUpdate,
      onUpdateTextFontFamily: handleFloorTextFontFamilyUpdate,
    }),
    [
      viewMode,
      setPiecesEditable,
      playbackOrPreview,
      previewDancers,
      floorTextPlaceSession,
      floorMarkupTool,
      selectedFloorTextId,
      floorTextEditId,
      floorTextInlineRect?.id,
      handleFloorTextMarkupContextMenu,
      removeFloorMarkupById,
      handleFloorTextSelectMarkupTool,
      handleFloorTextDoubleClickInline,
      handleFloorTextColorUpdate,
      handleFloorTextFontFamilyUpdate,
    ],
  );

  const handleFloorTextPlacePreviewPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (!floorTextPlaceSession) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      floorTextPlaceDragRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startXPct: floorTextPlaceSession.xPct,
        startYPct: floorTextPlaceSession.yPct,
        session: { ...floorTextPlaceSession },
      };
    },
    [floorTextPlaceSession],
  );

  const screenFloorTexts = useMemo((): StageFloorTextMarkup[] => {
    const out: StageFloorTextMarkup[] = [];
    for (const m of displayFloorMarkup) {
      if (m.kind === "text" && floorTextLayer(m) === "screen") out.push(m);
    }
    return out;
  }, [displayFloorMarkup]);

  const floorTextInlineMarkupScale = useMemo(() => {
    const id = floorTextInlineRect?.id;
    if (!id) return 1;
    const mk = displayFloorMarkup.find(
      (x): x is StageFloorTextMarkup => x.kind === "text" && x.id === id,
    );
    return mk ? floorTextMarkupScale(mk) : 1;
  }, [displayFloorMarkup, floorTextInlineRect?.id]);

  const resetFloorTextInteraction = useCallback(() => {
    floorMarkupTextDragRef.current = null;
    floorTextTapOrDragRef.current = null;
    floorTextPlaceDragRef.current = null;
    floorTextResizeDragRef.current = null;
    setFloorTextDraft({ ...EMPTY_FLOOR_TEXT_DRAFT });
    setFloorTextEditId(null);
    setSelectedFloorTextId(null);
    setFloorTextInlineRect(null);
  }, []);

  return {
    floorMarkupTextDragRef,
    floorTextTapOrDragRef,
    floorTextResizeDragRef,
    floorTextPlaceDragRef,
    floorTextDraft,
    setFloorTextDraft,
    floorTextEditId,
    setFloorTextEditId,
    selectedFloorTextId,
    setSelectedFloorTextId,
    floorTextInlineRect,
    setFloorTextInlineRect,
    removeFloorMarkupById,
    /** `removeFloorMarkupById` と同一（床テキスト削除 API 名用） */
    handleFloorTextMarkupDelete: removeFloorMarkupById,
    handleFloorTextMarkupContextMenu,
    handleFloorTextSelectMarkupTool,
    handleFloorTextDoubleClickInline,
    handleFloorTextColorUpdate,
    handleFloorTextFontFamilyUpdate,
    handleFloorTextPlacePreviewPointerDown,
    floorTextMarkupSharedProps,
    floorTextInlineMarkupScale,
    screenFloorTexts,
    resetFloorTextInteraction,
  };
}
