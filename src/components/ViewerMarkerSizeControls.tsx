import {
  clampViewerMarkerScale,
  clampViewerNameScale,
  stepViewerScale,
  VIEWER_MARKER_SCALE_STEPS,
  VIEWER_NAME_SCALE_STEPS,
} from "../lib/viewerMarkerDisplay";
import { useViewerChromeStore } from "../store/viewerChromeStore";

type Props = {
  layout?: "inline" | "stack";
  /** 下部バー向けのコンパクト表示（狭い幅でも収まらせる） */
  compact?: boolean;
};

/**
 * 生徒閲覧: 印・名前の表示サイズと、名前の自動フィット。
 */
export function ViewerMarkerSizeControls({
  layout = "inline",
  compact = false,
}: Props) {
  const markerDisplayScale = useViewerChromeStore((s) => s.markerDisplayScale);
  const nameLabelScale = useViewerChromeStore((s) => s.nameLabelScale);
  const autoNameFit = useViewerChromeStore((s) => s.autoNameFit);
  const setMarkerDisplayScale = useViewerChromeStore(
    (s) => s.setMarkerDisplayScale
  );
  const setNameLabelScale = useViewerChromeStore((s) => s.setNameLabelScale);
  const setAutoNameFit = useViewerChromeStore((s) => s.setAutoNameFit);

  const stack = layout === "stack";

  return (
    <div
      className={[
        "choreo-viewer-marker-size",
        stack ? "choreo-viewer-marker-size--stack" : "",
        compact ? "choreo-viewer-marker-size--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label="立ち位置の表示サイズ"
    >
      <div className="choreo-viewer-marker-size__row">
        <span className="choreo-viewer-marker-size__label">印</span>
        <button
          type="button"
          className="choreo-viewer-marker-size__btn"
          aria-label="印を小さく"
          onClick={() =>
            setMarkerDisplayScale(
              clampViewerMarkerScale(
                stepViewerScale(
                  markerDisplayScale,
                  VIEWER_MARKER_SCALE_STEPS,
                  -1
                )
              )
            )
          }
        >
          −
        </button>
        <button
          type="button"
          className="choreo-viewer-marker-size__btn"
          aria-label="印を大きく"
          onClick={() =>
            setMarkerDisplayScale(
              clampViewerMarkerScale(
                stepViewerScale(
                  markerDisplayScale,
                  VIEWER_MARKER_SCALE_STEPS,
                  1
                )
              )
            )
          }
        >
          ＋
        </button>
      </div>
      <div className="choreo-viewer-marker-size__row">
        <span className="choreo-viewer-marker-size__label">名</span>
        <button
          type="button"
          className="choreo-viewer-marker-size__btn"
          aria-label="名前を小さく"
          onClick={() => {
            setAutoNameFit(false);
            setNameLabelScale(
              clampViewerNameScale(
                stepViewerScale(nameLabelScale, VIEWER_NAME_SCALE_STEPS, -1)
              )
            );
          }}
        >
          −
        </button>
        <button
          type="button"
          className="choreo-viewer-marker-size__btn"
          aria-label="名前を大きく"
          onClick={() => {
            setAutoNameFit(false);
            setNameLabelScale(
              clampViewerNameScale(
                stepViewerScale(nameLabelScale, VIEWER_NAME_SCALE_STEPS, 1)
              )
            );
          }}
        >
          ＋
        </button>
      </div>
      <button
        type="button"
        className={
          autoNameFit
            ? "choreo-viewer-marker-size__auto choreo-viewer-marker-size__auto--on"
            : "choreo-viewer-marker-size__auto"
        }
        aria-pressed={autoNameFit}
        title="名前が重ならないよう自動で調整"
        onClick={() => {
          const next = !autoNameFit;
          setAutoNameFit(next);
          if (next) setNameLabelScale(1);
        }}
      >
        自動
      </button>
    </div>
  );
}
