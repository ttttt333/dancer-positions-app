import { useEffect, useRef } from "react";
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

type Api = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  meshes: THREE.Mesh[];
  geom: THREE.SphereGeometry;
  planeGeom: THREE.PlaneGeometry;
  planeMat: THREE.MeshStandardMaterial;
};

type Props = {
  dancers: DancerSpot[];
  /** 2D ステージのダンサー印と揃えた見た目用（既定は projectDefaults と同じ） */
  markerDiameterPx?: number;
};

export function Stage3DView({
  dancers,
  markerDiameterPx = DEFAULT_DANCER_MARKER_DIAMETER_PX,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);

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
    controls.target.set(0, 0, 0);
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
    const geom = new THREE.SphereGeometry(0.28, 20, 20);
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
      geom,
      planeGeom,
      planeMat,
    };
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
      ro.disconnect();
      cancelAnimationFrame(raf);
      controls.dispose();
      meshes.forEach((m) => {
        (m.material as THREE.Material).dispose();
        scene.remove(m);
      });
      geom.dispose();
      planeGeom.dispose();
      planeMat.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const { scene, meshes } = api;
    meshes.forEach((m) => {
      (m.material as THREE.Material).dispose();
      scene.remove(m);
    });
    meshes.length = 0;
    const clampD = Math.max(
      MARKER_DIAMETER_PX_MIN,
      Math.min(MARKER_DIAMETER_PX_MAX, Math.round(markerDiameterPx))
    );
    const r0 =
      0.28 * (clampD / DEFAULT_DANCER_MARKER_DIAMETER_PX);
    api.geom.dispose();
    const geom = new THREE.SphereGeometry(r0, 20, 20);
    api.geom = geom;
    dancers.forEach((d) => {
      const mat = new THREE.MeshStandardMaterial({
        color: PALETTE[modDancerColorIndex(d.colorIndex)],
        roughness: 0.35,
        metalness: 0.12,
      });
      const m = new THREE.Mesh(geom, mat);
      m.position.set((d.xPct / 100) * 10 - 5, r0, (d.yPct / 100) * 7.5 - 3.75);
      scene.add(m);
      meshes.push(m);
    });
  }, [dancers, markerDiameterPx]);

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        minHeight: "280px",
        width: "100%",
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
        aria-label={`ステージ上 ${dancers.length} 人`}
        title="いまステージに表示している人数"
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
        {dancers.length}人
      </div>
    </div>
  );
}
