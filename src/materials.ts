import * as THREE from 'three';

export interface SwordMaterials {
  crystalBlade: THREE.MeshPhysicalMaterial;
  crystalBladeEdge: THREE.MeshPhysicalMaterial;
  ornateGold: THREE.MeshPhysicalMaterial;
  filigreeGold: THREE.MeshStandardMaterial;
  antiqueBronze: THREE.MeshStandardMaterial;
  silverFiligree: THREE.MeshStandardMaterial;
  diamondGem: THREE.MeshPhysicalMaterial;
  smallDiamond: THREE.MeshPhysicalMaterial;
  crystalGrip: THREE.MeshPhysicalMaterial;
  innerGlow: THREE.ShaderMaterial;
}

export function createSwordMaterials(): SwordMaterials {
  // 1. Inner Blade Bevel (Cool Silver-Platinum Crystal as in reference)
  const crystalBlade = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xa6b0bc),
    emissive: new THREE.Color(0x2c3440),
    emissiveIntensity: 0.32,
    metalness: 0.22,
    roughness: 0.14,
    transmission: 0.62,
    thickness: 0.5,
    ior: 1.85,
    reflectivity: 0.95,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    flatShading: true,
    side: THREE.DoubleSide
  });

  // 2. Luminous Pure White Crystal Outer Edge, Sculpted Volutes & Wing Barbs
  const crystalBladeEdge = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xffffff),
    emissive: new THREE.Color(0xeef6ff),
    emissiveIntensity: 0.88,
    metalness: 0.08,
    roughness: 0.06,
    transmission: 0.25,
    ior: 1.9,
    clearcoat: 1.0,
    flatShading: true,
    side: THREE.DoubleSide
  });

  // 3. Royal Gleaming Gold (Crossguard Crescent Wings, Raised Borders, Pommel Frame)
  const ornateGold = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xffd86b),
    emissive: new THREE.Color(0x5c3d08),
    emissiveIntensity: 0.30,
    metalness: 0.92,
    roughness: 0.15,
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
    reflectivity: 1.0
  });

  // 4. Bright Raised Filigree Scrollwork Gold
  const filigreeGold = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xffe896),
    emissive: new THREE.Color(0x66460c),
    emissiveIntensity: 0.35,
    metalness: 0.88,
    roughness: 0.18
  });

  // 5. Recessed Warm Antique Gold / Bronze Bed (Inside Filigree Panels & Horn Recesses)
  const antiqueBronze = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xb58834),
    emissive: new THREE.Color(0x463008),
    emissiveIntensity: 0.30,
    metalness: 0.72,
    roughness: 0.30
  });

  // 6. Luminous White/Silver Decorative Scrolls & Grip Ridges
  const silverFiligree = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xd8e0ea),
    emissive: new THREE.Color(0x556272),
    emissiveIntensity: 0.38,
    metalness: 0.35,
    roughness: 0.18
  });

  // 7. Central Pear-Cut White Diamond
  const diamondGem = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xf4f8fc),
    emissive: new THREE.Color(0xc8dcf0),
    emissiveIntensity: 0.50,
    metalness: 0.10,
    roughness: 0.04,
    transmission: 0.82,
    thickness: 1.2,
    ior: 2.417,
    clearcoat: 1.0,
    flatShading: true
  });

  // 8. Embedded Small White Diamonds
  const smallDiamond = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xffffff),
    emissive: new THREE.Color(0xe8f4ff),
    emissiveIntensity: 0.75,
    metalness: 0.1,
    roughness: 0.04,
    transmission: 0.65,
    ior: 2.4,
    flatShading: true
  });

  // 9. Fluted White/Silver Crystalline Hilt Grip
  const crystalGrip = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xe6ecf4),
    emissive: new THREE.Color(0x4a5564),
    emissiveIntensity: 0.35,
    metalness: 0.22,
    roughness: 0.16,
    transmission: 0.40,
    thickness: 0.5,
    clearcoat: 0.9,
    flatShading: true
  });

  // 10. Ethereal Fresnel Inner Glow Shader
  const innerGlow = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0xe8f6ff) },
      intensity: { value: 0.65 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 glowColor;
      uniform float intensity;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.2);
        gl_FragColor = vec4(glowColor, fresnel * intensity * 0.45);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  return {
    crystalBlade,
    crystalBladeEdge,
    ornateGold,
    filigreeGold,
    antiqueBronze,
    silverFiligree,
    diamondGem,
    smallDiamond,
    crystalGrip,
    innerGlow
  };
}
