import * as THREE from 'three';
import GUI from 'lil-gui';
import { setupScene } from './scene';
import { setupPostprocessing, BloomEffect } from './postprocessing';
import { createSwordMaterials } from './materials';
import { createDivineSword, SwordComponents } from './SwordModel';
import { createDivineSparkles } from './particles';

// 1. Error Display Banner for unexpected uncaught errors
function showError(msg: string) {
  console.error('[Sword App Error]:', msg);
  const banner = document.getElementById('error-banner');
  if (banner) {
    banner.style.display = 'block';
    banner.textContent = 'Aviso: ' + msg;
  }
}
window.addEventListener('error', (e) => showError(e.message));
window.addEventListener('unhandledrejection', (e) => showError(String(e.reason)));

// 2. Global State & Parameters
const params = {
  autoRotate: false, // Deixado desligado por padrão para você girar livremente com o mouse sem interferência
  rotationSpeed: 0.8,
  glowIntensity: 0.75,
  bloomStrength: 0.45,
  sparkles: true,
  wireframe: false,
  bladeTransmission: 0.82,
  goldMetalness: 0.95,
  explodeAmount: 0.0,
  referenceTilt: false,
  resetView: () => {}
};

// 3. Connect UI Buttons immediately
let setCameraPresetFn: ((preset: 'front' | 'persp' | 'guard' | 'blade' | 'pommel' | 'profile') => void) | null = null;
let swordObj: SwordComponents | null = null;

const viewButtons = document.querySelectorAll<HTMLButtonElement>('.view-btn');
viewButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    viewButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view as any;
    if (setCameraPresetFn && view) {
      if (swordObj) {
        swordObj.root.rotation.set(0, 0, params.referenceTilt ? -0.24 : 0);
      }
      setCameraPresetFn(view);
    }
  });
});

const refToggle = document.getElementById('ref-toggle');
const refOverlay = document.getElementById('ref-overlay') as HTMLImageElement;
let refVisible = false;
refToggle?.addEventListener('click', (e) => {
  e.stopPropagation();
  refVisible = !refVisible;
  if (refOverlay) refOverlay.style.opacity = refVisible ? '0.55' : '0';
  if (refToggle) refToggle.textContent = refVisible ? 'Ocultar Referência' : 'Ver Referência 2D (Overlay)';
  if (refVisible && swordObj) {
    params.referenceTilt = true;
    swordObj.root.rotation.z = -0.24;
  } else if (!refVisible && swordObj) {
    params.referenceTilt = false;
    swordObj.root.rotation.z = 0.0;
  }
});

// 4. Initialize 3D Scene (WebGL or Real-Time 3D Software Rasterizer)
try {
  const container = document.getElementById('canvas-container') as HTMLElement;
  if (!container) throw new Error('Elemento #canvas-container não encontrado no DOM');

  const { scene, camera, renderer, controls, isSoftwareRenderer, setCameraPreset } = setupScene(container);
  setCameraPresetFn = setCameraPreset;
  params.resetView = () => {
    if (swordObj) swordObj.root.rotation.set(0, 0, params.referenceTilt ? -0.24 : 0);
    setCameraPreset('front');
  };

  (window as any).__SET_CAMERA__ = setCameraPreset;
  (window as any).__READY__ = true;

  // Create Materials & 3D Sword
  const materials = createSwordMaterials();
  const sword = createDivineSword(materials);
  swordObj = sword;
  scene.add(sword.root);

  (window as any).__SWORD__ = sword;
  (window as any).__PARAMS__ = params;

  // Create Divine Sparkles Particle System
  const sparkles = createDivineSparkles();
  scene.add(sparkles.points);

  // Add subtle instruction hint at bottom
  const isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 768);
  const hintPill = document.createElement('div');
  hintPill.innerHTML = isMobile
    ? `👆 <b>Arraste para girar a Espada 3D</b> • 2 dedos para Zoom`
    : `🖱️ <b>Clique e arraste em qualquer direção para rotacionar a Espada 3D</b> • Scroll dá Zoom • Botão direito move`;
  hintPill.style.cssText = `
    position: fixed;
    bottom: ${isMobile ? '64px' : '82px'};
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 22, 34, 0.88);
    border: 1px solid rgba(251, 212, 114, 0.35);
    backdrop-filter: blur(10px);
    color: #fbd472;
    padding: ${isMobile ? '4px 14px' : '6px 18px'};
    border-radius: 20px;
    font-size: ${isMobile ? '11px' : '12.5px'};
    z-index: 90;
    pointer-events: none;
    box-shadow: 0 4px 15px rgba(0,0,0,0.45);
    transition: opacity 0.4s ease;
    white-space: nowrap;
  `;
  document.body.appendChild(hintPill);

  // Visual feedback on cursor while dragging 3D canvas
  renderer.domElement.style.cursor = 'grab';
  renderer.domElement.style.touchAction = 'none';
  controls.addEventListener('start', () => {
    renderer.domElement.style.cursor = 'grabbing';
    hintPill.style.opacity = '0.35';
  });
  controls.addEventListener('end', () => {
    renderer.domElement.style.cursor = 'grab';
  });

  // Setup Postprocessing only when running on hardware WebGL
  let postprocessing: BloomEffect | null = null;
  if (!isSoftwareRenderer && renderer instanceof THREE.WebGLRenderer) {
    try {
      postprocessing = setupPostprocessing(renderer, scene, camera);
      window.addEventListener('resize', () => {
        if (postprocessing) postprocessing.setSize(window.innerWidth, window.innerHeight);
      });
    } catch (postErr) {
      console.warn('Postprocessing indisponível, usando render nativo:', postErr);
    }
  }

  // Setup Interactive GUI
  try {
    const gui = new GUI({ title: 'Controles 3D da Espada' });

    const fAnim = gui.addFolder('Rotação & Geometria 3D');
    fAnim.add(params, 'autoRotate').name('Giro Automático Contínuo');
    fAnim.add(params, 'rotationSpeed', 0.1, 3.0).name('Velocidade do Giro');
    fAnim.add(params, 'referenceTilt').name('Inclinação Arte (13.7°)').onChange((v: boolean) => {
      sword.root.rotation.z = v ? -0.24 : 0.0;
    });
    fAnim.add(params, 'wireframe').name('Modo Malha (Wireframe)').onChange((v: boolean) => {
      Object.values(materials).forEach((m: any) => {
        if (m && 'wireframe' in m) m.wireframe = v;
      });
    });
    fAnim.add(params, 'explodeAmount', 0.0, 1.5).name('Explodir Peças 3D').onChange((v: number) => {
      sword.hiltGroup.position.y = v * 1.5;
      sword.bladeGroup.position.y = -v * 1.5;
      sword.gemGroup.position.z = v * 0.8;
      sword.filigreeGroup.position.z = v * 0.4;
    });
    fAnim.add(params, 'sparkles').name('Partículas Estelares').onChange((v: boolean) => {
      sparkles.points.visible = v;
    });

    const fMat = gui.addFolder('Materiais & Brilho');
    fMat.add(params, 'bladeTransmission', 0.0, 1.0).name('Transparência Cristal').onChange((v: number) => {
      materials.crystalBlade.transmission = v;
    });
    fMat.add(params, 'goldMetalness', 0.3, 1.0).name('Reflexo do Ouro').onChange((v: number) => {
      materials.ornateGold.metalness = v;
      materials.filigreeGold.metalness = v;
    });
    fMat.add(params, 'glowIntensity', 0.0, 2.5).name('Brilho da Lâmina').onChange((v: number) => {
      materials.crystalBladeEdge.emissiveIntensity = v;
      if (materials.innerGlow.uniforms?.intensity) {
        materials.innerGlow.uniforms.intensity.value = v;
      }
    });

    gui.add(params, 'resetView').name('Restaurar Posição Inicial');
    if (isMobile) {
      gui.close();
    }
  } catch (guiErr) {
    console.warn('lil-gui warning:', guiErr);
  }

  // Start in slight 3D perspective angle so depth is immediately obvious, or front
  setCameraPreset('persp');
  viewButtons.forEach(b => {
    b.classList.toggle('active', b.dataset.view === 'persp');
  });

  // Render Loop
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (params.autoRotate && !(window as any).__STOP_ROTATE__) {
      sword.root.rotation.y += delta * params.rotationSpeed * 0.6;
    }

    if (params.sparkles) {
      sparkles.update(delta);
    }

    controls.update();

    if (postprocessing && params.bloomStrength > 0) {
      try {
        postprocessing.render();
      } catch {
        renderer.render(scene, camera);
      }
    } else {
      renderer.render(scene, camera);
    }
  }

  animate();

} catch (initError: any) {
  showError(initError?.message || String(initError));
}
