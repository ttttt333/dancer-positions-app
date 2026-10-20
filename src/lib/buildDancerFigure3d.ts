import * as THREE from "three";
import type { DancerFigure3dId } from "./dancerFigure3d";

type MatOpts = {
  color: number;
  roughness?: number;
  metalness?: number;
};

function mat(opts: MatOpts): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: opts.color,
    roughness: opts.roughness ?? 0.42,
    metalness: opts.metalness ?? 0.06,
  });
}

function mesh(
  geom: THREE.BufferGeometry,
  material: THREE.MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1
): THREE.Mesh {
  const m = new THREE.Mesh(geom, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function tint(base: number, factor: number): number {
  const r = Math.min(255, Math.round(((base >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((base >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((base & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

/**
 * 高さ `totalH` のフィギュア（足元 y=0、頭上が totalH）。
 * グループごと disposeObject3D で解放する。
 */
export function buildDancerFigure3d(
  kind: DancerFigure3dId,
  totalH: number,
  color: number
): THREE.Group {
  const g = new THREE.Group();
  const H = Math.max(0.35, totalH);
  const body = mat({ color, roughness: 0.48 });
  const dark = mat({ color: tint(color, 0.68), roughness: 0.55 });
  const light = mat({ color: tint(color, 1.16), roughness: 0.4 });
  const accent = mat({ color: tint(color, 0.5), roughness: 0.5 });
  const cream = mat({ color: 0xf5e6d3, roughness: 0.55 });
  const black = mat({ color: 0x1e293b, roughness: 0.65 });
  const white = mat({ color: 0xf8fafc, roughness: 0.45 });
  const gold = mat({ color: 0xfbbf24, roughness: 0.35, metalness: 0.25 });

  switch (kind) {
    case "human":
      buildHuman(g, H, body, dark, light);
      break;
    case "dog":
      buildDog(g, H, body, dark, light, cream);
      break;
    case "cat":
      buildCat(g, H, body, dark, light);
      break;
    case "rabbit":
      buildRabbit(g, H, body, dark, light, cream);
      break;
    case "bird":
      buildBird(g, H, body, dark, light, accent);
      break;
    case "kirin":
      buildKirin(g, H, body, dark, light, gold);
      break;
    case "elephant":
      buildElephant(g, H, body, dark, light, cream);
      break;
    case "lion":
      buildLion(g, H, body, dark, light, accent);
      break;
    case "tiger":
      buildTiger(g, H, body, dark, light, black);
      break;
    case "penguin":
      buildPenguin(g, H, body, dark, white, cream, black);
      break;
    case "bear":
      buildBear(g, H, body, dark, light, cream);
      break;
    default:
      buildHuman(g, H, body, dark, light);
  }

  return g;
}

function buildHuman(
  g: THREE.Group,
  H: number,
  body: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  light: THREE.MeshStandardMaterial
) {
  const headR = H * 0.115;
  const torsoH = H * 0.36;
  const legH = H * 0.34;
  const armH = H * 0.3;
  const waistY = legH;
  const shoulderY = waistY + torsoH;
  const headY = shoulderY + headR * 1.08;

  g.add(
    mesh(
      new THREE.CapsuleGeometry(H * 0.052, Math.max(0.02, legH - H * 0.1), 4, 10),
      dark,
      -H * 0.055,
      legH / 2,
      0
    )
  );
  g.add(
    mesh(
      new THREE.CapsuleGeometry(H * 0.052, Math.max(0.02, legH - H * 0.1), 4, 10),
      dark,
      H * 0.055,
      legH / 2,
      0
    )
  );
  g.add(
    mesh(
      new THREE.CapsuleGeometry(H * 0.095, Math.max(0.04, torsoH - H * 0.18), 5, 12),
      body,
      0,
      waistY + torsoH / 2,
      0
    )
  );
  g.add(
    mesh(
      new THREE.CapsuleGeometry(H * 0.038, Math.max(0.02, armH - H * 0.08), 4, 8),
      body,
      -H * 0.155,
      shoulderY - armH * 0.32,
      0
    )
  );
  g.add(
    mesh(
      new THREE.CapsuleGeometry(H * 0.038, Math.max(0.02, armH - H * 0.08), 4, 8),
      body,
      H * 0.155,
      shoulderY - armH * 0.32,
      0
    )
  );
  g.add(mesh(new THREE.SphereGeometry(headR, 16, 12), light, 0, headY, 0));
}

function addQuadLegs(
  g: THREE.Group,
  dark: THREE.MeshStandardMaterial,
  H: number,
  bodyY: number,
  footZ: number,
  footX: number,
  legR = H * 0.042
) {
  const legH = bodyY * 0.88;
  for (const [sx, sz] of [
    [-footX, footZ],
    [footX, footZ],
    [-footX, -footZ],
    [footX, -footZ],
  ] as const) {
    g.add(
      mesh(
        new THREE.CapsuleGeometry(legR, Math.max(0.02, legH - legR * 2), 4, 8),
        dark,
        sx,
        legH / 2,
        sz
      )
    );
  }
}

function buildDog(
  g: THREE.Group,
  H: number,
  body: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  light: THREE.MeshStandardMaterial,
  cream: THREE.MeshStandardMaterial
) {
  const bodyLen = H * 0.58;
  const bodyH = H * 0.26;
  const bodyY = H * 0.3;

  g.add(
    mesh(
      new THREE.CapsuleGeometry(bodyH * 0.48, Math.max(0.05, bodyLen - bodyH), 6, 12),
      body,
      0,
      bodyY,
      0,
      1,
      1,
      1.05
    )
  );
  addQuadLegs(g, dark, H, bodyY, bodyLen * 0.28, H * 0.11);

  const headY = bodyY + bodyH * 0.22;
  const headZ = bodyLen * 0.42;
  const headR = H * 0.13;
  g.add(mesh(new THREE.SphereGeometry(headR, 14, 12), light, 0, headY, headZ));
  g.add(
    mesh(
      new THREE.SphereGeometry(headR * 0.42, 10, 8),
      cream,
      0,
      headY - headR * 0.12,
      headZ + headR * 0.78,
      1.15,
      0.75,
      1.2
    )
  );
  // floppy ears
  for (const sx of [-1, 1]) {
    const ear = mesh(
      new THREE.SphereGeometry(headR * 0.38, 10, 8),
      dark,
      sx * headR * 0.78,
      headY - headR * 0.05,
      headZ - headR * 0.05,
      0.55,
      1.35,
      0.45
    );
    ear.rotation.z = sx * 0.55;
    g.add(ear);
  }
  // curled tail
  const tail = mesh(
    new THREE.CapsuleGeometry(H * 0.028, H * 0.2, 4, 8),
    dark,
    0,
    bodyY + bodyH * 0.35,
    -bodyLen * 0.4
  );
  tail.rotation.x = -0.85;
  g.add(tail);
}

function buildCat(
  g: THREE.Group,
  H: number,
  body: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  light: THREE.MeshStandardMaterial
) {
  const bodyLen = H * 0.5;
  const bodyH = H * 0.24;
  const bodyY = H * 0.28;

  g.add(
    mesh(
      new THREE.CapsuleGeometry(bodyH * 0.45, Math.max(0.04, bodyLen - bodyH * 0.85), 6, 12),
      body,
      0,
      bodyY,
      0,
      1,
      1,
      1.1
    )
  );
  addQuadLegs(g, dark, H, bodyY, bodyLen * 0.26, H * 0.1, H * 0.035);

  const headY = bodyY + bodyH * 0.35;
  const headZ = bodyLen * 0.4;
  const headR = H * 0.125;
  g.add(mesh(new THREE.SphereGeometry(headR, 14, 12), light, 0, headY, headZ));
  // pointy ears
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(
      new THREE.ConeGeometry(headR * 0.32, headR * 0.62, 7),
      body
    );
    ear.position.set(sx * headR * 0.62, headY + headR * 0.72, headZ);
    ear.castShadow = true;
    g.add(ear);
  }
  // small snout
  g.add(
    mesh(
      new THREE.SphereGeometry(headR * 0.28, 8, 6),
      dark,
      0,
      headY - headR * 0.15,
      headZ + headR * 0.7,
      1.1,
      0.7,
      0.9
    )
  );
  // curved tail
  const tail = mesh(
    new THREE.CapsuleGeometry(H * 0.025, H * 0.32, 4, 8),
    dark,
    0,
    bodyY + bodyH * 0.25,
    -bodyLen * 0.38
  );
  tail.rotation.x = 1.05;
  g.add(tail);
}

function buildRabbit(
  g: THREE.Group,
  H: number,
  body: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  light: THREE.MeshStandardMaterial,
  cream: THREE.MeshStandardMaterial
) {
  const bodyY = H * 0.32;
  g.add(
    mesh(
      new THREE.SphereGeometry(H * 0.18, 14, 12),
      body,
      0,
      bodyY,
      0,
      1.05,
      1.2,
      1.15
    )
  );
  // hind / front legs (sitting-ish)
  for (const [sx, sz, sy] of [
    [-H * 0.1, H * 0.08, H * 0.12],
    [H * 0.1, H * 0.08, H * 0.12],
    [-H * 0.08, -H * 0.1, H * 0.1],
    [H * 0.08, -H * 0.1, H * 0.1],
  ] as const) {
    g.add(
      mesh(
        new THREE.CapsuleGeometry(H * 0.035, sy, 4, 8),
        dark,
        sx,
        sy / 2,
        sz
      )
    );
  }

  const headY = bodyY + H * 0.22;
  const headR = H * 0.13;
  g.add(mesh(new THREE.SphereGeometry(headR, 14, 12), light, 0, headY, H * 0.06));
  // long ears
  for (const sx of [-1, 1]) {
    const ear = mesh(
      new THREE.CapsuleGeometry(H * 0.035, H * 0.28, 4, 8),
      body,
      sx * headR * 0.45,
      headY + H * 0.22,
      H * 0.04,
      0.85,
      1,
      0.55
    );
    ear.rotation.z = sx * 0.12;
    g.add(ear);
    g.add(
      mesh(
        new THREE.CapsuleGeometry(H * 0.018, H * 0.2, 3, 6),
        cream,
        sx * headR * 0.45,
        headY + H * 0.2,
        H * 0.055,
        0.7,
        1,
        0.4
      )
    );
  }
  // puff tail
  g.add(
    mesh(
      new THREE.SphereGeometry(H * 0.055, 10, 8),
      cream,
      0,
      bodyY,
      -H * 0.18
    )
  );
}

function buildBird(
  g: THREE.Group,
  H: number,
  body: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  light: THREE.MeshStandardMaterial,
  accent: THREE.MeshStandardMaterial
) {
  const bodyY = H * 0.4;
  g.add(
    mesh(
      new THREE.SphereGeometry(H * 0.17, 14, 12),
      body,
      0,
      bodyY,
      0,
      1,
      1.2,
      1.35
    )
  );
  g.add(
    mesh(
      new THREE.SphereGeometry(H * 0.11, 12, 10),
      light,
      0,
      bodyY + H * 0.2,
      H * 0.06
    )
  );
  const beak = new THREE.Mesh(new THREE.ConeGeometry(H * 0.035, H * 0.1, 7), accent);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, bodyY + H * 0.18, H * 0.18);
  beak.castShadow = true;
  g.add(beak);

  for (const sx of [-1, 1]) {
    const wing = mesh(
      new THREE.SphereGeometry(H * 0.11, 10, 8),
      dark,
      sx * H * 0.15,
      bodyY + H * 0.02,
      0,
      0.32,
      0.95,
      1.45
    );
    wing.rotation.z = sx * 0.4;
    g.add(wing);
  }

  for (const sx of [-H * 0.045, H * 0.045]) {
    g.add(
      mesh(
        new THREE.CapsuleGeometry(H * 0.018, H * 0.14, 3, 6),
        accent,
        sx,
        H * 0.14,
        0
      )
    );
  }

  const tail = new THREE.Mesh(new THREE.ConeGeometry(H * 0.07, H * 0.18, 7), dark);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, bodyY + H * 0.02, -H * 0.22);
  g.add(tail);
}

function buildKirin(
  g: THREE.Group,
  H: number,
  body: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  light: THREE.MeshStandardMaterial,
  gold: THREE.MeshStandardMaterial
) {
  const bodyY = H * 0.42;
  // elongated deer-like body
  g.add(
    mesh(
      new THREE.CapsuleGeometry(H * 0.12, H * 0.28, 6, 12),
      body,
      0,
      bodyY,
      0,
      1,
      1,
      1.35
    )
  );
  addQuadLegs(g, dark, H, bodyY * 0.85, H * 0.16, H * 0.1, H * 0.038);

  // long neck
  const neck = mesh(
    new THREE.CapsuleGeometry(H * 0.05, H * 0.22, 5, 10),
    body,
    0,
    bodyY + H * 0.2,
    H * 0.18
  );
  neck.rotation.x = -0.55;
  g.add(neck);

  const headY = bodyY + H * 0.38;
  const headZ = H * 0.28;
  g.add(mesh(new THREE.SphereGeometry(H * 0.09, 12, 10), light, 0, headY, headZ, 1.1, 0.9, 1.25));

  // horns / antlers
  for (const sx of [-1, 1]) {
    const horn = mesh(
      new THREE.ConeGeometry(H * 0.02, H * 0.14, 6),
      gold,
      sx * H * 0.04,
      headY + H * 0.1,
      headZ - H * 0.02
    );
    horn.rotation.z = sx * 0.2;
    g.add(horn);
  }
  // mane tuft
  g.add(
    mesh(
      new THREE.SphereGeometry(H * 0.06, 10, 8),
      gold,
      0,
      headY + H * 0.02,
      headZ - H * 0.08,
      0.7,
      1.2,
      0.8
    )
  );
  // tail flame
  const tail = mesh(
    new THREE.ConeGeometry(H * 0.05, H * 0.16, 6),
    gold,
    0,
    bodyY + H * 0.05,
    -H * 0.28
  );
  tail.rotation.x = Math.PI / 2;
  g.add(tail);
}

function buildElephant(
  g: THREE.Group,
  H: number,
  body: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  light: THREE.MeshStandardMaterial,
  cream: THREE.MeshStandardMaterial
) {
  const bodyY = H * 0.38;
  const bodyR = H * 0.22;
  g.add(
    mesh(
      new THREE.SphereGeometry(bodyR, 16, 14),
      body,
      0,
      bodyY,
      0,
      1.2,
      1.05,
      1.4
    )
  );

  const legH = bodyY * 0.92;
  for (const [sx, sz] of [
    [-H * 0.14, H * 0.15],
    [H * 0.14, H * 0.15],
    [-H * 0.14, -H * 0.14],
    [H * 0.14, -H * 0.14],
  ] as const) {
    g.add(
      mesh(
        new THREE.CylinderGeometry(H * 0.055, H * 0.065, legH, 10),
        dark,
        sx,
        legH / 2,
        sz
      )
    );
  }

  const headY = bodyY + H * 0.1;
  const headZ = H * 0.3;
  g.add(mesh(new THREE.SphereGeometry(H * 0.155, 14, 12), light, 0, headY, headZ));

  const trunk = mesh(
    new THREE.CapsuleGeometry(H * 0.038, H * 0.3, 5, 10),
    dark,
    0,
    headY - H * 0.14,
    headZ + H * 0.12
  );
  trunk.rotation.x = 0.95;
  g.add(trunk);

  for (const sx of [-1, 1]) {
    const ear = mesh(
      new THREE.SphereGeometry(H * 0.15, 12, 10),
      body,
      sx * H * 0.2,
      headY,
      headZ - H * 0.02,
      0.22,
      1.05,
      0.95
    );
    g.add(ear);
  }

  for (const sx of [-1, 1]) {
    const t = mesh(
      new THREE.ConeGeometry(H * 0.022, H * 0.13, 7),
      cream,
      sx * H * 0.065,
      headY - H * 0.05,
      headZ + H * 0.1
    );
    t.rotation.x = Math.PI / 2 + 0.4;
    g.add(t);
  }
}

function buildLion(
  g: THREE.Group,
  H: number,
  body: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  light: THREE.MeshStandardMaterial,
  accent: THREE.MeshStandardMaterial
) {
  const bodyLen = H * 0.55;
  const bodyH = H * 0.28;
  const bodyY = H * 0.3;

  g.add(
    mesh(
      new THREE.CapsuleGeometry(bodyH * 0.48, Math.max(0.05, bodyLen - bodyH), 6, 12),
      body,
      0,
      bodyY,
      0,
      1,
      1,
      1.1
    )
  );
  addQuadLegs(g, dark, H, bodyY, bodyLen * 0.27, H * 0.12);

  const headY = bodyY + bodyH * 0.25;
  const headZ = bodyLen * 0.4;
  const headR = H * 0.14;
  // mane
  g.add(
    mesh(
      new THREE.SphereGeometry(headR * 1.35, 14, 12),
      accent,
      0,
      headY,
      headZ,
      1.15,
      1.1,
      1.05
    )
  );
  g.add(mesh(new THREE.SphereGeometry(headR, 14, 12), light, 0, headY, headZ + H * 0.02));
  g.add(
    mesh(
      new THREE.SphereGeometry(headR * 0.4, 10, 8),
      dark,
      0,
      headY - headR * 0.15,
      headZ + headR * 0.85,
      1.2,
      0.75,
      1.1
    )
  );
  const tail = mesh(
    new THREE.CapsuleGeometry(H * 0.025, H * 0.28, 4, 8),
    dark,
    0,
    bodyY + bodyH * 0.2,
    -bodyLen * 0.4
  );
  tail.rotation.x = 0.7;
  g.add(tail);
  g.add(
    mesh(
      new THREE.SphereGeometry(H * 0.04, 8, 6),
      accent,
      0,
      bodyY + bodyH * 0.45,
      -bodyLen * 0.52
    )
  );
}

function buildTiger(
  g: THREE.Group,
  H: number,
  body: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  light: THREE.MeshStandardMaterial,
  black: THREE.MeshStandardMaterial
) {
  const bodyLen = H * 0.58;
  const bodyH = H * 0.27;
  const bodyY = H * 0.3;

  g.add(
    mesh(
      new THREE.CapsuleGeometry(bodyH * 0.48, Math.max(0.05, bodyLen - bodyH), 6, 12),
      body,
      0,
      bodyY,
      0,
      1,
      1,
      1.12
    )
  );
  addQuadLegs(g, dark, H, bodyY, bodyLen * 0.28, H * 0.12);

  // stripes
  for (const z of [-0.22, -0.05, 0.12, 0.28]) {
    g.add(
      mesh(
        new THREE.BoxGeometry(H * 0.025, bodyH * 0.75, H * 0.07),
        black,
        H * 0.11,
        bodyY,
        z * bodyLen
      )
    );
  }

  const headY = bodyY + bodyH * 0.28;
  const headZ = bodyLen * 0.42;
  const headR = H * 0.135;
  g.add(mesh(new THREE.SphereGeometry(headR, 14, 12), light, 0, headY, headZ));
  for (const sx of [-1, 1]) {
    g.add(
      mesh(
        new THREE.SphereGeometry(headR * 0.28, 8, 6),
        body,
        sx * headR * 0.7,
        headY + headR * 0.7,
        headZ
      )
    );
  }
  g.add(
    mesh(
      new THREE.SphereGeometry(headR * 0.4, 10, 8),
      dark,
      0,
      headY - headR * 0.12,
      headZ + headR * 0.8,
      1.15,
      0.75,
      1.15
    )
  );
  const tail = mesh(
    new THREE.CapsuleGeometry(H * 0.028, H * 0.3, 4, 8),
    dark,
    0,
    bodyY + bodyH * 0.3,
    -bodyLen * 0.4
  );
  tail.rotation.x = -0.55;
  g.add(tail);
}

function buildPenguin(
  g: THREE.Group,
  H: number,
  body: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  white: THREE.MeshStandardMaterial,
  cream: THREE.MeshStandardMaterial,
  black: THREE.MeshStandardMaterial
) {
  const bodyY = H * 0.38;
  // tuxedo body
  g.add(
    mesh(
      new THREE.SphereGeometry(H * 0.2, 16, 14),
      black,
      0,
      bodyY,
      0,
      1,
      1.35,
      1.05
    )
  );
  g.add(
    mesh(
      new THREE.SphereGeometry(H * 0.15, 14, 12),
      white,
      0,
      bodyY - H * 0.02,
      H * 0.06,
      0.85,
      1.15,
      0.7
    )
  );
  g.add(
    mesh(
      new THREE.SphereGeometry(H * 0.12, 12, 10),
      dark,
      0,
      bodyY + H * 0.28,
      H * 0.02
    )
  );
  // beak
  const beak = new THREE.Mesh(new THREE.ConeGeometry(H * 0.035, H * 0.08, 6), cream);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, bodyY + H * 0.26, H * 0.14);
  g.add(beak);
  // flippers
  for (const sx of [-1, 1]) {
    const wing = mesh(
      new THREE.SphereGeometry(H * 0.08, 10, 8),
      black,
      sx * H * 0.18,
      bodyY,
      0,
      0.35,
      1.1,
      0.7
    );
    wing.rotation.z = sx * 0.25;
    g.add(wing);
  }
  // feet
  for (const sx of [-H * 0.06, H * 0.06]) {
    g.add(
      mesh(
        new THREE.SphereGeometry(H * 0.05, 8, 6),
        cream,
        sx,
        H * 0.04,
        H * 0.04,
        1.2,
        0.45,
        1.6
      )
    );
  }
  // keep body material referenced so tint still applies lightly on belly rim
  g.add(
    mesh(
      new THREE.TorusGeometry(H * 0.12, H * 0.012, 6, 16),
      body,
      0,
      bodyY,
      H * 0.08,
      1,
      1,
      0.4
    )
  );
}

function buildBear(
  g: THREE.Group,
  H: number,
  body: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  light: THREE.MeshStandardMaterial,
  cream: THREE.MeshStandardMaterial
) {
  const bodyY = H * 0.34;
  g.add(
    mesh(
      new THREE.SphereGeometry(H * 0.22, 16, 14),
      body,
      0,
      bodyY,
      0,
      1.15,
      1.15,
      1.25
    )
  );
  addQuadLegs(g, dark, H, bodyY * 0.85, H * 0.14, H * 0.12, H * 0.05);

  const headY = bodyY + H * 0.22;
  const headZ = H * 0.2;
  const headR = H * 0.14;
  g.add(mesh(new THREE.SphereGeometry(headR, 14, 12), light, 0, headY, headZ));
  // round ears
  for (const sx of [-1, 1]) {
    g.add(
      mesh(
        new THREE.SphereGeometry(headR * 0.38, 10, 8),
        body,
        sx * headR * 0.72,
        headY + headR * 0.65,
        headZ
      )
    );
  }
  // snout
  g.add(
    mesh(
      new THREE.SphereGeometry(headR * 0.45, 10, 8),
      cream,
      0,
      headY - headR * 0.15,
      headZ + headR * 0.7,
      1.15,
      0.8,
      1.05
    )
  );
  g.add(
    mesh(
      new THREE.SphereGeometry(headR * 0.12, 8, 6),
      dark,
      0,
      headY - headR * 0.1,
      headZ + headR * 1.05
    )
  );
  // short tail
  g.add(
    mesh(
      new THREE.SphereGeometry(H * 0.045, 8, 6),
      dark,
      0,
      bodyY + H * 0.05,
      -H * 0.24
    )
  );
}
