import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { DancerSpot } from "../types/choreography";
import {
  DANCER_COLOR_PALETTE_THREE as PALETTE,
  modDancerColorIndex,
} from "../lib/dancerColorPalette";
import {
  DEFAULT_DANCER_MARKER_DIAMETER_PX,
  MARKER_DIAMETER_PX_MAX,
  MARKER_DIAMETER_PX_MIN,
} from "../lib/projectDefaults";

/** 身長未入力時の基準（cm）。入力済みの身長はこの値との比率で立体の高さを決める */
const DEFAULT_HEIGHT_CM = 170;
const BASE_FIGURE_HEIGHT = 1.65;

type Api = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  meshes: THREE.Mesh[];
  planeGeom: THREE.PlaneGeometry;
  planeMat: THREE.MeshStandardMaterial;
};

type Props = {
  dancers: DancerSpot[];
  /** 2D ステージのダンサー印と揃えた見た目用（既定は projectDefaults と同じ） */
  markerDiameterPx?: number;
};

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

export function Stage3DView({
  dancers,
  markerDiameterPx = DEFAULT_DANCER_MARKER_DIAMETER_PX,
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
    const planeGeom = new THREE.PlaneGeometry(10, 7.5);
    const planeMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
      metalness: 0.05,
    });
    const plane = new THREE.Mesh(planeGeom, planeMat);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);
    const meshes: THREE.Mesh[] = [];
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
    const { scene, meshes } = api;
    meshes.forEach((m) => {
      disposeMesh(m);
      scene.remove(m);
    });
    meshes.length = 0;
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
      m.position.set(
        (d.xPct / 100) * 10 - 5,
        totalH / 2,
        (d.yPct / 100) * 7.5 - 3.75
      );
      scene.add(m);
      meshes.push(m);
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
        aria-label={`ステージ上 ${dancers.length} 人（3D）`}
        title="いまステージに表示している人数（身長入力があれば高さに反映）"
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
