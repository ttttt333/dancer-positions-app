import {
  useCallback,
  useRef,
  useState,
  type MutableRefObject,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import {
  applyRedoPlain,
  applyUndoPlain,
  clearEditorHistoryStacks,
  createEditorHistoryStacks,
  pushEditorHistorySnapshot,
  type EditorHistoryStacks,
} from "../pages/editor/editorHistoryStack";
import { HISTORY_CAP } from "../pages/editor/editorConstants";
import { observeEditorProjectChange } from "../lib/choreocore/engine/calibration/humanFeedbackCapture";

type YjsCollabHistory = {
  undo: () => void;
  redo: () => void;
  undoStackSize: number;
  redoStackSize: number;
  setProjectSafe: Dispatch<SetStateAction<ChoreographyProjectJson>>;
};

export type UseEditorHistoryOptions = {
  collabActive: boolean;
  yjsCollab: YjsCollabHistory;
  plainProject: ChoreographyProjectJson | null;
  setPlainProject: Dispatch<SetStateAction<ChoreographyProjectJson | null>>;
  projectForHistoryRef: MutableRefObject<ChoreographyProjectJson | null>;
};

/** undo/redo 直後の useEffect 同期が履歴を消費しないよう、数フレームは push を抑止 */
function scheduleEndApplyingHistory(ref: MutableRefObject<boolean>): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ref.current = false;
    });
  });
}

export function useEditorHistory({
  collabActive,
  yjsCollab,
  plainProject,
  setPlainProject,
  projectForHistoryRef,
}: UseEditorHistoryOptions) {
  const historyRef = useRef<EditorHistoryStacks>(createEditorHistoryStacks());
  const gestureHistoryDepthRef = useRef(0);
  const gestureHistoryBaselineRef = useRef<string | null>(null);
  const skipNextHistoryPushRef = useRef(false);
  const applyingHistoryRef = useRef(false);
  /**
   * ジェスチャ終了は setState を伴わず ref にだけ積むことがある。
   * 戻る／進むボタンの disabled を更新するため、スタック変化で再描画する。
   */
  const [historyStackTick, setHistoryStackTick] = useState(0);
  /** ステージ上の仮配置プレビューを Undo/Redo で捨てるための世代 */
  const [historyOverlayEpoch, setHistoryOverlayEpoch] = useState(0);

  const bumpHistoryStackUi = useCallback(() => {
    setHistoryStackTick((n) => n + 1);
  }, []);

  const clearHistory = useCallback(() => {
    clearEditorHistoryStacks(historyRef.current);
    gestureHistoryDepthRef.current = 0;
    gestureHistoryBaselineRef.current = null;
    skipNextHistoryPushRef.current = false;
    applyingHistoryRef.current = false;
    bumpHistoryStackUi();
  }, [bumpHistoryStackUi]);

  const cancelGestureHistory = useCallback(() => {
    gestureHistoryDepthRef.current = 0;
    gestureHistoryBaselineRef.current = null;
  }, []);

  const beginGestureHistory = useCallback(() => {
    if (collabActive) return;
    gestureHistoryDepthRef.current += 1;
    if (
      gestureHistoryDepthRef.current === 1 &&
      projectForHistoryRef.current != null
    ) {
      gestureHistoryBaselineRef.current = JSON.stringify(
        projectForHistoryRef.current
      );
    }
  }, [collabActive, projectForHistoryRef]);

  const endGestureHistory = useCallback(() => {
    if (collabActive) return;
    if (gestureHistoryDepthRef.current <= 0) {
      gestureHistoryDepthRef.current = 0;
      gestureHistoryBaselineRef.current = null;
      return;
    }
    gestureHistoryDepthRef.current -= 1;
    if (gestureHistoryDepthRef.current !== 0) return;
    const baseline = gestureHistoryBaselineRef.current;
    gestureHistoryBaselineRef.current = null;
    if (!baseline) return;
    const cur = projectForHistoryRef.current;
    if (!cur) return;
    let curStr: string;
    try {
      curStr = JSON.stringify(cur);
    } catch {
      return;
    }
    if (curStr === baseline) return;
    pushEditorHistorySnapshot(historyRef.current, baseline, HISTORY_CAP);
    observeEditorProjectChange(cur);
    // setProject なしで積むので、戻るボタンをここで有効化する
    bumpHistoryStackUi();
  }, [collabActive, projectForHistoryRef, bumpHistoryStackUi]);

  const markHistorySkipNextPush = useCallback(() => {
    skipNextHistoryPushRef.current = true;
  }, []);

  const setProjectSafePlain: Dispatch<SetStateAction<ChoreographyProjectJson>> =
    useCallback(
      (action) => {
        setPlainProject((prev) => {
          if (!prev) return prev;
          const next =
            typeof action === "function"
              ? (action as (p: ChoreographyProjectJson) => ChoreographyProjectJson)(
                  prev
                )
              : action;
          if (next === prev) return prev;
          let unchanged = false;
          try {
            unchanged = JSON.stringify(next) === JSON.stringify(prev);
          } catch {
            unchanged = false;
          }
          if (unchanged) return prev;
          if (applyingHistoryRef.current) {
            return next;
          }
          if (skipNextHistoryPushRef.current) {
            skipNextHistoryPushRef.current = false;
            return next;
          }
          if (gestureHistoryDepthRef.current > 0) {
            return next;
          }
          pushEditorHistorySnapshot(
            historyRef.current,
            JSON.stringify(prev),
            HISTORY_CAP
          );
          observeEditorProjectChange(next);
          return next;
        });
      },
      [setPlainProject]
    );

  const setProjectSafe: Dispatch<SetStateAction<ChoreographyProjectJson>> =
    collabActive ? yjsCollab.setProjectSafe : setProjectSafePlain;

  const resetOpenGesture = useCallback(() => {
    gestureHistoryDepthRef.current = 0;
    gestureHistoryBaselineRef.current = null;
  }, []);

  const undoPlain = useCallback(() => {
    if (historyRef.current.undo.length === 0) return;
    resetOpenGesture();
    applyingHistoryRef.current = true;
    setPlainProject((cur) => {
      if (!cur) return cur;
      const next = applyUndoPlain(historyRef.current, cur);
      return next ?? cur;
    });
    setHistoryOverlayEpoch((n) => n + 1);
    bumpHistoryStackUi();
    scheduleEndApplyingHistory(applyingHistoryRef);
  }, [setPlainProject, resetOpenGesture, bumpHistoryStackUi]);

  const redoPlain = useCallback(() => {
    if (historyRef.current.redo.length === 0) return;
    resetOpenGesture();
    applyingHistoryRef.current = true;
    setPlainProject((cur) => {
      if (!cur) return cur;
      const next = applyRedoPlain(historyRef.current, cur);
      return next ?? cur;
    });
    setHistoryOverlayEpoch((n) => n + 1);
    bumpHistoryStackUi();
    scheduleEndApplyingHistory(applyingHistoryRef);
  }, [setPlainProject, resetOpenGesture, bumpHistoryStackUi]);

  const undo = useCallback(() => {
    if (collabActive) {
      yjsCollab.undo();
      setHistoryOverlayEpoch((n) => n + 1);
    } else undoPlain();
  }, [collabActive, yjsCollab, undoPlain]);

  const redo = useCallback(() => {
    if (collabActive) {
      yjsCollab.redo();
      setHistoryOverlayEpoch((n) => n + 1);
    } else redoPlain();
  }, [collabActive, yjsCollab, redoPlain]);

  void historyStackTick;

  const isUndoDisabled =
    plainProject?.viewMode === "view" ||
    (collabActive
      ? yjsCollab.undoStackSize === 0
      : historyRef.current.undo.length === 0);

  const isRedoDisabled =
    plainProject?.viewMode === "view" ||
    (collabActive
      ? yjsCollab.redoStackSize === 0
      : historyRef.current.redo.length === 0);

  return {
    historyRef,
    clearHistory,
    cancelGestureHistory,
    beginGestureHistory,
    endGestureHistory,
    markHistorySkipNextPush,
    setProjectSafePlain,
    setProjectSafe,
    undo,
    redo,
    isUndoDisabled,
    isRedoDisabled,
    historyOverlayEpoch,
  };
}
