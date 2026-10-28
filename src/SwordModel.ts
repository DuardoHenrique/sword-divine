import * as THREE from 'three';
import { SwordMaterials } from './materials';

export interface SwordComponents {
  root: THREE.Group;
  bladeGroup: THREE.Group;
  guardGroup: THREE.Group;
  hiltGroup: THREE.Group;
  gemGroup: THREE.Group;
  filigreeGroup: THREE.Group;
}

/**
 * Helper to create a mirrored pair (Right +X and Left -X) of a 3D tube curve
 * using exact parametric curve.getPoint(u) so curves never pinch.
 */
function addMirroredTube(
  parent: THREE.Group,
  points: THREE.Vector3[],
  radiusStart: number,
  radiusEnd: number,
  material: THREE.Material,
  bothFaces: boolean = false,
  segments: number = 28,
  radialSegments: number = 8,
  bellyBoost: number = 0.0
) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, segments, 1.0, radialSegments, false);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ringIdx = Math.floor(i / (radialSegments + 1));
    const u = Math.min(1, ringIdx / segments);
    // IMPORTANT: TubeGeometry places ringIdx at curve.getPointAt(u)
    const pt = curve.getPointAt(u);
    const linearR = radiusStart + (radiusEnd - radiusStart) * u;
    const belly = 1.0 + bellyBoost * Math.sin(u * Math.PI);
    const r = linearR * belly;

    const dx = pos.getX(i) - pt.x;
    const dy = pos.getY(i) - pt.y;
    const dz = pos.getZ(i) - pt.z;

    pos.setXYZ(
      i,
      pt.x + dx * r,
      pt.y + dy * r,
      pt.z + dz * (r * 0.65)
    );
  }
  geo.computeVertexNormals();

  const zMultipliers = bothFaces ? [1, -1] : [1];
  for (const zSign of zMultipliers) {
    for (const xSign of [1, -1]) {
      const mesh = new THREE.Mesh(geo, material);
      mesh.scale.set(xSign, 1, zSign);
      parent.add(mesh);
    }
  }
}

/**
 * Helper to create a mirrored extruded 3D plate on Right (+X) and Left (-X).
 */
function addMirroredExtrude(
  parent: THREE.Group,
  shape: THREE.Shape,
  depth: number,
  bevelSize: number,
  zCenter: number,
  material: THREE.Material,
  bothFaces: boolean = false
) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevelSize > 0,
    bevelSegments: 2,
    steps: 1,
    bevelSize,
    bevelThickness: bevelSize,
  });
  geo.translate(0, 0, -depth * 0.5);

  const zList = bothFaces ? [zCenter, -zCenter] : [zCenter];
  for (const zPos of zList) {
    for (const xs of [1, -1]) {
      const m = new THREE.Mesh(geo, material);
      m.position.z = zPos;
      m.scale.set(xs, 1, 1);
      parent.add(m);
    }
  }
}

/**
 * Helper to create a faceted teardrop / diamond gem at (x, y, z) on both front and back faces.
 */
function addFacetedGem(
  parent: THREE.Group,
  x: number,
  y: number,
  zOffset: number,
  rx: number,
  ry: number,
  rz: number,
  material: THREE.Material,
  rotZ: number = 0,
  teardropFactor: number = 0.25
) {
  const geo = new THREE.OctahedronGeometry(1.0, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const pinch = vy > 0 ? 1.0 - teardropFactor * vy : 1.0 + teardropFactor * 0.2 * vy;
    const yStretch = vy > 0 ? 1.0 + teardropFactor * 0.45 : 0.92;
    pos.setXYZ(i, vx * rx * pinch, vy * ry * yStretch, vz * rz);
  }
  geo.computeVertexNormals();

  const zSigns = zOffset === 0 ? [1] : [1, -1];
  const xSigns = Math.abs(x) < 0.001 ? [1] : [1, -1];

  for (const zs of zSigns) {
    for (const xs of xSigns) {
      const m = new THREE.Mesh(geo, material);
      m.position.set(x * xs, y, zOffset * zs);
      m.rotation.z = rotZ * xs;
      parent.add(m);
    }
  }
}

export function createDivineSword(materials: SwordMaterials): SwordComponents {
  const root = new THREE.Group();
  root.name = 'DivineSword';

  const bladeGroup = new THREE.Group();
  bladeGroup.name = 'BladeGroup';

  const guardGroup = new THREE.Group();
  guardGroup.name = 'GuardGroup';

  const hiltGroup = new THREE.Group();
  hiltGroup.name = 'HiltGroup';

  const gemGroup = new THREE.Group();
  gemGroup.name = 'GemGroup';

  const filigreeGroup = new THREE.Group();
  filigreeGroup.name = 'FiligreeGroup';

  root.add(bladeGroup);
  root.add(guardGroup);
  root.add(hiltGroup);
  root.add(gemGroup);
  root.add(filigreeGroup);

  // ============================================================================
  // 1. CRYSTAL BLADE (Exact Measured Waist + Leaf Swell + Two-Tone Luminous Edge)
  // ============================================================================
  function buildCrystalBladeAssembly(): void {
    // [y, totalHalfWidth, innerBevelWidth, halfThickness]
    const bladeSlices: [number, number, number, number][] = [
      [ 0.10, 0.26, 0.18, 0.068],
      [-0.35, 0.28, 0.20, 0.068],
      [-0.75, 0.34, 0.25, 0.066],
      [-1.15, 0.38, 0.28, 0.064],
      [-1.60, 0.30, 0.22, 0.062],
      [-1.90, 0.26, 0.19, 0.060],
      [-2.18, 0.245, 0.175, 0.058], // Narrow graceful waist (Y=468px)
      [-2.50, 0.265, 0.190, 0.058],
      [-2.90, 0.320, 0.235, 0.060],
      [-3.35, 0.385, 0.285, 0.062],
      [-3.75, 0.425, 0.320, 0.064],
      [-4.05, 0.440, 0.335, 0.064], // Max leaf-blade swell (Y=655px, dx=44px)
      [-4.45, 0.425, 0.320, 0.060],
      [-4.90, 0.385, 0.285, 0.055],
      [-5.35, 0.330, 0.240, 0.050],
      [-5.80, 0.265, 0.185, 0.042],
      [-6.25, 0.190, 0.128, 0.034],
      [-6.70, 0.110, 0.068, 0.024],
      [-7.05, 0.045, 0.022, 0.012],
      [-7.32, 0.001, 0.0005, 0.001], // Needle tip (Y=982px)
    ];

    // 1A. Inner Icy Silver-Slate Faceted Core (with recessed central fuller channel for gold spine)
    const innerVerts: number[] = [];
    const innerIndices: number[] = [];
    const ringCount = bladeSlices.length;
    const innerRingVerts = 8;

    for (let i = 0; i < ringCount; i++) {
      const [y, , wIn, t] = bladeSlices[i];
      // Recess center thickness where the golden spine sits (y > -5.25) so gold never Z-fights
      const tCenter = y > -5.25 ? t * 0.48 : t * 0.85;
      const tMid = t * 0.65;
      const ring = [
        [-wIn, y, 0.010],
        [-wIn * 0.5, y, tMid],
        [0, y, tCenter],
        [ wIn * 0.5, y, tMid],
        [ wIn, y, 0.010],
        [ wIn * 0.5, y, -tMid],
        [0, y, -tCenter],
        [-wIn * 0.5, y, -tMid],
      ];
      for (const p of ring) innerVerts.push(p[0], p[1], p[2]);
    }

    for (let i = 0; i < ringCount - 1; i++) {
      const r1 = i * innerRingVerts;
      const r2 = (i + 1) * innerRingVerts;
      for (let j = 0; j < innerRingVerts; j++) {
        const nj = (j + 1) % innerRingVerts;
        innerIndices.push(r1 + j, r1 + nj, r2 + nj);
        innerIndices.push(r1 + j, r2 + nj, r2 + j);
      }
    }

    const innerGeo = new THREE.BufferGeometry();
    innerGeo.setAttribute('position', new THREE.Float32BufferAttribute(innerVerts, 3));
    innerGeo.setIndex(innerIndices);
    innerGeo.computeVertexNormals();
    bladeGroup.add(new THREE.Mesh(innerGeo, materials.crystalBlade));

    // 1B. Luminous Pure White Cutting Edge Bevel
    for (const side of [1, -1]) {
      const edgeVerts: number[] = [];
      const edgeIndices: number[] = [];
      const eVertsPerRing = 4;

      for (let i = 0; i < ringCount; i++) {
        const [y, wOut, wIn, t] = bladeSlices[i];
        const tEdge = t * 0.35;
        const pts = side > 0
          ? [
              [wIn, y, tEdge],
              [wOut, y, 0],
              [wIn, y, -tEdge],
              [wIn * 0.88, y, 0],
            ]
          : [
              [-wIn, y, -tEdge],
              [-wOut, y, 0],
              [-wIn, y, tEdge],
              [-wIn * 0.88, y, 0],
            ];
        for (const p of pts) edgeVerts.push(p[0], p[1], p[2]);
      }

      for (let i = 0; i < ringCount - 1; i++) {
        const r1 = i * eVertsPerRing;
        const r2 = (i + 1) * eVertsPerRing;
        for (let j = 0; j < 2; j++) {
          const nj = j + 1;
          edgeIndices.push(r1 + j, r1 + nj, r2 + nj);
          edgeIndices.push(r1 + j, r2 + nj, r2 + j);
        }
      }

      const edgeGeo = new THREE.BufferGeometry();
      edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVerts, 3));
      edgeGeo.setIndex(edgeIndices);
      edgeGeo.computeVertexNormals();
      bladeGroup.add(new THREE.Mesh(edgeGeo, materials.crystalBladeEdge));
    }

    // 1C. Central Crisp Crystal Ridge Line from Lower Gold Point (-5.22) to Tip (-7.32)
    for (const zs of [1, -1]) {
      const ridgePts = [
        new THREE.Vector3(0, -5.20, 0.052 * zs),
        new THREE.Vector3(0, -6.25, 0.035 * zs),
        new THREE.Vector3(0, -7.30, 0.002 * zs),
      ];
      const rCurve = new THREE.CatmullRomCurve3(ridgePts);
      const rGeo = new THREE.TubeGeometry(rCurve, 12, 0.011, 6, false);
      bladeGroup.add(new THREE.Mesh(rGeo, materials.crystalBladeEdge));
    }

    // 1D. Subtle Feathered White Crystal Striations on Lower Blade Bevel
    const featherYList = [-3.1, -3.45, -3.8, -4.15, -4.5, -4.85, -5.2, -5.55, -5.9, -6.25];
    for (const fy of featherYList) {
      const tNorm = Math.max(0, Math.min(1, (-fy - 2.9) / 3.8));
      const xStart = (0.19 - tNorm * 0.14);
      const xEnd = (0.36 - tNorm * 0.24);
      addMirroredTube(
        bladeGroup,
        [
          new THREE.Vector3(xStart, fy + 0.18, 0.044),
          new THREE.Vector3((xStart + xEnd) * 0.52, fy - 0.05, 0.028),
          new THREE.Vector3(xEnd, fy - 0.28, 0.012),
        ],
        0.007,
        0.003,
        materials.crystalBladeEdge,
        true,
        8,
        5
      );
    }
  }
  buildCrystalBladeAssembly();

  // ============================================================================
  // 2. SOLID SCULPTED WHITE CRYSTAL VOLUTES & SWEPT RICASSO WING BARBS
  // ============================================================================
  function buildCrystalVolutesAndWings(): void {
    // 2A. Sculpted Solid Crystal Scroll Plate under the Golden Crossguard (Y=225..285px)
    const volutePlate = new THREE.Shape();
    volutePlate.moveTo(0.18, 0.08);
    volutePlate.bezierCurveTo(0.42, 0.12, 0.66, 0.05, 0.70, -0.12);
    volutePlate.bezierCurveTo(0.72, -0.26, 0.58, -0.34, 0.44, -0.29);
    volutePlate.bezierCurveTo(0.34, -0.25, 0.34, -0.10, 0.45, -0.10);
    volutePlate.bezierCurveTo(0.52, -0.10, 0.50, -0.20, 0.42, -0.18);
    volutePlate.bezierCurveTo(0.32, -0.22, 0.28, -0.34, 0.22, -0.38);
    volutePlate.lineTo(0.18, 0.08);

    addMirroredExtrude(bladeGroup, volutePlate, 0.030, 0.010, 0.0, materials.crystalBlade, false);

    // Luminous white outer spiral rim highlighting the volute contour
    const underGuardVoluteRim = [
      new THREE.Vector3(0.20,  0.07, 0.022),
      new THREE.Vector3(0.45,  0.10, 0.022),
      new THREE.Vector3(0.66,  0.02, 0.020),
      new THREE.Vector3(0.70, -0.14, 0.020),
      new THREE.Vector3(0.58, -0.29, 0.020),
      new THREE.Vector3(0.42, -0.26, 0.020),
      new THREE.Vector3(0.37, -0.14, 0.022),
      new THREE.Vector3(0.46, -0.09, 0.022),
      new THREE.Vector3(0.51, -0.16, 0.022),
    ];
    addMirroredTube(bladeGroup, underGuardVoluteRim, 0.044, 0.016, materials.crystalBladeEdge, true, 32, 8);

    // 2B. Upper Swept Crystal Wing Barb #1 (Silver-slate body + luminous white outer edge)
    const wing1Shape = new THREE.Shape();
    wing1Shape.moveTo(0.22, -0.32);
    wing1Shape.bezierCurveTo(0.32, -0.58, 0.48, -0.85, 0.64, -1.18);
    wing1Shape.bezierCurveTo(0.52, -1.06, 0.39, -1.04, 0.32, -1.18);
    wing1Shape.lineTo(0.22, -0.95);
    wing1Shape.closePath();

    // 2C. Lower Swept Crystal Wing Barb #2 (Silver-slate body + luminous white outer edge)
    const wing2Shape = new THREE.Shape();
    wing2Shape.moveTo(0.24, -1.02);
    wing2Shape.bezierCurveTo(0.35, -1.22, 0.42, -1.40, 0.46, -1.58);
    wing2Shape.bezierCurveTo(0.38, -1.48, 0.31, -1.50, 0.25, -1.68);
    wing2Shape.closePath();

    addMirroredExtrude(bladeGroup, wing1Shape, 0.026, 0.008, 0.0, materials.crystalBlade, false);
    addMirroredExtrude(bladeGroup, wing2Shape, 0.024, 0.008, 0.0, materials.crystalBlade, false);

    // Luminous white outer cutting edges on both crystal wing barbs
    addMirroredTube(
      bladeGroup,
      [
        new THREE.Vector3(0.25, -0.35, 0.018),
        new THREE.Vector3(0.38, -0.68, 0.016),
        new THREE.Vector3(0.52, -0.96, 0.014),
        new THREE.Vector3(0.64, -1.18, 0.010),
        new THREE.Vector3(0.46, -1.08, 0.012),
        new THREE.Vector3(0.33, -1.15, 0.014),
      ],
      0.026,
      0.010,
      materials.crystalBladeEdge,
      true,
      24,
      8
    );

    addMirroredTube(
      bladeGroup,
      [
        new THREE.Vector3(0.30, -1.12, 0.016),
        new THREE.Vector3(0.40, -1.36, 0.014),
        new THREE.Vector3(0.46, -1.58, 0.010),
        new THREE.Vector3(0.35, -1.50, 0.012),
        new THREE.Vector3(0.26, -1.65, 0.014),
      ],
      0.022,
      0.009,
      materials.crystalBladeEdge,
      true,
      18,
      8
    );
  }
  buildCrystalVolutesAndWings();

  // ============================================================================
  // 3. CONTINUOUS ORNATE GOLDEN FILIGREE SPINE, WARM GOLD BED & DENSE SCROLLWORK
  // ============================================================================
  function buildGoldenFiligreeSpine(): void {
    // 3A. Finely-Sliced Warm Antique-Gold Bed (avoids long-triangle Painter's sort artifacts in 3D perspective!)
    // [y, halfWidth]
    const bedSlices: [number, number][] = [
      [-0.02, 0.110],
      [-0.15, 0.092],
      [-0.28, 0.105],
      [-0.42, 0.155],
      [-0.54, 0.255], // Hook #1 peak
      [-0.68, 0.150],
      [-0.82, 0.160],
      [-0.94, 0.225], // Hook #2 peak
      [-1.12, 0.195],
      [-1.30, 0.168],
      [-1.50, 0.140],
      [-1.70, 0.112],
      [-1.90, 0.082],
      [-2.10, 0.052],
      [-2.30, 0.028], // Narrow waist bridge
      [-2.50, 0.030],
      [-2.75, 0.052],
      [-2.95, 0.088],
      [-3.15, 0.122],
      [-3.35, 0.155],
      [-3.55, 0.180],
      [-3.75, 0.196],
      [-3.95, 0.202], // Lower leaf max width
      [-4.15, 0.192],
      [-4.38, 0.170],
      [-4.60, 0.140],
      [-4.82, 0.105],
      [-5.02, 0.055],
      [-5.22, 0.002], // Sharp golden point
    ];

    for (const zs of [1, -1]) {
      const bVerts: number[] = [];
      const bIndices: number[] = [];
      const zFace = 0.055 * zs;
      const zCenter = 0.060 * zs;

      for (let i = 0; i < bedSlices.length; i++) {
        const [y, w] = bedSlices[i];
        bVerts.push(-w, y, zFace);
        bVerts.push(0, y, zCenter);
        bVerts.push(w, y, zFace);
      }

      for (let i = 0; i < bedSlices.length - 1; i++) {
        const r1 = i * 3;
        const r2 = (i + 1) * 3;
        if (zs > 0) {
          bIndices.push(r1 + 0, r2 + 0, r2 + 1);
          bIndices.push(r1 + 0, r2 + 1, r1 + 1);
          bIndices.push(r1 + 1, r2 + 1, r2 + 2);
          bIndices.push(r1 + 1, r2 + 2, r1 + 2);
        } else {
          bIndices.push(r1 + 0, r1 + 1, r2 + 1);
          bIndices.push(r1 + 0, r2 + 1, r2 + 0);
          bIndices.push(r1 + 1, r1 + 2, r2 + 2);
          bIndices.push(r1 + 1, r2 + 2, r2 + 1);
        }
      }

      const bedGeo = new THREE.BufferGeometry();
      bedGeo.setAttribute('position', new THREE.Float32BufferAttribute(bVerts, 3));
      bedGeo.setIndex(bIndices);
      bedGeo.computeVertexNormals();
      filigreeGroup.add(new THREE.Mesh(bedGeo, materials.antiqueBronze));
    }

    // 3B. Gleaming Raised Golden Outer Frame Borders
    // Upper Collar & Hook #1 (y = -0.02 to -0.56)
    addMirroredTube(
      filigreeGroup,
      [
        new THREE.Vector3(0.11, -0.02, 0.070),
        new THREE.Vector3(0.085, -0.22, 0.070),
        new THREE.Vector3(0.15, -0.42, 0.070),
        new THREE.Vector3(0.27, -0.54, 0.068),
      ],
      0.026,
      0.014,
      materials.ornateGold,
      true,
      20,
      8
    );

    // Hook #1 Return into Hook #2 (y = -0.54 to -0.95)
    addMirroredTube(
      filigreeGroup,
      [
        new THREE.Vector3(0.25, -0.54, 0.068),
        new THREE.Vector3(0.15, -0.68, 0.070),
        new THREE.Vector3(0.16, -0.82, 0.070),
        new THREE.Vector3(0.25, -0.95, 0.068),
      ],
      0.022,
      0.014,
      materials.ornateGold,
      true,
      18,
      8
    );

    // Continuous Raised Golden Border Rib (from y = -0.94 through waist bridge down to y = -5.22)
    const continuousGoldBorderPts = [
      new THREE.Vector3(0.22, -0.94, 0.070),
      new THREE.Vector3(0.175, -1.25, 0.070),
      new THREE.Vector3(0.125, -1.65, 0.068),
      new THREE.Vector3(0.065, -2.02, 0.066),
      new THREE.Vector3(0.026, -2.38, 0.066), // Narrow central golden bridge
      new THREE.Vector3(0.050, -2.75, 0.066),
      new THREE.Vector3(0.120, -3.15, 0.068),
      new THREE.Vector3(0.180, -3.55, 0.070),
      new THREE.Vector3(0.202, -3.95, 0.070), // Max width of lower golden leaf
      new THREE.Vector3(0.172, -4.38, 0.068),
      new THREE.Vector3(0.108, -4.82, 0.064),
      new THREE.Vector3(0.000, -5.22, 0.060), // Sharp golden needle tip
    ];
    addMirroredTube(filigreeGroup, continuousGoldBorderPts, 0.025, 0.015, materials.ornateGold, true, 48, 8);

    // 3C. Dense, Lush Golden Filigree Scrollwork Inside Upper & Lower Panels
    const scrollCurves: THREE.Vector3[][] = [
      // Upper ricasso scrolls around the 4-diamond cluster
      [
        new THREE.Vector3(0.02, -0.14, 0.072),
        new THREE.Vector3(0.07, -0.26, 0.072),
        new THREE.Vector3(0.02, -0.35, 0.072),
      ],
      [
        new THREE.Vector3(0.04, -0.62, 0.072),
        new THREE.Vector3(0.13, -0.74, 0.072),
        new THREE.Vector3(0.06, -0.86, 0.072),
      ],
      // Upper panel scrolls flanking the -1.18 oval gem
      [
        new THREE.Vector3(0.02, -0.82, 0.072),
        new THREE.Vector3(0.14, -0.96, 0.072),
        new THREE.Vector3(0.09, -1.12, 0.072),
      ],
      [
        new THREE.Vector3(0.06, -0.96, 0.072),
        new THREE.Vector3(0.15, -1.15, 0.072),
        new THREE.Vector3(0.06, -1.32, 0.072),
      ],
      [
        new THREE.Vector3(0.08, -1.24, 0.072),
        new THREE.Vector3(0.13, -1.42, 0.072),
        new THREE.Vector3(0.03, -1.56, 0.072),
      ],
      [
        new THREE.Vector3(0.02, -1.52, 0.070),
        new THREE.Vector3(0.09, -1.68, 0.070),
        new THREE.Vector3(0.03, -1.90, 0.070),
      ],
      // Lower leaf panel dense scrollwork (y = -2.85 to -5.05)
      [
        new THREE.Vector3(0.01, -2.80, 0.070),
        new THREE.Vector3(0.07, -2.96, 0.070),
        new THREE.Vector3(0.02, -3.08, 0.070),
      ],
      [
        new THREE.Vector3(0.02, -3.18, 0.072),
        new THREE.Vector3(0.12, -3.34, 0.072),
        new THREE.Vector3(0.04, -3.50, 0.072),
      ],
      [
        new THREE.Vector3(0.06, -3.36, 0.072),
        new THREE.Vector3(0.15, -3.55, 0.072),
        new THREE.Vector3(0.05, -3.70, 0.072),
      ],
      [
        new THREE.Vector3(0.03, -3.56, 0.072),
        new THREE.Vector3(0.16, -3.72, 0.072),
        new THREE.Vector3(0.08, -3.86, 0.072),
      ],
      [
        new THREE.Vector3(0.08, -3.94, 0.072),
        new THREE.Vector3(0.16, -4.10, 0.072),
        new THREE.Vector3(0.03, -4.24, 0.072),
      ],
      [
        new THREE.Vector3(0.05, -4.12, 0.072),
        new THREE.Vector3(0.14, -4.28, 0.072),
        new THREE.Vector3(0.04, -4.44, 0.072),
      ],
      [
        new THREE.Vector3(0.03, -4.32, 0.070),
        new THREE.Vector3(0.11, -4.48, 0.070),
        new THREE.Vector3(0.02, -4.64, 0.070),
      ],
      [
        new THREE.Vector3(0.02, -4.66, 0.068),
        new THREE.Vector3(0.07, -4.82, 0.068),
        new THREE.Vector3(0.01, -5.02, 0.068),
      ],
    ];

    for (const sc of scrollCurves) {
      addMirroredTube(filigreeGroup, sc, 0.013, 0.010, materials.filigreeGold, true, 12, 6, 0.25);
    }

    // 3D. Embedded White Diamonds Along the Filigree Spine
    addFacetedGem(filigreeGroup, 0.00, -0.40, 0.078, 0.034, 0.058, 0.026, materials.smallDiamond);
    addFacetedGem(filigreeGroup, 0.075, -0.56, 0.078, 0.030, 0.048, 0.024, materials.smallDiamond, 0.55);
    addFacetedGem(filigreeGroup, 0.00, -0.73, 0.078, 0.034, 0.058, 0.026, materials.smallDiamond);

    addFacetedGem(filigreeGroup, 0.00, -1.18, 0.080, 0.050, 0.082, 0.032, materials.smallDiamond);
    addFacetedGem(filigreeGroup, 0.00, -1.78, 0.076, 0.034, 0.055, 0.025, materials.smallDiamond);

    addFacetedGem(filigreeGroup, 0.00, -3.10, 0.078, 0.034, 0.058, 0.025, materials.smallDiamond);
    addFacetedGem(filigreeGroup, 0.00, -3.88, 0.080, 0.052, 0.085, 0.034, materials.smallDiamond);
    addFacetedGem(filigreeGroup, 0.09, -3.95, 0.076, 0.024, 0.040, 0.020, materials.smallDiamond, 0.45);
    addFacetedGem(filigreeGroup, 0.00, -4.58, 0.076, 0.036, 0.060, 0.025, materials.smallDiamond);
  }
  buildGoldenFiligreeSpine();

  // ============================================================================
  // 4. SCULPTED DOUBLE-CRESCENT GOLDEN CROSSGUARD WINGS & UPPER VOLUTES
  // ============================================================================
  function buildCrossguardAssembly(): void {
    // Helper to build a 3D ribbon web strictly between two curves (eliminates any protruding edge!)
    const addWebBetweenCurves = (ptsA: THREE.Vector3[], ptsB: THREE.Vector3[], mat: THREE.Material) => {
      const cA = new THREE.CatmullRomCurve3(ptsA);
      const cB = new THREE.CatmullRomCurve3(ptsB);
      const steps = 24;
      const v: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const pA = cA.getPointAt(u);
        const pB = cB.getPointAt(u);
        v.push(pA.x, pA.y, 0.016);
        v.push(pB.x, pB.y, 0.016);
      }
      for (let i = 0; i < steps; i++) {
        const r1 = i * 2;
        const r2 = (i + 1) * 2;
        idx.push(r1, r2, r2 + 1);
        idx.push(r1, r2 + 1, r1 + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      for (const zs of [1, -1]) {
        for (const xs of [1, -1]) {
          const m = new THREE.Mesh(g, mat);
          m.scale.set(xs, 1, zs);
          guardGroup.add(m);
        }
      }
    };

    const innerHornRim = [
      new THREE.Vector3(0.18, 0.22, 0.022),
      new THREE.Vector3(0.42, 0.14, 0.022),
      new THREE.Vector3(0.65, 0.22, 0.020),
      new THREE.Vector3(0.76, 0.42, 0.018),
      new THREE.Vector3(0.71, 0.70, 0.012),
    ];

    const innerHornOuterEdge = [
      new THREE.Vector3(0.20, 0.11, 0.022),
      new THREE.Vector3(0.48, 0.05, 0.022),
      new THREE.Vector3(0.74, 0.18, 0.020),
      new THREE.Vector3(0.82, 0.42, 0.018),
      new THREE.Vector3(0.71, 0.70, 0.012),
    ];

    const outerWingUpperRim = [
      new THREE.Vector3(0.50, 0.08, 0.020),
      new THREE.Vector3(0.74, 0.18, 0.020),
      new THREE.Vector3(0.92, 0.32, 0.018),
      new THREE.Vector3(1.07, 0.56, 0.015),
      new THREE.Vector3(1.16, 0.88, 0.010),
    ];

    const outerWingLowerRim = [
      new THREE.Vector3(0.45, 0.05, 0.022),
      new THREE.Vector3(0.72, 0.03, 0.022),
      new THREE.Vector3(0.96, 0.20, 0.020),
      new THREE.Vector3(1.11, 0.50, 0.016),
      new THREE.Vector3(1.16, 0.88, 0.010),
    ];

    // 4A. Recessed Warm Golden Webs strictly bounded between the Horn Rims
    addWebBetweenCurves(innerHornRim, innerHornOuterEdge, materials.antiqueBronze);
    addWebBetweenCurves(outerWingUpperRim, outerWingLowerRim, materials.antiqueBronze);

    // 4B. Raised Gleaming Gold Rim Borders along Inner & Outer Crescent Edges
    addMirroredTube(guardGroup, innerHornRim, 0.028, 0.008, materials.ornateGold, true, 28, 8, 0.25);
    addMirroredTube(guardGroup, innerHornOuterEdge, 0.025, 0.007, materials.ornateGold, true, 28, 8, 0.2);
    addMirroredTube(guardGroup, outerWingUpperRim, 0.022, 0.007, materials.ornateGold, true, 24, 8, 0.2);
    addMirroredTube(guardGroup, outerWingLowerRim, 0.028, 0.007, materials.ornateGold, true, 28, 8, 0.25);

    // Filigree engraving scrolls inside the golden crossguard wings
    const hornFiligree1 = [
      new THREE.Vector3(0.30, 0.14, 0.024),
      new THREE.Vector3(0.52, 0.11, 0.024),
      new THREE.Vector3(0.68, 0.28, 0.022),
    ];
    const hornFiligree2 = [
      new THREE.Vector3(0.68, 0.09, 0.024),
      new THREE.Vector3(0.88, 0.18, 0.024),
      new THREE.Vector3(1.02, 0.42, 0.020),
    ];
    addMirroredTube(guardGroup, hornFiligree1, 0.013, 0.009, materials.filigreeGold, true, 14, 6);
    addMirroredTube(guardGroup, hornFiligree2, 0.013, 0.009, materials.filigreeGold, true, 14, 6);

    // 4C. Solid Sculpted White Crystal Upper Scrolls (Under the Golden Arches, y = +0.48..+0.80)
    const upperScrollPlate = new THREE.Shape();
    upperScrollPlate.moveTo(0.10, 0.72);
    upperScrollPlate.bezierCurveTo(0.25, 0.82, 0.44, 0.74, 0.44, 0.58);
    upperScrollPlate.bezierCurveTo(0.44, 0.46, 0.30, 0.44, 0.25, 0.54);
    upperScrollPlate.bezierCurveTo(0.22, 0.60, 0.30, 0.64, 0.32, 0.58);
    upperScrollPlate.bezierCurveTo(0.24, 0.56, 0.18, 0.52, 0.12, 0.48);
    upperScrollPlate.closePath();

    addMirroredExtrude(guardGroup, upperScrollPlate, 0.028, 0.010, 0.0, materials.crystalBlade, false);

    const upperWhiteScrollRim = [
      new THREE.Vector3(0.12, 0.72, 0.018),
      new THREE.Vector3(0.28, 0.77, 0.018),
      new THREE.Vector3(0.42, 0.68, 0.018),
      new THREE.Vector3(0.42, 0.54, 0.018),
      new THREE.Vector3(0.31, 0.49, 0.018),
      new THREE.Vector3(0.27, 0.57, 0.018),
    ];
    addMirroredTube(guardGroup, upperWhiteScrollRim, 0.028, 0.012, materials.crystalBladeEdge, true, 24, 8);

    // 4D. Upper Golden Crescent Arches Cap Above the White Scrolls (y = +0.74..+0.91)
    const upperGoldArchPts = [
      new THREE.Vector3(0.03, 0.84, 0.025),
      new THREE.Vector3(0.15, 0.91, 0.025),
      new THREE.Vector3(0.30, 0.86, 0.025),
      new THREE.Vector3(0.40, 0.74, 0.020),
    ];
    addMirroredTube(guardGroup, upperGoldArchPts, 0.034, 0.012, materials.ornateGold, true, 20, 8, 0.2);

    // Small white diamond between the upper golden arches at base of grip (y = +0.74)
    addFacetedGem(guardGroup, 0.0, 0.74, 0.042, 0.045, 0.085, 0.035, materials.smallDiamond);
  }
  buildCrossguardAssembly();

  // ============================================================================
  // 5. CENTRAL PEAR-CUT WHITE DIAMOND & GOLDEN BEZEL (y = +0.26)
  // ============================================================================
  function buildCentralPearGem(): void {
    // Solid silver-white reflective backing inside the bezel so the diamond is bright and opaque against background
    const gemBackShape = new THREE.Shape();
    gemBackShape.moveTo(0, 0.58);
    gemBackShape.bezierCurveTo( 0.16, 0.42,  0.21, 0.18,  0.14, 0.02);
    gemBackShape.bezierCurveTo( 0.08, -0.05, -0.08, -0.05, -0.14, 0.02);
    gemBackShape.bezierCurveTo(-0.21, 0.18, -0.16, 0.42,  0.00, 0.58);
    const backGeo = new THREE.ExtrudeGeometry(gemBackShape, { depth: 0.06, bevelEnabled: false });
    backGeo.translate(0, 0, -0.03);
    gemGroup.add(new THREE.Mesh(backGeo, materials.silverFiligree));

    // Main Pear-Cut Diamond (y = +0.25, width ±0.205, height ±0.33)
    addFacetedGem(gemGroup, 0.0, 0.25, 0.0, 0.205, 0.33, 0.135, materials.diamondGem, 0, 0.32);

    // Sleek Golden Bezel Frame wrapping the Pear-Cut Diamond
    const bezelPts = [
      new THREE.Vector3(0.00,  0.60, 0.048),
      new THREE.Vector3(0.13,  0.44, 0.052),
      new THREE.Vector3(0.21,  0.24, 0.052),
      new THREE.Vector3(0.16,  0.04, 0.052),
      new THREE.Vector3(0.00, -0.06, 0.048),
    ];
    addMirroredTube(gemGroup, bezelPts, 0.024, 0.022, materials.ornateGold, true, 24, 8);

    // Two small horizontal triangular white side-gems flanking the bezel (y = +0.22, x = ±0.26)
    addFacetedGem(gemGroup, 0.26, 0.22, 0.04, 0.048, 0.032, 0.025, materials.smallDiamond);
  }
  buildCentralPearGem();

  // ============================================================================
  // 6. PURE WHITE/SILVER FLUTED CRYSTALLINE HILT GRIP & POMMEL (y = +0.85 to +2.33)
  // ============================================================================
  function buildHiltAndPommel(): void {
    // 6A. Waisted White/Silver Crystalline Grip (y = +0.84 to +1.80)
    const gripSlices: [number, number, number][] = [
      [0.84, 0.145, 0.075],
      [1.05, 0.132, 0.072],
      [1.30, 0.125, 0.070],
      [1.55, 0.142, 0.074],
      [1.72, 0.175, 0.080],
      [1.80, 0.190, 0.082],
    ];

    const gVerts: number[] = [];
    const gIndices: number[] = [];
    const gRingCount = gripSlices.length;
    const gSegs = 12;

    for (let i = 0; i < gRingCount; i++) {
      const [y, rx, rz] = gripSlices[i];
      for (let j = 0; j < gSegs; j++) {
        const theta = (j / gSegs) * Math.PI * 2;
        const flute = 1.0 + 0.05 * Math.cos(theta * 6);
        gVerts.push(Math.cos(theta) * rx * flute, y, Math.sin(theta) * rz * flute);
      }
    }

    for (let i = 0; i < gRingCount - 1; i++) {
      const r1 = i * gSegs;
      const r2 = (i + 1) * gSegs;
      for (let j = 0; j < gSegs; j++) {
        const nj = (j + 1) % gSegs;
        gIndices.push(r1 + j, r1 + nj, r2 + nj);
        gIndices.push(r1 + j, r2 + nj, r2 + j);
      }
    }

    const gripGeo = new THREE.BufferGeometry();
    gripGeo.setAttribute('position', new THREE.Float32BufferAttribute(gVerts, 3));
    gripGeo.setIndex(gIndices);
    gripGeo.computeVertexNormals();
    hiltGroup.add(new THREE.Mesh(gripGeo, materials.crystalGrip));

    // Central vertical silver ridge & subtle diagonal silver flutes on grip
    for (const zs of [1, -1]) {
      const centerRidge = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.86, 0.076 * zs),
        new THREE.Vector3(0, 1.32, 0.072 * zs),
        new THREE.Vector3(0, 1.78, 0.082 * zs),
      ]);
      hiltGroup.add(new THREE.Mesh(new THREE.TubeGeometry(centerRidge, 12, 0.011, 6, false), materials.silverFiligree));
    }

    // Subtle V-chevron silver ribs on grip (matching the crystalline texture in reference)
    for (const cy of [1.05, 1.28, 1.52]) {
      addMirroredTube(
        hiltGroup,
        [
          new THREE.Vector3(0.01, cy - 0.06, 0.074),
          new THREE.Vector3(0.07, cy + 0.02, 0.065),
          new THREE.Vector3(0.12, cy + 0.10, 0.035),
        ],
        0.008,
        0.005,
        materials.silverFiligree,
        true,
        8,
        5
      );
    }

    // Flared pointed white crystal ear-tips at top of grip (y = +1.76, x = ±0.19)
    addMirroredTube(
      hiltGroup,
      [
        new THREE.Vector3(0.13, 1.62, 0.0),
        new THREE.Vector3(0.17, 1.72, 0.0),
        new THREE.Vector3(0.21, 1.80, 0.0),
      ],
      0.026,
      0.008,
      materials.crystalBladeEdge,
      false,
      10,
      6
    );

    // 6B. Solid Golden Pommel Backplate + Teardrop Bezel Frame (no dark gap around pommel gem!)
    const pommelPlateShape = new THREE.Shape();
    pommelPlateShape.moveTo(0, 1.80);
    pommelPlateShape.bezierCurveTo( 0.16, 1.88,  0.19, 2.05,  0.14, 2.18);
    pommelPlateShape.bezierCurveTo( 0.08, 2.27,  0.03, 2.31,  0.00, 2.34);
    pommelPlateShape.bezierCurveTo(-0.03, 2.31, -0.08, 2.27, -0.14, 2.18);
    pommelPlateShape.bezierCurveTo(-0.19, 2.05, -0.16, 1.88,  0.00, 1.80);
    const pPlateGeo = new THREE.ExtrudeGeometry(pommelPlateShape, {
      depth: 0.055,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    });
    pPlateGeo.translate(0, 0, -0.0275);
    hiltGroup.add(new THREE.Mesh(pPlateGeo, materials.ornateGold));

    // Golden V-Chevron Collar at Base of Pommel (y = +1.77 to +1.95)
    const collarPts = [
      new THREE.Vector3(0.00, 1.77, 0.055),
      new THREE.Vector3(0.10, 1.83, 0.052),
      new THREE.Vector3(0.18, 1.90, 0.035),
    ];
    addMirroredTube(hiltGroup, collarPts, 0.036, 0.026, materials.filigreeGold, true, 14, 8);

    // Golden Teardrop/Flame Pommel Outer Rim (y = +1.90 to +2.34, width ±0.17)
    const pommelFramePts = [
      new THREE.Vector3(0.00, 1.88, 0.042),
      new THREE.Vector3(0.14, 1.98, 0.042),
      new THREE.Vector3(0.17, 2.09, 0.040),
      new THREE.Vector3(0.11, 2.22, 0.038),
      new THREE.Vector3(0.00, 2.34, 0.035),
    ];
    addMirroredTube(hiltGroup, pommelFramePts, 0.030, 0.016, materials.filigreeGold, true, 20, 8);

    // 6C. White Faceted Teardrop Diamond Gem Cradled Inside the Golden Pommel Frame (y = +2.09)
    addFacetedGem(hiltGroup, 0.0, 2.09, 0.032, 0.095, 0.165, 0.055, materials.smallDiamond, 0, 0.30);
  }
  buildHiltAndPommel();

  return {
    root,
    bladeGroup,
    guardGroup,
    hiltGroup,
    gemGroup,
    filigreeGroup,
  };
}
