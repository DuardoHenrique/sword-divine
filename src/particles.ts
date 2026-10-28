import * as THREE from 'three';

/**
 * Creates the divine starry sparkles that float and twinkle around the sword,
 * matching the magical starlight aura in the reference illustration.
 */
export function createDivineSparkles(): { points: THREE.Points; update: (delta: number) => void } {
  const count = 180;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);

  // Sparkles clustered around the blade and guard
  for (let i = 0; i < count; i++) {
    // Y distribution: along the blade (-6.8 to 0) and guard/pommel (0 to 3.2)
    const y = -6.8 + Math.random() * 9.8;
    
    // Spread X: wider near the blade edges, tighter near tip
    const bladeProgress = (-y) / 7.0; // 0 at guard, 1 at tip
    const maxRadius = (y < 0) 
      ? 0.3 + 1.2 * Math.sin(Math.max(0, Math.min(Math.PI, bladeProgress * Math.PI)))
      : 1.8 * Math.random();

    const angle = Math.random() * Math.PI * 2;
    const r = (0.2 + Math.random() * 0.9) * maxRadius;

    positions[i * 3 + 0] = Math.cos(angle) * r;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.8;

    scales[i] = 0.5 + Math.random() * 1.5;
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 1.5 + Math.random() * 2.5;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

  // Procedural 4-point sparkle texture
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Radial glow
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.2, 'rgba(230, 245, 255, 0.8)');
  grad.addColorStop(0.5, 'rgba(180, 220, 255, 0.2)');
  grad.addColorStop(1, 'rgba(180, 220, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  // 4-pointed cross star flare
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(64, 10);
  ctx.lineTo(64, 118);
  ctx.moveTo(10, 64);
  ctx.lineTo(118, 64);
  ctx.stroke();

  // Diagonal smaller flare
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(32, 32);
  ctx.lineTo(96, 96);
  ctx.moveTo(32, 96);
  ctx.lineTo(96, 32);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);

  const material = new THREE.PointsMaterial({
    size: 0.35,
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: 0xffffff,
  });

  const points = new THREE.Points(geometry, material);

  let time = 0;
  function update(delta: number) {
    time += delta;
    const pos = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      // Gentle floating up and pulse
      const phase = phases[i];
      const speed = speeds[i];
      const twinkle = Math.sin(time * speed + phase);
      
      // Twinkle opacity through vertex scale or z oscillation
      pos[i * 3 + 2] += Math.sin(time * 0.8 + i) * 0.001;
      
      // Slow upward drift
      pos[i * 3 + 1] += 0.002 * (1.0 + Math.sin(i));
      if (pos[i * 3 + 1] > 3.5) {
        pos[i * 3 + 1] = -6.8;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  }

  return { points, update };
}
