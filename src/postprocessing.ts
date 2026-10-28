import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export interface BloomEffect {
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  setSize: (width: number, height: number) => void;
  render: () => void;
}

export function setupPostprocessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
): BloomEffect {
  const width = window.innerWidth;
  const height = window.innerHeight;

  const renderPass = new RenderPass(scene, camera);

  // Subtle ethereal bloom that enhances emission and high-specular crystal reflections
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.45,  // strength
    0.6,   // radius
    0.72   // threshold (only bright highlights and glow bloom)
  );

  const outputPass = new OutputPass();

  const composer = new EffectComposer(renderer);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);

  function setSize(w: number, h: number) {
    composer.setSize(w, h);
    bloomPass.resolution.set(w, h);
  }

  function render() {
    composer.render();
  }

  return { composer, bloomPass, setSize, render };
}
