import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
} from "react";
import { StageAudienceFooterBand } from "./StageAudienceFooterBand";
import type { StageFloorMarkupToolbarHostProps } from "./StageFloorMarkupToolbarHost";
import { StageFloorMarkupToolbarHost } from "./StageFloorMarkupToolbarHost";
import type { StageMainFloorBaseOverlaysProps } from "./StageMainFloorBaseOverlays";
import { StageMainFloorBaseOverlays } from "./StageMainFloorBaseOverlays";
import { StageMainFloorGridCell } from "./StageMainFloorGridCell";
import type { StageMainFloorInteractionLayerProps } from "./StageMainFloorInteractionLayer";
import { StageMainFloorInteractionLayer } from "./StageMainFloorInteractionLayer";
import { StageMainFloorPanel } from "./StageMainFloorPanel";
import { StageShellGridLayout } from "./StageShellGridLayout";
import { stopPlaybackAtTrimStart } from "../lib/playbackTransport";
import { shell } from "../theme/choreoShell";

export type StageShellDimsInput = {
  showShell: boolean;
  Bmm: number;
  Dmm: number;
  Wmm: number;
  Smm: number;
  rotationDeg: number;
  labelScreenKeepUpright: (origin: string) => CSSProperties;
};

export type StageShellWithMainFloorProps = {
  shellDims: StageShellDimsInput;
  stageMainFloorRef: RefObject<HTMLDivElement | null>;
  isPlaying: boolean;
  /** 再生中の床クリックで停止するときのトリム左端（秒） */
  trimStartSec: number;
  onPointerDownFloor: (e: ReactPointerEvent<HTMLDivElement>) => void;
  mainFloorStyle: CSSProperties;
  floorMarkupToolbar?: StageFloorMarkupToolbarHostProps;
  /** 最背面レイヤー：大道具をここに置きBaseOverlays/InteractionLayerより下に描画 */
  setPieceElements?: ReactNode;
  baseOverlays: StageMainFloorBaseOverlaysProps;
  interaction: StageMainFloorInteractionLayerProps;
  /** 動線矢印SVGオーバーレイ（ダンサー印の上に重ねる） */
  motionArrowsOverlay?: ReactNode;
};

/**
 * シェル付きグリッドの中央にメイン床（ツールバー・下層オーバーレイ・操作層）と客席帯を載せる。
 */
export function StageShellWithMainFloor({
  shellDims,
  stageMainFloorRef,
  isPlaying,
  trimStartSec,
  onPointerDownFloor,
  mainFloorStyle,
  floorMarkupToolbar,
  setPieceElements,
  baseOverlays,
  interaction,
  motionArrowsOverlay,
}: StageShellWithMainFloorProps) {
  const {
    showShell,
    Bmm,
    Dmm,
    Wmm,
    Smm,
    rotationDeg,
    labelScreenKeepUpright,
  } = shellDims;

  return (
    <StageShellGridLayout
      showShell={showShell}
      Bmm={Bmm}
      Dmm={Dmm}
      Wmm={Wmm}
      Smm={Smm}
      labelScreenKeepUpright={labelScreenKeepUpright}
      center={
        <StageMainFloorGridCell
          cellStyle={{
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            position: "relative",
            ...(showShell
              ? {
                  gridColumn: Smm > 0 ? 2 : 1,
                  gridRow: Bmm > 0 ? 2 : 1,
                  ...(Smm === 0 && Bmm > 0 ? { gridColumn: "1 / -1" } : {}),
                }
              : { position: "relative", width: "100%", height: "100%" }),
          }}
          showShell={showShell}
          stageBackDepthMm={Bmm}
          labelScreenKeepUpright={labelScreenKeepUpright}
          floor={
            <StageMainFloorPanel
              ref={stageMainFloorRef}
              onPointerDownCapture={(e) => {
                if (!isPlaying || e.button !== 0) return;
                const el = e.target as HTMLElement;
                if (el.closest("button")) return;
                e.preventDefault();
                stopPlaybackAtTrimStart(trimStartSec);
              }}
              onPointerDown={onPointerDownFloor}
              style={{
                ...mainFloorStyle,
                flex: "1 1 0%",
                minHeight: 0,
                position: "relative",
                width: "100%",
                borderRadius: "14px",
                border: `1.5px solid ${shell.ruby}`,
                background: showShell
                  ? (mainFloorStyle.background as string)
                  : "transparent",
              }}
            >
              {floorMarkupToolbar ? (
                <StageFloorMarkupToolbarHost {...floorMarkupToolbar} />
              ) : null}
              {/* 大道具は必ず最背面（BaseOverlays・InteractionLayerより前のDOM） */}
              {setPieceElements}
              <StageMainFloorBaseOverlays {...baseOverlays} />
              <StageMainFloorInteractionLayer {...interaction} />
              {motionArrowsOverlay}
            </StageMainFloorPanel>
          }
          footer={
            <StageAudienceFooterBand
              guideLineMarks={baseOverlays.guideLineDrawMarks}
              centerFrontDotColor={shell.ruby}
              centerFrontRingColor={shell.bgDeep}
              audienceCaptionColor={shell.textMuted}
              audienceTop={((rotationDeg % 360) + 360) % 360 === 180}
              // 180°反転時も帯の箱を枠内に保つ。bottom基準だとスマホで外へ押し出される。
              wrapperStyle={labelScreenKeepUpright("center center")}
            />
          }
        />
      }
    />
  );
}
