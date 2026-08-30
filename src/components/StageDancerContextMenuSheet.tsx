import { useEffect, useMemo, useState } from "react";
import { EditorSideSheet } from "./EditorSideSheet";
import {
  BULK_EDIT_TABS,
  StageDancerBulkEditPanel,
  type BulkEditTabId,
} from "./StageDancerBulkEditPanel";
import type { StageDancerContextMenuProps } from "./StageDancerContextMenu";
import {
  clusterSelectionColumns,
  formatSelectionColumnSummary,
  getSelectionSwapAxis,
  swapSelectionColumnsDepth,
  swapSelectionKamiteShimote,
} from "../lib/stageColumnSwap";
import { resolveArrangeTargetIds } from "../lib/stageSelectionArrange";

export type StageDancerContextMenuSheetProps = {
  open: boolean;
  onClose: () => void;
  anchorDancerId: string;
} & Omit<StageDancerContextMenuProps, "anchorDancerId" | "onCloseMenu" | "presentation">;

/** 範囲選択後の緑ボタンから開く、タブ分割の一括操作パネル */
export function StageDancerContextMenuSheet({
  open,
  onClose,
  anchorDancerId,
  ...menuProps
}: StageDancerContextMenuSheetProps) {
  const [tab, setTab] = useState<BulkEditTabId>("sort");
  useEffect(() => {
    if (open) setTab("sort");
  }, [open]);
  const arrangeTargetIds = useMemo(
    () => resolveArrangeTargetIds(anchorDancerId, menuProps.selectedDancerIds),
    [anchorDancerId, menuProps.selectedDancerIds]
  );
  const selectionColumns = useMemo(() => {
    try {
      return clusterSelectionColumns(menuProps.formationDancers, arrangeTargetIds);
    } catch (err) {
      console.error("[StageDancerContextMenuSheet] column detection failed", err);
      return [];
    }
  }, [menuProps.formationDancers, arrangeTargetIds]);
  const selectionSwapAxis = useMemo(
    () => getSelectionSwapAxis(menuProps.formationDancers, arrangeTargetIds),
    [menuProps.formationDancers, arrangeTargetIds]
  );
  const selectionColumnSummary = useMemo(
    () =>
      formatSelectionColumnSummary(
        menuProps.formationDancers,
        arrangeTargetIds,
        selectionSwapAxis
      ),
    [menuProps.formationDancers, arrangeTargetIds, selectionSwapAxis]
  );

  const runColumnDepthSwap = (colA: number, colB: number) => {
    if (arrangeTargetIds.length < 2) {
      window.alert("列の前後交代は、対象を 2 人以上選んでください。");
      onClose();
      return;
    }
    if (selectionColumns.length < 2) {
      window.alert("列を判定できませんでした。範囲を広げるか、横位置が分かれるように並べてください。");
      onClose();
      return;
    }
    menuProps.applyDancerArrange((dancers, targetIds) =>
      swapSelectionColumnsDepth(dancers, targetIds, colA, colB)
    );
  };

  const runKamiteShimoteSwap = () => {
    if (arrangeTargetIds.length < 2) {
      window.alert("上手・下手の交代は、対象を 2 人以上選んでください。");
      onClose();
      return;
    }
    menuProps.applyDancerArrange(swapSelectionKamiteShimote);
  };

  return (
    <EditorSideSheet
      open={open}
      onClose={onClose}
      zIndex={10001}
      width="min(400px, 94vw)"
      ariaLabelledBy="stage-dancer-menu-sheet-title"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100%",
          color: "#e2e8f0",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: "14px 16px 10px",
            borderBottom: "1px solid #334155",
            background: "#07090f",
          }}
        >
          <h2
            id="stage-dancer-menu-sheet-title"
            style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}
          >
            選択した立ち位置
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "13px",
              color: "#e2e8f0",
              lineHeight: 1.45,
              fontWeight: 600,
            }}
          >
            {arrangeTargetIds.length} 人を選択中
          </p>
          {selectionColumnSummary ? (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "12px",
                color: "#94a3b8",
                lineHeight: 1.45,
              }}
            >
              {selectionColumnSummary}
            </p>
          ) : null}
          <div
            role="tablist"
            aria-label="一括編集"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 6,
              marginTop: 12,
            }}
          >
            {BULK_EDIT_TABS.map((item) => {
              const on = item.id === tab;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(item.id)}
                  style={{
                    padding: "8px 4px",
                    borderRadius: 8,
                    border: on ? "1px solid rgba(212,175,55,0.65)" : "1px solid #334155",
                    background: on ? "rgba(212,175,55,0.14)" : "#020617",
                    color: on ? "#f5e6a8" : "#94a3b8",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        <div
          className="stage-dancer-menu-sheet-body"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "12px 14px 20px",
          }}
        >
          <StageDancerBulkEditPanel
            anchorDancerId={anchorDancerId}
            onCloseMenu={onClose}
            selectionColumnCount={selectionColumns.length}
            selectionColumnSummary={selectionColumnSummary}
            selectionSwapAxis={selectionSwapAxis}
            runColumnDepthSwap={runColumnDepthSwap}
            runKamiteShimoteSwap={runKamiteShimoteSwap}
            tab={tab}
            {...menuProps}
          />
        </div>
      </div>
    </EditorSideSheet>
  );
}
