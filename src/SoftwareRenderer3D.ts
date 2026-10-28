import * as THREE from 'three';

interface RenderTri {
  x0: number; y0: number;
  x1: number; y1: number;
  x2: number; y2: number;
  depth: number;
  fill: string;
  stroke: string | null;
  lineWidth: number;
}

/**
 * High-performance Canvas2D 3D Software Rasterizer for Three.js scenes.
 * Accurately handles mirrored meshes (negative determinant scale), two-tone
 * crystalline bevels, dark antique bronze beds, gleaming gold filigree,
 * and faceted diamonds.
 */
export class SoftwareRenderer3D {
  public domElement: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number = 800;
  private height: number = 600;
  private pixelRatio: number = 1;
  public toneMapping: any = THREE.ACESFilmicToneMapping;
  public toneMappingExposure: number = 1.25;
  public shadowMap = { enabled: false, type: THREE.PCFSoftShadowMap };

  private triPool: RenderTri[] = [];
  private projScreenMatrix = new THREE.Matrix4();
  private viewMatrix = new THREE.Matrix4();
  private worldPosA = new THREE.Vector3();
  private worldPosB = new THREE.Vector3();
  private worldPosC = new THREE.Vector3();
  private viewPosA = new THREE.Vector3();
  private viewPosB = new THREE.Vector3();
  private viewPosC = new THREE.Vector3();
  private ndcA = new THREE.Vector3();
  private ndcB = new THREE.Vector3();
  private ndcC = new THREE.Vector3();
  private faceNormal = new THREE.Vector3();
  private edge1 = new THREE.Vector3();
  private edge2 = new THREE.Vector3();
  private viewDir = new THREE.Vector3();
  private centroid = new THREE.Vector3();

  // Symmetrical Studio Light Directions so both Left and Right Golden Horns gleam equally
  private keyLightDir = new THREE.Vector3(2.8, 5.5, 7.5).normalize();
  private rimLightDir = new THREE.Vector3(-2.8, 5.5, 7.5).normalize();
  private fillLightDir = new THREE.Vector3(0.0, -2.0, 8.0).normalize();
  private halfVecKey = new THREE.Vector3();
  private halfVecRim = new THREE.Vector3();

  constructor(width: number, height: number) {
    this.domElement = document.createElement('canvas');
    const context = this.domElement.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Canvas 2D context unavailable');
    }
    this.ctx = context;
    this.setSize(width, height);
  }

  public setPixelRatio(pr: number) {
    this.pixelRatio = Math.min(pr, 1.5);
    this.setSize(this.width, this.height);
  }

  public setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.domElement.width = Math.floor(width * this.pixelRatio);
    this.domElement.height = Math.floor(height * this.pixelRatio);
    this.domElement.style.width = `${width}px`;
    this.domElement.style.height = `${height}px`;
  }

  private getTri(index: number): RenderTri {
    if (index >= this.triPool.length) {
      this.triPool.push({
        x0: 0, y0: 0, x1: 0, y1: 0, x2: 0, y2: 0,
        depth: 0, fill: '', stroke: null, lineWidth: 0.5
      });
    }
    return this.triPool[index];
  }

  public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    const ctx = this.ctx;
    const W = this.domElement.width;
    const H = this.domElement.height;
    const halfW = W * 0.5;
    const halfH = H * 0.5;

    // 1. Update scene & camera matrices
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    this.viewMatrix.copy(camera.matrixWorldInverse);
    this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, this.viewMatrix);
    const camPos = camera.position;

    // 2. Draw Studio Background
    const bgGrad = ctx.createRadialGradient(halfW, H * 0.42, 10, halfW, halfH, Math.max(W, H) * 0.72);
    bgGrad.addColorStop(0, '#222834');
    bgGrad.addColorStop(0.55, '#12161f');
    bgGrad.addColorStop(1, '#080a0f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 3. Soft Luminous White Halo along the Sword Silhouette (matches reference glow)
    const swordGroup = scene.getObjectByName('DivineSword');
    if (swordGroup) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glowPts = [
        new THREE.Vector3(0, 0.25, 0),
        new THREE.Vector3(0, -1.2, 0),
        new THREE.Vector3(0, -3.8, 0),
      ];
      for (const gp of glowPts) {
        gp.applyMatrix4(swordGroup.matrixWorld).applyMatrix4(this.projScreenMatrix);
        if (gp.z > -1 && gp.z < 1) {
          const gx = (gp.x + 1) * halfW;
          const gy = (-gp.y + 1) * halfH;
          const rad = Math.min(W, H) * 0.28;
          const aura = ctx.createRadialGradient(gx, gy, 4, gx, gy, rad);
          aura.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
          aura.addColorStop(0.4, 'rgba(210, 235, 255, 0.04)');
          aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = aura;
          ctx.fillRect(0, 0, W, H);
        }
      }
      ctx.restore();
    }

    // 4. Collect and shade triangles from all visible meshes
    let triCount = 0;
    const pointsObjects: THREE.Points[] = [];

    scene.traverse((obj) => {
      if (!obj.visible) return;

      if (obj instanceof THREE.Points) {
        pointsObjects.push(obj);
        return;
      }

      if (!(obj instanceof THREE.Mesh)) return;

      const mat = obj.material as any;
      if (!mat || mat.type === 'ShaderMaterial') return;

      const geo = obj.geometry as THREE.BufferGeometry;
      const posAttr = geo.attributes.position;
      if (!posAttr) return;

      const indexAttr = geo.index;
      const worldMat = obj.matrixWorld;
      const detSign = worldMat.determinant() < 0 ? -1 : 1;

      const isWireframe = Boolean(mat.wireframe);
      const isDoubleSide = (mat.side === THREE.DoubleSide);
      const isTransmission = (mat.transmission !== undefined && mat.transmission > 0.1);
      const isMetal = (mat.metalness !== undefined && mat.metalness > 0.8);
      const isDarkBed = (mat.metalness !== undefined && mat.metalness > 0.5 && mat.metalness <= 0.8);

      const baseColor: THREE.Color = mat.color || new THREE.Color(0xffffff);
      const emissiveColor: THREE.Color = mat.emissive || new THREE.Color(0x000000);
      const emissiveIntensity: number = mat.emissiveIntensity ?? 0;
      const transmission: number = mat.transmission ?? 0;
      const metalness: number = mat.metalness ?? 0.5;

      const rBase = baseColor.r * 255;
      const gBase = baseColor.g * 255;
      const bBase = baseColor.b * 255;

      const rEm = emissiveColor.r * 255 * emissiveIntensity;
      const gEm = emissiveColor.g * 255 * emissiveIntensity;
      const bEm = emissiveColor.b * 255 * emissiveIntensity;

      const processTriangle = (i0: number, i1: number, i2: number) => {
        this.worldPosA.fromBufferAttribute(posAttr, i0).applyMatrix4(worldMat);
        this.worldPosB.fromBufferAttribute(posAttr, i1).applyMatrix4(worldMat);
        this.worldPosC.fromBufferAttribute(posAttr, i2).applyMatrix4(worldMat);

        this.viewPosA.copy(this.worldPosA).applyMatrix4(this.viewMatrix);
        this.viewPosB.copy(this.worldPosB).applyMatrix4(this.viewMatrix);
        this.viewPosC.copy(this.worldPosC).applyMatrix4(this.viewMatrix);

        if (this.viewPosA.z > -0.15 || this.viewPosB.z > -0.15 || this.viewPosC.z > -0.15) {
          return;
        }

        this.ndcA.copy(this.worldPosA).applyMatrix4(this.projScreenMatrix);
        this.ndcB.copy(this.worldPosB).applyMatrix4(this.projScreenMatrix);
        this.ndcC.copy(this.worldPosC).applyMatrix4(this.projScreenMatrix);

        const x0 = (this.ndcA.x + 1) * halfW;
        const y0 = (-this.ndcA.y + 1) * halfH;
        const x1 = (this.ndcB.x + 1) * halfW;
        const y1 = (-this.ndcB.y + 1) * halfH;
        const x2 = (this.ndcC.x + 1) * halfW;
        const y2 = (-this.ndcC.y + 1) * halfH;

        // Signed 2D area corrected for mirrored matrix determinant
        const cross2D = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
        if (!isDoubleSide && !isTransmission && !isWireframe && (cross2D * detSign) >= 0) {
          return;
        }

        this.edge1.subVectors(this.worldPosB, this.worldPosA);
        this.edge2.subVectors(this.worldPosC, this.worldPosA);
        this.faceNormal.crossVectors(this.edge1, this.edge2).normalize();

        this.centroid.copy(this.worldPosA).add(this.worldPosB).add(this.worldPosC).multiplyScalar(0.333333);
        this.viewDir.subVectors(camPos, this.centroid).normalize();

        // Ensure normal always faces the viewer on visible front faces (fixes mirrored scale meshes)
        if (this.faceNormal.dot(this.viewDir) < 0) {
          this.faceNormal.negate();
        }

        const ndotlKey = Math.max(0, this.faceNormal.dot(this.keyLightDir));
        const ndotlRim = Math.max(0, this.faceNormal.dot(this.rimLightDir));
        const ndotlFill = Math.max(0, this.faceNormal.dot(this.fillLightDir));
        const ndotv = Math.abs(this.faceNormal.dot(this.viewDir));
        const fresnel = Math.pow(1.0 - ndotv, 2.2);

        this.halfVecKey.addVectors(this.keyLightDir, this.viewDir).normalize();
        this.halfVecRim.addVectors(this.rimLightDir, this.viewDir).normalize();

        const specPower = isTransmission ? 32 : (isMetal ? 20 : 10);
        const specKey = Math.pow(Math.max(0, this.faceNormal.dot(this.halfVecKey)), specPower);
        const specRim = Math.pow(Math.max(0, this.faceNormal.dot(this.halfVecRim)), specPower);

        let r = 0, g = 0, b = 0, alpha = 1.0;
        let strokeColor: string | null = null;
        let lineWidth = 0.5;

        if (isWireframe) {
          r = Math.min(255, rBase + 60);
          g = Math.min(255, gBase + 60);
          b = Math.min(255, bBase + 60);
          const tri = this.getTri(triCount++);
          tri.x0 = x0; tri.y0 = y0;
          tri.x1 = x1; tri.y1 = y1;
          tri.x2 = x2; tri.y2 = y2;
          tri.depth = (this.viewPosA.z + this.viewPosB.z + this.viewPosC.z) * 0.333333;
          tri.fill = 'rgba(0,0,0,0)';
          tri.stroke = `rgba(${r|0},${g|0},${b|0},0.75)`;
          tri.lineWidth = 0.8;
          return;
        }

        if (emissiveIntensity >= 0.8) {
          // Luminous Pure White Crystal Edge, Volutes & Wing Barbs
          const diff = 0.82 + 0.30 * ndotlKey + 0.25 * ndotlRim;
          const spec = (specKey * 1.2 + fresnel * 0.5) * 255;
          r = rBase * diff + rEm * 0.3 + spec;
          g = gBase * diff + gEm * 0.3 + spec;
          b = bBase * diff + bEm * 0.35 + spec;
          alpha = 0.96;
          strokeColor = 'rgba(255, 255, 255, 0.88)';
          lineWidth = 0.65;
        } else if (isTransmission) {
          // High-Contrast Faceted Diamond Gems & Icy Silver-Slate Crystal Bevel
          // Vary brightness strongly per facet normal so diamond facets sparkle with silver/white contrast
          const facetAngle = Math.abs(this.faceNormal.x * 0.85 - this.faceNormal.y * 0.55);
          const diff = 0.45 + 0.48 * ndotlKey + 0.40 * ndotlRim + 0.20 * facetAngle;
          const spec = (specKey * 1.35 + specRim * 0.95) * 210;
          r = rBase * diff + rEm * 0.22 + spec;
          g = gBase * diff + gEm * 0.24 + spec;
          b = bBase * diff + bEm * 0.28 + spec * 1.04;
          alpha = Math.max(0.68, Math.min(0.95, 1.0 - transmission * 0.25 + specKey * 0.3));
          strokeColor = transmission > 0.7
            ? 'rgba(135, 150, 172, 0.65)' // Crisp diamond facet cut lines
            : 'rgba(240, 248, 255, 0.45)';
          lineWidth = 0.6;
        } else if (isMetal) {
          // Gleaming Royal Gold & Filigree Scrollwork
          const envReflect = 0.84 + 0.16 * Math.sin(this.faceNormal.y * 2.5 + Math.abs(this.faceNormal.x) * 1.8);
          const diff = (0.55 + 0.62 * ndotlKey + 0.62 * ndotlRim + 0.35 * ndotlFill) * (0.72 + 0.28 * metalness);
          const spec = (specKey * 1.45 + specRim * 1.45 + fresnel * 0.25) * 255 * metalness;
          r = rBase * diff * envReflect + rEm + spec * 1.05;
          g = gBase * diff * envReflect + gEm + spec * 0.95;
          b = bBase * diff * envReflect * 0.82 + bEm + spec * 0.65;
          strokeColor = `rgba(${Math.min(255, r * 0.82)|0}, ${Math.min(255, g * 0.78)|0}, ${Math.min(255, b * 0.55)|0}, 0.88)`;
          lineWidth = 0.5;
        } else if (isDarkBed) {
          // Recessed Antique Gold / Bronze Bed inside Filigree Panels
          const diff = 0.58 + 0.42 * ndotlKey + 0.42 * ndotlRim + 0.25 * ndotlFill;
          r = rBase * diff + rEm;
          g = gBase * diff + gEm;
          b = bBase * diff + bEm;
          strokeColor = `rgba(${Math.min(255, r)|0}, ${Math.min(255, g)|0}, ${Math.min(255, b)|0}, 0.95)`;
          lineWidth = 0.45;
        } else {
          // Silver Filigree & Standard Surfaces
          const diff = 0.55 + 0.65 * ndotlKey + 0.40 * ndotlRim + 0.25 * ndotlFill;
          const spec = (specKey * 0.9 + specRim * 0.6) * 255;
          r = rBase * diff + rEm + spec;
          g = gBase * diff + gEm + spec;
          b = bBase * diff + bEm + spec;
        }

        r = Math.min(255, Math.max(0, r));
        g = Math.min(255, Math.max(0, g));
        b = Math.min(255, Math.max(0, b));

        const tri = this.getTri(triCount++);
        tri.x0 = x0; tri.y0 = y0;
        tri.x1 = x1; tri.y1 = y1;
        tri.x2 = x2; tri.y2 = y2;
        tri.depth = (this.viewPosA.z + this.viewPosB.z + this.viewPosC.z) * 0.333333;
        tri.fill = alpha < 0.99
          ? `rgba(${r|0},${g|0},${b|0},${alpha.toFixed(2)})`
          : `rgb(${r|0},${g|0},${b|0})`;
        tri.stroke = strokeColor;
        tri.lineWidth = lineWidth;
      };

      if (indexAttr) {
        const count = indexAttr.count;
        for (let i = 0; i < count; i += 3) {
          processTriangle(indexAttr.getX(i), indexAttr.getX(i + 1), indexAttr.getX(i + 2));
        }
      } else {
        const count = posAttr.count;
        for (let i = 0; i < count; i += 3) {
          processTriangle(i, i + 1, i + 2);
        }
      }
    });

    // 5. Painter's Algorithm Depth Sort
    const activeTris = this.triPool.slice(0, triCount);
    activeTris.sort((a, b) => a.depth - b.depth);

    // 6. Rasterize sorted 3D triangles
    ctx.lineJoin = 'round';
    for (let i = 0; i < triCount; i++) {
      const t = activeTris[i];
      ctx.beginPath();
      ctx.moveTo(t.x0, t.y0);
      ctx.lineTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.closePath();

      if (t.fill !== 'rgba(0,0,0,0)') {
        ctx.fillStyle = t.fill;
        ctx.fill();
      }
      if (t.stroke) {
        ctx.strokeStyle = t.stroke;
        ctx.lineWidth = t.lineWidth;
        ctx.stroke();
      }
    }

    // 7. Render 3D Sparkles / 4-Point Cross-Stars
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const pts of pointsObjects) {
      const posAttr = pts.geometry.attributes.position;
      if (!posAttr) continue;
      const worldMat = pts.matrixWorld;
      const count = posAttr.count;

      for (let i = 0; i < count; i++) {
        this.worldPosA.fromBufferAttribute(posAttr, i).applyMatrix4(worldMat);
        this.viewPosA.copy(this.worldPosA).applyMatrix4(this.viewMatrix);
        if (this.viewPosA.z > -0.2) continue;

        this.ndcA.copy(this.worldPosA).applyMatrix4(this.projScreenMatrix);
        if (this.ndcA.x < -1.1 || this.ndcA.x > 1.1 || this.ndcA.y < -1.1 || this.ndcA.y > 1.1) continue;

        const sx = (this.ndcA.x + 1) * halfW;
        const sy = (-this.ndcA.y + 1) * halfH;
        const dist = -this.viewPosA.z;
        const size = Math.max(1.5, Math.min(8.0, (24.0 / dist) * this.pixelRatio));

        const twinkle = 0.55 + 0.45 * Math.sin(i * 3.7 + this.worldPosA.y * 4.0);
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.5 * twinkle).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size * 0.65, 0, Math.PI * 2);
        ctx.fill();

        if (size > 2.6) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${(0.8 * twinkle).toFixed(2)})`;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(sx - size * 1.8, sy);
          ctx.lineTo(sx + size * 1.8, sy);
          ctx.moveTo(sx, sy - size * 1.8);
          ctx.lineTo(sx, sy + size * 1.8);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}
