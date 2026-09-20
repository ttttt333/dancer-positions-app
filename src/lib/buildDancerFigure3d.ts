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
    roughness: opts.roughness ?? 0.4,
    metalness: opts.metalness ?? 0.08,
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
  return m;
}

function tint(base: number, factor: number): number {
  const r = Math.min(255, Math.round(((base >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((base >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((base & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

/**
 * 高さ `totalH` の簡易フィギュア（足元 y=0、頭上が totalH）。
 * グループごと disposeObject3D で解放する。
 */
export function buildDancerFigure3d(
  kind: DancerFigure3dId,
  totalH: number,
  color: number
): THREE.Group {
  const g = new THREE.Group();
  const H = Math.max(0.35, totalH);
  const body = mat({ color });
  const dark = mat({ color: tint(color, 0.72) });
  const light = mat({ color: tint(color, 1.18) });
  const accent = mat({ color: tint(color, 0.55), roughness: 0.55 });

  switch (kind) {
    case "human":
      buildHuman(g, H, body, dark, light);
      break;
    case "dog":
      buildQuad(g, H, body, dark, light, {
        snout: true,
        ears: "floppy",
        tail: "up",
      });
      break;
    case "cat":
      buildQuad(g, H, body, dark, light, {
        snout: false,
        ears: "pointy",
        tail: "curve",
      });
      break;
    case "monkey":
      buildMonkey(g, H, body, dark, light);
      break;
    case "bird":
      buildBird(g, H, body, dark, light, accent);
      break;
    case "pig":
      buildPig(g, H, body, dark, light);
      break;
    case "tiger":
      buildQuad(g, H, body, dark, light, {
        snout: true,
        ears: "round",
        tail: "up",
        stripes: true,
      });
      break;
    case "elephant":
      buildElephant(g, H, body, dark, light);
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
  const headR = H * 0.12;
  const torsoH = H * 0.38;
  const legH = H * 0.32;
  const armH = H * 0.28;
  const waistY = legH;
  const shoulderY = waistY + torsoH;
  const headY = shoulderY + headR * 1.05;

  g.add(
    mesh(
      new THREE.CapsuleGeometry(H * 0.055, Math.max(0.02, legH - H * 0.11), 3, 8),
      dark,
      -H * 0.06,
      legH / 2,
      0
    )
  );
  g.add(
    mesh(
      new THREE.CapsuleGeometry(H * 0.055, Math.max(0.02, legH - H * 0.11), 3, 8),
      dark,
      H * 0.06,
      legH / 2,
      0
    )
  );
  g.add(
    mesh(
      new THREE.CapsuleGeometry(H * 0.1, Math.max(0.04, torsoH - H * 0.2), 4, 10),
      body,
      0,
      waistY + torsoH / 2,
      0
    )
  );
  g.add(
    mesh(
      new THREE.CapsuleGeometry(H * 0.04, Math.max(0.02, armH - H * 0.08), 3, 8),
      body,
      -H * 0.16,
      shoulderY - armH * 0.35,
      0
    )
  );
  g.add(
    mesh(
      new THREE.CapsuleGeometry(H * 0.04, Math.max(0.02, armH - H * 0.08), 3, 8),
      body,
      H * 0.16,
      shoulderY - armH * 0.35,
      0
    )
  );
  g.add(mesh(new THREE.SphereGeometry(headR, 12, 10), light, 0, headY, 0));
}

type QuadOpts = {
  snout: boolean;
  ears: "floppy" | "pointy" | "round";
  tail: "up" | "curve";
  stripes?: boolean;
};

function buildQuad(
  g: THREE.Group,
  H: number,
  body: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  light: THREE.MeshStandardMaterial,
  opts: QuadOpts
) {
  const bodyLen = H * 0.55;
  const bodyH = H * 0.28;
  const bodyY = H * 0.28;
  const legR = H * 0.045;
  const legH = bodyY * 0.85;

  g.add(
    mesh(
      new THREE.CapsuleGeometry(bodyH * 0.45, Math.max(0.04, bodyLen - bodyH * 0.9), 4, 10),
      body,
      0,
      bodyY,
      0,
      1,
      1,
      1.15
    )
  );

  const footZ = bodyLen * 0.28;
  const footX = H * 0.12;
  for (const [sx, sz] of [
    [-footX, footZ],
    [footX, footZ],
    [-footX, -footZ],
    [footX, -footZ],
  ] as const) {
    g.add(
      mesh(
        new THREE.CapsuleGeometry(legR, Math.max(0.02, legH - legR * 2), 3, 6),
        dark,
        sx,
        legH / 2,
        sz
      )
    );
  }

  const headY = bodyY + bodyH * 0.35;
  const headZ = bodyLen * 0.42;
  const headR = H * 0.14;
  g.add(mesh(new THREE.SphereGeometry(headR, 12, 10), light, 0, headY, headZ));

  if (opts.snout) {
    g.add(
      mesh(
        new THREE.SphereGeometry(headR * 0.45, 8, 6),
        dark,
        0,
        headY - headR * 0.15,
        headZ + headR * 0.75,
        1.2,
        0.8,
        1.1
      )
    );
  }

  const earY = headY + headR * 0.75;
  const earX = headR * 0.7;
  if (opts.ears === "pointy") {
    for (const sx of [-earX, earX]) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(headR * 0.28, headR * 0.55, 6),
        body
      );
      cone.position.set(sx, earY, headZ);
      g.add(cone);
    }
  } else if (opts.ears === "floppy") {
    for (const sx of [-earX, earX]) {
      g.add(
        mesh(
          new THREE.SphereGeometry(headR * 0.32, 8, 6),
          dark,
          sx,
          headY,
          headZ,
          0.7,
          1.2,
          0.5
        )
      );
    }
  } else {
    for (const sx of [-earX, earX]) {
      g.add(
        mesh(
          new THREE.SphereGeometry(headR * 0.28, 8, 6),
          body,
          sx,
          earY * 0.98,
          headZ
        )
      );
    }
  }

  const tail = new THREE.Mesh(
    new THREE.CapsuleGeometry(H * 0.03, H * 0.22, 3, 6),
    dark
  );
  if (opts.tail === "curve") {
    tail.position.set(0, bodyY + bodyH * 0.2, -bodyLen * 0.4);
    tail.rotation.x = 0.9;
  } else {
    tail.position.set(0, bodyY + bodyH * 0.35, -bodyLen * 0.38);
    tail.rotation.x = -0.6;
  }
  g.add(tail);

  if (opts.stripes) {
    for (const z of [-0.12, 0, 0.12]) {
      g.add(
        mesh(
          new THREE.BoxGeometry(H * 0.02, bodyH * 0.7, H * 0.08),
          dark,
          H * 0.12,
          bodyY,
          z * bodyLen
        )
      );
    }
  }
}

function buildMonkey(
  g: THREE.Group,
  H: number,
  body: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  light: THREE.MeshStandardMaterial
) {
  buildHuman(g, H * 0.92, body, dark, light);
  const headY = H * 0.78;
  g.add(
    mesh(
      new THREE.SphereGeometry(H * 0.08, 10, 8),
      light,
      0,
      headY - H * 0.02,
      H * 0.09,
      1.1,
      0.9,
      0.85
    )
  );
  const ear = new THREE.SphereGeometry(H * 0.06, 8, 6);
  g.add(mesh(ear, body, -H * 0.14, headY, 0));
  g.add(mesh(ear.clone(), body, H * 0.14, headY, 0));
  const tail = new THREE.Mesh(
    new THREE.CapsuleGeometry(H * 0.025, H * 0.35, 3, 6),
    dark
  );
  tail.position.set(0, H * 0.35, -H * 0.08);
  tail.rotation.x = 1.1;
  g.add(tail);
}

function buildBird(
  g: THREE.Group,
  H: number,
  body: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  light: THREE.MeshStandardMaterial,
  accent: THREE.MeshStandardMaterial
) {
  const bodyY = H * 0.38;
  g.add(
    mesh(
      new THREE.SphereGeometry(H * 0.18, 12, 10),
      body,
      0,
      bodyY,
      0,
      1,
      1.15,
      1.25
    )
  );
  g.add(
    mesh(
      new THREE.SphereGeometry(H * 0.12, 10, 8),
      light,
      0,
      bodyY + H * 0.2,
      H * 0.08
    )
  );
  const beak = new THREE.Mesh(new THREE.ConeGeometry(H * 0.04, H * 0.1, 6), accent);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, bodyY + H * 0.18, H * 0.2);
  g.add(beak);

  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(
      new THREE.SphereGeometry(H * 0.1, 8, 6),
      dark
    );
    wing.scale.set(0.35, 0.9, 1.4);
    wing.position.set(sx * H * 0.16, bodyY, 0);
    wing.rotation.z = sx * 0.35;
    g.add(wing);
  }

  for (const sx of [-H * 0.05, H * 0.05]) {
    g.add(
      mesh(
        new THREE.CapsuleGeometry(H * 0.02, H * 0.12, 2, 5),
        accent,
        sx,
        H * 0.12,
        0
      )
    );
  }

  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(H * 0.08, H * 0.16, 6),
    dark
  );
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, bodyY, -H * 0.22);
  g.add(tail);
}

function buildPig(
  g: THREE.Group,
  H: number,
  body: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  light: THREE.MeshStandardMaterial
) {
  buildQuad(g, H * 0.95, body, dark, light, {
    snout: false,
    ears: "pointy",
    tail: "curve",
  });
  const snoutY = H * 0.42;
  const snoutZ = H * 0.32;
  g.add(
    mesh(
      new THREE.CylinderGeometry(H * 0.06, H * 0.07, H * 0.08, 10),
      light,
      0,
      snoutY,
      snoutZ
    )
  );
  const snoutMesh = g.children[g.children.length - 1] as THREE.Mesh;
  snoutMesh.rotation.x = Math.PI / 2;
}

function buildElephant(
  g: THREE.Group,
  H: number,
  body: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  light: THREE.MeshStandardMaterial
) {
  const bodyY = H * 0.38;
  const bodyR = H * 0.22;
  g.add(
    mesh(
      new THREE.SphereGeometry(bodyR, 14, 12),
      body,
      0,
      bodyY,
      0,
      1.15,
      1,
      1.35
    )
  );

  const legH = bodyY * 0.9;
  for (const [sx, sz] of [
    [-H * 0.14, H * 0.14],
    [H * 0.14, H * 0.14],
    [-H * 0.14, -H * 0.14],
    [H * 0.14, -H * 0.14],
  ] as const) {
    g.add(
      mesh(
        new THREE.CylinderGeometry(H * 0.06, H * 0.07, legH, 8),
        dark,
        sx,
        legH / 2,
        sz
      )
    );
  }

  const headY = bodyY + H * 0.12;
  const headZ = H * 0.28;
  g.add(
    mesh(new THREE.SphereGeometry(H * 0.16, 12, 10), light, 0, headY, headZ)
  );

  const trunk = new THREE.Mesh(
    new THREE.CapsuleGeometry(H * 0.04, H * 0.28, 3, 6),
    dark
  );
  trunk.position.set(0, headY - H * 0.12, headZ + H * 0.12);
  trunk.rotation.x = 0.85;
  g.add(trunk);

  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(H * 0.14, 10, 8),
      body
    );
    ear.scale.set(0.25, 1, 0.9);
    ear.position.set(sx * H * 0.2, headY, headZ - H * 0.02);
    g.add(ear);
  }

  const tusk = new THREE.ConeGeometry(H * 0.025, H * 0.12, 6);
  for (const sx of [-1, 1]) {
    const t = new THREE.Mesh(tusk, mat({ color: 0xf1f5f9, roughness: 0.35 }));
    t.position.set(sx * H * 0.07, headY - H * 0.06, headZ + H * 0.1);
    t.rotation.x = Math.PI / 2 + 0.35;
    g.add(t);
  }
}
