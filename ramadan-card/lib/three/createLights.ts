import * as THREE from 'three';

export function createLights(scene: THREE.Scene): void {
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffd700, 1.2);
  directional.position.set(5, 8, 5);
  scene.add(directional);

  const fill = new THREE.DirectionalLight(0x4040ff, 0.3);
  fill.position.set(-5, -3, -5);
  scene.add(fill);
}
