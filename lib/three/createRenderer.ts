import * as THREE from 'three';

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,        // transparent canvas so background text shows through
    powerPreference: 'high-performance',
  });

  // Cap DPR for performance
  const dpr = Math.min(window.devicePixelRatio, 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setClearColor(0x000000, 0); // fully transparent clear

  return renderer;
}
