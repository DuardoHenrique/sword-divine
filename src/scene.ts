import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { SoftwareRenderer3D } from './SoftwareRenderer3D';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer | SoftwareRenderer3D;
  controls: OrbitControls;
  isSoftwareRenderer: boolean;
  setCameraPreset: (preset: 'front' | 'persp' | 'guard' | 'blade' | 'pommel' | 'profile') => void;
}

/**
 * Creates a procedural environment map with high dynamic range colors
 * (deep dark space, golden warm highlights, cool divine blue highlights)
 * so transmission materials (diamonds/crystals) and metals look stunning.
 */
function createProceduralEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture | null {
  try {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x0c1017);

    const lightSphereGeo = new THREE.SphereGeometry(1, 16, 16);

    const warmMat = new THREE.MeshBasicMaterial({ color: 0xffe5a0 });
    const warmMesh = new THREE.Mesh(lightSphereGeo, warmMat);
    warmMesh.position.set(4, 5, 4);
    warmMesh.scale.set(1.5, 3, 1.5);
    envScene.add(warmMesh);

    const coolMat = new THREE.MeshBasicMaterial({ color: 0xc8eeff });
    const coolMesh = new THREE.Mesh(lightSphereGeo, coolMat);
    coolMesh.position.set(-5, 2, -4);
    coolMesh.scale.set(2, 4, 1.5);
    envScene.add(coolMesh);

    const bounceMat = new THREE.MeshBasicMaterial({ color: 0x304050 });
    const bounceMesh = new THREE.Mesh(lightSphereGeo, bounceMat);
    bounceMesh.position.set(0, -6, 2);
    bounceMesh.scale.set(5, 1, 5);
    envScene.add(bounceMesh);

    const envTexture = pmremGenerator.fromScene(envScene, 0.04).texture;
    pmremGenerator.dispose();
    return envTexture;
  } catch (err) {
    console.warn('Procedural PMREM environment fallback:', err);
    return null;
  }
}

function initializeRenderer(
  container: HTMLElement,
  width: number,
  height: number
): { renderer: THREE.WebGLRenderer | SoftwareRenderer3D; isSoftwareRenderer: boolean } {
  const testCanvas = document.createElement('canvas');

  const contextAttempts: { type: string; attrs: WebGLContextAttributes }[] = [
    { type: 'webgl2', attrs: { antialias: true, alpha: false, powerPreference: 'default' } },
    { type: 'webgl2', attrs: { antialias: false, alpha: false, failIfMajorPerformanceCaveat: false } },
    { type: 'webgl', attrs: { antialias: false, alpha: false, failIfMajorPerformanceCaveat: false } },
    { type: 'experimental-webgl', attrs: { antialias: false, alpha: false, failIfMajorPerformanceCaveat: false } },
  ];

  let glContext: RenderingContext | null = null;
  for (const attempt of contextAttempts) {
    try {
      glContext = testCanvas.getContext(attempt.type, attempt.attrs);
      if (glContext) {
        break;
      }
    } catch {
      // try next
    }
  }

  if (glContext) {
    try {
      const webglRenderer = new THREE.WebGLRenderer({
        canvas: testCanvas,
        context: glContext as any,
        antialias: false,
        alpha: false,
      });
      webglRenderer.setSize(width, height);
      webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      webglRenderer.toneMappingExposure = 1.25;
      webglRenderer.shadowMap.enabled = true;
      webglRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(webglRenderer.domElement);
      return { renderer: webglRenderer, isSoftwareRenderer: false };
    } catch (err) {
      console.warn('WebGLRenderer init failed, switching to 3D Software Renderer:', err);
    }
  }

  // Fallback to real-time 3D Software Renderer (Canvas 2D rasterizer)
  const softRenderer = new SoftwareRenderer3D(width, height);
  softRenderer.setPixelRatio(window.devicePixelRatio || 1);
  container.appendChild(softRenderer.domElement);
  return { renderer: softRenderer, isSoftwareRenderer: true };
}

export function setupScene(container: HTMLElement): SceneContext {
  const width = container.clientWidth || window.innerWidth || 800;
  const height = container.clientHeight || window.innerHeight || 600;

  const { renderer, isSoftwareRenderer } = initializeRenderer(container, width, height);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e14);
  scene.fog = new THREE.FogExp2(0x0b0e14, 0.035);

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, -2.1, 13.5);

  if (!isSoftwareRenderer && renderer instanceof THREE.WebGLRenderer) {
    const envMap = createProceduralEnvironment(renderer);
    if (envMap) {
      scene.environment = envMap;
    }
  }

  // OrbitControls attached directly to the renderer canvas (works for both WebGL and Software 3D)
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.9;
  controls.zoomSpeed = 1.1;
  controls.panSpeed = 0.8;
  controls.target.set(0, -2.1, 0);
  controls.maxDistance = 28;
  controls.minDistance = 1.2;
  controls.update();

  // -----------------------------------------------------------
  // STUDIO LIGHTING SETUP
  // -----------------------------------------------------------
  const ambient = new THREE.AmbientLight(0xd4e2f0, 0.6);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfff5df, 2.8);
  keyLight.position.set(4.5, 6, 6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xbadfff, 3.2);
  rimLight.position.set(-6, 2, -5);
  scene.add(rimLight);

  const frontLight = new THREE.DirectionalLight(0xffffff, 1.0);
  frontLight.position.set(0, -1, 5);
  scene.add(frontLight);

  const tipLight = new THREE.PointLight(0xd4f0ff, 2.5, 6, 2.0);
  tipLight.position.set(0, -6.8, 0.4);
  scene.add(tipLight);

  // Handle window resizing
  window.addEventListener('resize', () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // Camera Presets
  function setCameraPreset(preset: 'front' | 'persp' | 'guard' | 'blade' | 'pommel' | 'profile') {
    switch (preset) {
      case 'front':
        camera.position.set(0, -2.50, 14.8);
        controls.target.set(0, -2.50, 0);
        break;
      case 'persp':
        camera.position.set(4.2, -0.4, 13.5);
        controls.target.set(0, -2.50, 0);
        break;
      case 'guard':
        camera.position.set(0, 0.0, 4.0);
        controls.target.set(0, 0.0, 0);
        break;
      case 'blade':
        camera.position.set(0, -3.8, 5.2);
        controls.target.set(0, -3.8, 0);
        break;
      case 'pommel':
        camera.position.set(0, 1.5, 3.2);
        controls.target.set(0, 1.5, 0);
        break;
      case 'profile':
        camera.position.set(13.5, -2.50, 0);
        controls.target.set(0, -2.50, 0);
        break;
    }
    controls.update();
  }

  return { scene, camera, renderer, controls, isSoftwareRenderer, setCameraPreset };
}
