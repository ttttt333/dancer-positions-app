import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { AudienceEdge, DancerSpot } from "../types/choreography";
import {
  DANCER_COLOR_PALETTE_THREE as PALETTE,
  modDancerColorIndex,
} from "../lib/dancerColorPalette";
import {
  DEFAULT_DANCER_MARKER_DIAMETER_PX,
  MARKER_DIAMETER_PX_MAX,
  MARKER_DIAMETER_PX_MIN,
  clampStageGridAxisMm,
} from "../lib/projectDefaults";

/** 身長未入力時の基準（cm）。入力済みの身長はこの値との比率で立体の高さを決める */
const DEFAULT_HEIGHT_CM = 170;
const BASE_FIGURE_HEIGHT = 1.65;

/** 2D メイン床 % と同じ対応のステージ寸法（ワールド単位） */
const STAGE_W = 10;
const STAGE_D = 7.5;
/** 床との z-fighting 回避 */
const MARK_Y = 0.02;
/** 客席／舞台裏ラベルを床外に出す距離 */
const EDGE_LABEL_OUTSET = 0.55;
const EDGE_BAND_DEPTH = 0.38;

type Api = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  meshes: THREE.Mesh[];
  nameLabels: THREE.Sprite[];
  marksGroup: THREE.Group;
  planeGeom: THREE.PlaneGeometry;
  planeMat: THREE.MeshStandardMaterial;
};

export type Stage3DFloorMarks = {
  stageWidthMm?: number | null;
  stageDepthMm?: number | null;
  /** センターからの場ミリ間隔（mm）。未設定なら場ミリ線は出さない */
  centerFieldGuideIntervalMm?: number | null;
  stageGridLinesVertical?: boolean;
  stageGridLinesHorizontal?: boolean;
  stageGridSpacingWidthMm?: number | null;
  stageGridSpacingDepthMm?: number | null;
  stageGridLineSpacingMm?: number | null;
  /**
   * 客席辺。bottom＝手前(+z / yPct100)、top＝奥(-z / yPct0)。
   * 視点トグル反映後の実効値を渡す。
   */
  audienceEdge?: AudienceEdge;
};

type Props = {
  dancers: DancerSpot[];
  /** 2D ステージのダンサー印と揃えた見た目用（既定は projectDefaults と同じ） */
  markerDiameterPx?: number;
} & Stage3DFloorMarks;

function resolveHeightCm(d: DancerSpot): number {
  if (typeof d.heightCm === "number" && Number.isFinite(d.heightCm) && d.heightCm > 0) {
    return d.heightCm;
  }
  return DEFAULT_HEIGHT_CM;
}

function disposeMesh(mesh: THREE.Mesh) {
  mesh.geometry.dispose();
  const mat = mesh.material;
  if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
  else (mat as THREE.Material).dispose();
}

function disposeSprite(sprite: THREE.Sprite) {
  const mat = sprite.material as THREE.SpriteMaterial;
  mat.map?.dispose();
  mat.dispose();
}

/** 3D 頭上表示用に名前を短くする（長いと重なる） */
function formatDancerNameLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.length <= 8) return t;
  return `${t.slice(0, 7)}…`;
}

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Sprite) {
      const mat = child.material as THREE.SpriteMaterial;
      mat.map?.dispose();
      mat.dispose();
      return;
    }
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else (mat as THREE.Material | undefined)?.dispose();
    }
  });
}

function pctToX(xp: number): number {
  return (xp / 100) * STAGE_W - STAGE_W / 2;
}

function pctToZ(yp: number): number {
  return (yp / 100) * STAGE_D - STAGE_D / 2;
}

function makeLine(
  points: THREE.Vector3[],
  color: number,
  opacity: number,
  dashed: boolean,
  dashSize = 0.12,
  gapSize = 0.1
): THREE.Line {
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const mat = dashed
    ? new THREE.LineDashedMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        dashSize,
        gapSize,
        depthWrite: false,
      })
    : new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: false,
      });
  const line = new THREE.Line(geom, mat);
  if (dashed) line.computeLineDistances();
  return line;
}

function vertLine(xp: number): THREE.Vector3[] {
  return [
    new THREE.Vector3(pctToX(xp), MARK_Y, pctToZ(0)),
    new THREE.Vector3(pctToX(xp), MARK_Y, pctToZ(100)),
  ];
}

function horizLine(yp: number): THREE.Vector3[] {
  return [
    new THREE.Vector3(pctToX(0), MARK_Y, pctToZ(yp)),
    new THREE.Vector3(pctToX(100), MARK_Y, pctToZ(yp)),
  ];
}

/** カメラ向きに常に正対する文字スプライト */
function makeTextSprite(
  text: string,
  opts: {
    color?: string;
    bg?: string;
    fontPx?: number;
    worldHeight?: number;
    paddingX?: number;
    paddingY?: number;
  } = {}
): THREE.Sprite {
  const fontPx = opts.fontPx ?? 56;
  const padX = opts.paddingX ?? 22;
  const padY = opts.paddingY ?? 14;
  const color = opts.color ?? "#fef3c7";
  const bg = opts.bg ?? "rgba(15, 23, 42, 0.88)";
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const empty = new THREE.Sprite(
      new THREE.SpriteMaterial({ color: 0xfbbf24, opacity: 0.01, transparent: true })
    );
    empty.scale.set(0.01, 0.01, 1);
    return empty;
  }
  ctx.font = `700 ${fontPx}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const textW = Math.ceil(ctx.measureText(text).width);
  canvas.width = Math.max(32, textW + padX * 2);
  canvas.height = fontPx + padY * 2;
  ctx.font = `700 ${fontPx}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillStyle = bg;
  const r = Math.min(18, canvas.height / 2);
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(canvas.width, 0, canvas.width, canvas.height, r);
  ctx.arcTo(canvas.width, canvas.height, 0, canvas.height, r);
  ctx.arcTo(0, canvas.height, 0, 0, r);
  ctx.arcTo(0, 0, canvas.width, 0, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  const worldH = opts.worldHeight ?? 0.48;
  sprite.scale.set(worldH * (canvas.width / canvas.height), worldH, 1);
  return sprite;
}

/** 2D `guideLineDrawMarks` と同じ：センターから等間隔の縦場ミリ線 */
function buildBamiriXpMarks(
  intervalMm: number,
  stageWidthMm: number
): { xp: number; k: number }[] {
  if (!(intervalMm > 0) || !(stageWidthMm > 0)) return [];
  const half = stageWidthMm / 2;
  const marks: { xp: number; k: number }[] = [];
  let k = 1;
  const maxPairs = 200;
  while (k * intervalMm <= half + 1e-9 && k <= maxPairs) {
    const deltaPct = ((k * intervalMm) / stageWidthMm) * 100;
    marks.push({ xp: Math.min(100, Math.max(0, 50 - deltaPct)), k });
    marks.push({ xp: Math.min(100, Math.max(0, 50 + deltaPct)), k });
    k++;
  }
  return marks;
}

function clearMarksGroup(group: THREE.Group) {
  while (group.children.length > 0) {
    const child = group.children[0]!;
    group.remove(child);
    disposeObject3D(child);
  }
}

function addFloorEdgeBand(
  group: THREE.Group,
  zCenter: number,
  color: number,
  opacity: number
) {
  const geom = new THREE.PlaneGeometry(STAGE_W * 0.995, EDGE_BAND_DEPTH);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, MARK_Y + 0.004, zCenter);
  group.add(mesh);
}

function rebuildFloorMarks(group: THREE.Group, marks: Stage3DFloorMarks | undefined) {
  clearMarksGroup(group);

  const audienceEdge: AudienceEdge =
    marks?.audienceEdge === "top" ? "top" : "bottom";
  /** bottom＝客席が yPct100(+z)、top＝客席が yPct0(-z) */
  const audienceZ = audienceEdge === "bottom" ? pctToZ(100) : pctToZ(0);
  const backstageZ = audienceEdge === "bottom" ? pctToZ(0) : pctToZ(100);
  const audienceOutZ =
    audienceEdge === "bottom"
      ? audienceZ + EDGE_LABEL_OUTSET
      : audienceZ - EDGE_LABEL_OUTSET;
  const backstageOutZ =
    audienceEdge === "bottom"
      ? backstageZ - EDGE_LABEL_OUTSET
      : backstageZ + EDGE_LABEL_OUTSET;
  const audienceBandZ =
    audienceEdge === "bottom"
      ? audienceZ - EDGE_BAND_DEPTH / 2 + 0.02
      : audienceZ + EDGE_BAND_DEPTH / 2 - 0.02;
  const backstageBandZ =
    audienceEdge === "bottom"
      ? backstageZ + EDGE_BAND_DEPTH / 2 - 0.02
      : backstageZ - EDGE_BAND_DEPTH / 2 + 0.02;

  // 床外枠
  group.add(
    makeLine(
      [
        new THREE.Vector3(pctToX(0), MARK_Y, pctToZ(0)),
        new THREE.Vector3(pctToX(100), MARK_Y, pctToZ(0)),
        new THREE.Vector3(pctToX(100), MARK_Y, pctToZ(100)),
        new THREE.Vector3(pctToX(0), MARK_Y, pctToZ(100)),
        new THREE.Vector3(pctToX(0), MARK_Y, pctToZ(0)),
      ],
      0x64748b,
      0.85,
      false
    )
  );

  // 客席／舞台裏の色帯（回転しても辺が分かる）
  addFloorEdgeBand(group, audienceBandZ, 0x0e7490, 0.42);
  addFloorEdgeBand(group, backstageBandZ, 0x334155, 0.5);

  // センター十字（縦＝2Dの黄金線、横＝奥行の中央）
  group.add(makeLine(vertLine(50), 0xfbbf24, 0.95, false));
  group.add(makeLine(horizLine(50), 0xfbbf24, 0.55, false));

  // センター点（小さなリング）
  const ringGeom = new THREE.RingGeometry(0.08, 0.14, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, MARK_Y + 0.001, 0);
  group.add(ring);

  const audienceLabel = makeTextSprite("客席", {
    color: "#e0f2fe",
    bg: "rgba(14, 116, 144, 0.92)",
    worldHeight: 0.52,
  });
  audienceLabel.position.set(0, 0.28, audienceOutZ);
  group.add(audienceLabel);

  const backstageLabel = makeTextSprite("舞台裏", {
    color: "#e2e8f0",
    bg: "rgba(51, 65, 85, 0.92)",
    worldHeight: 0.52,
  });
  backstageLabel.position.set(0, 0.28, backstageOutZ);
  group.add(backstageLabel);

  const W =
    typeof marks?.stageWidthMm === "number" && marks.stageWidthMm > 0
      ? marks.stageWidthMm
      : null;
  const D =
    typeof marks?.stageDepthMm === "number" && marks.stageDepthMm > 0
      ? marks.stageDepthMm
      : null;
  const guideMm =
    typeof marks?.centerFieldGuideIntervalMm === "number" &&
    marks.centerFieldGuideIntervalMm > 0
      ? marks.centerFieldGuideIntervalMm
      : null;

  if (W != null && guideMm != null) {
    const bamiriMarks = buildBamiriXpMarks(guideMm, W);
    for (const { xp, k } of bamiriMarks) {
      if (Math.abs(xp - 50) < 0.02) continue;
      group.add(makeLine(vertLine(xp), 0xfbbf24, 0.72, true, 0.14, 0.12));
      const num = makeTextSprite(String(k), {
        color: "#fef3c7",
        bg: "rgba(15, 23, 42, 0.9)",
        fontPx: 52,
        worldHeight: 0.36,
        paddingX: 16,
        paddingY: 10,
      });
      num.position.set(pctToX(xp), 0.22, audienceOutZ);
      group.add(num);
    }
  }

  const showV = marks?.stageGridLinesVertical === true;
  const showH = marks?.stageGridLinesHorizontal === true;
  if (W != null && D != null && (showV || showH)) {
    const legacy =
      typeof marks?.stageGridLineSpacingMm === "number" &&
      Number.isFinite(marks.stageGridLineSpacingMm)
        ? marks.stageGridLineSpacingMm
        : 10;
    const spacingW = clampStageGridAxisMm(marks?.stageGridSpacingWidthMm, legacy);
    const spacingD = clampStageGridAxisMm(marks?.stageGridSpacingDepthMm, legacy);
    const stepXPct = (spacingW / W) * 100;
    const stepYPct = (spacingD / D) * 100;
    const MAX = 80;
    if (showV && stepXPct > 0 && Number.isFinite(stepXPct)) {
      for (let k = 1; k <= MAX; k++) {
        const r = 50 + k * stepXPct;
        const l = 50 - k * stepXPct;
        if (r > 100 + 1e-6 && l < -1e-6) break;
        if (r <= 100 + 1e-6 && Math.abs(r - 50) > 0.02) {
          group.add(makeLine(vertLine(Math.min(100, r)), 0x475569, 0.45, false));
        }
        if (l >= -1e-6 && Math.abs(l - 50) > 0.02) {
          group.add(makeLine(vertLine(Math.max(0, l)), 0x475569, 0.45, false));
        }
      }
    }
    if (showH && stepYPct > 0 && Number.isFinite(stepYPct)) {
      for (let k = 1; k <= MAX; k++) {
        const b = 50 + k * stepYPct;
        const t = 50 - k * stepYPct;
        if (b > 100 + 1e-6 && t < -1e-6) break;
        if (b <= 100 + 1e-6 && Math.abs(b - 50) > 0.02) {
          group.add(makeLine(horizLine(Math.min(100, b)), 0x475569, 0.45, false));
        }
        if (t >= -1e-6 && Math.abs(t - 50) > 0.02) {
          group.add(makeLine(horizLine(Math.max(0, t)), 0x475569, 0.45, false));
        }
      }
    }
  }
}

export function Stage3DView({
  dancers,
  markerDiameterPx = DEFAULT_DANCER_MARKER_DIAMETER_PX,
  stageWidthMm = null,
  stageDepthMm = null,
  centerFieldGuideIntervalMm = null,
  stageGridLinesVertical = false,
  stageGridLinesHorizontal = false,
  stageGridSpacingWidthMm = null,
  stageGridSpacingDepthMm = null,
  stageGridLineSpacingMm = null,
  audienceEdge = "bottom",
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const w = Math.max(el.clientWidth, 200);
    const h = Math.max(el.clientHeight, 240);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(0, 14, 11);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 6;
    controls.maxDistance = 42;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.target.set(0, 0.4, 0);
    const dl = new THREE.DirectionalLight(0xffffff, 0.95);
    dl.position.set(3, 18, 8);
    scene.add(dl);
    scene.add(new THREE.AmbientLight(0x64748b, 0.5));
    const planeGeom = new THREE.PlaneGeometry(STAGE_W, STAGE_D);
    const planeMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
      metalness: 0.05,
    });
    const plane = new THREE.Mesh(planeGeom, planeMat);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);
    const marksGroup = new THREE.Group();
    scene.add(marksGroup);
    const meshes: THREE.Mesh[] = [];
    const nameLabels: THREE.Sprite[] = [];
    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    apiRef.current = {
      scene,
      camera,
      renderer,
      controls,
      meshes,
      nameLabels,
      marksGroup,
      planeGeom,
      planeMat,
    };
    setSceneReady(true);
    const ro = new ResizeObserver(() => {
      const rw = el.clientWidth;
      const rh = el.clientHeight;
      if (rw < 10 || rh < 10) return;
      renderer.setSize(rw, rh);
      camera.aspect = rw / rh;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);
    return () => {
      setSceneReady(false);
      ro.disconnect();
      cancelAnimationFrame(raf);
      controls.dispose();
      meshes.forEach((m) => {
        disposeMesh(m);
        scene.remove(m);
      });
      nameLabels.forEach((s) => {
        disposeSprite(s);
        scene.remove(s);
      });
      clearMarksGroup(marksGroup);
      scene.remove(marksGroup);
      planeGeom.dispose();
      planeMat.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !sceneReady) return;
    rebuildFloorMarks(api.marksGroup, {
      stageWidthMm,
      stageDepthMm,
      centerFieldGuideIntervalMm,
      stageGridLinesVertical,
      stageGridLinesHorizontal,
      stageGridSpacingWidthMm,
      stageGridSpacingDepthMm,
      stageGridLineSpacingMm,
      audienceEdge,
    });
  }, [
    sceneReady,
    stageWidthMm,
    stageDepthMm,
    centerFieldGuideIntervalMm,
    stageGridLinesVertical,
    stageGridLinesHorizontal,
    stageGridSpacingWidthMm,
    stageGridSpacingDepthMm,
    stageGridLineSpacingMm,
    audienceEdge,
  ]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !sceneReady) return;
    const { scene, meshes, nameLabels } = api;
    meshes.forEach((m) => {
      disposeMesh(m);
      scene.remove(m);
    });
    meshes.length = 0;
    nameLabels.forEach((s) => {
      disposeSprite(s);
      scene.remove(s);
    });
    nameLabels.length = 0;
    const clampD = Math.max(
      MARKER_DIAMETER_PX_MIN,
      Math.min(MARKER_DIAMETER_PX_MAX, Math.round(markerDiameterPx))
    );
    const sizeScale = clampD / DEFAULT_DANCER_MARKER_DIAMETER_PX;
    dancers.forEach((d) => {
      const heightCm = resolveHeightCm(d);
      const totalH = BASE_FIGURE_HEIGHT * (heightCm / DEFAULT_HEIGHT_CM);
      const radius = Math.min(0.28 * sizeScale, Math.max(0.1, totalH * 0.14));
      const cylLen = Math.max(0.04, totalH - 2 * radius);
      const geom = new THREE.CapsuleGeometry(radius, cylLen, 4, 10);
      const mat = new THREE.MeshStandardMaterial({
        color: PALETTE[modDancerColorIndex(d.colorIndex)],
        roughness: 0.35,
        metalness: 0.12,
      });
      const m = new THREE.Mesh(geom, mat);
      const x = pctToX(d.xPct);
      const z = pctToZ(d.yPct);
      m.position.set(x, totalH / 2, z);
      scene.add(m);
      meshes.push(m);

      const nameText = formatDancerNameLabel(d.label ?? "");
      if (nameText) {
        const label = makeTextSprite(nameText, {
          color: "#f8fafc",
          bg: "rgba(15, 23, 42, 0.9)",
          fontPx: 48,
          worldHeight: 0.34,
          paddingX: 14,
          paddingY: 10,
        });
        label.position.set(x, totalH + 0.28, z);
        scene.add(label);
        nameLabels.push(label);
      }
    });
  }, [dancers, markerDiameterPx, sceneReady]);

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        minHeight: "280px",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        ref={mountRef}
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          width: "100%",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid #334155",
        }}
      />
      <div
        aria-live="polite"
        aria-label={`ステージ上 ${dancers.length} 人（3D）。客席と舞台裏のラベルあり`}
        title="金色線＝センター／場ミリ。数字はセンターからの場ミリ番号。色帯＝客席／舞台裏"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 2,
          pointerEvents: "none",
          padding: "4px 9px",
          borderRadius: "8px",
          border: "1px solid rgba(51, 65, 85, 0.95)",
          background: "rgba(15, 23, 42, 0.88)",
          color: "#e2e8f0",
          fontSize: "12px",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.2,
          boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
        }}
      >
        {dancers.length}人 · 3D
      </div>
    </div>
  );
}
