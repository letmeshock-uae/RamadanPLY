import * as THREE from 'three';

export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  update: (elapsed: number, reducedMotion: boolean) => void;
  /** Update orbit center and radius after scene bounds are known. */
  setOrbit: (center: THREE.Vector3, radius: number) => void;
}

export function createCameraRig(width: number, height: number): CameraRig {
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);

  // Orbit state — updated via setOrbit() once PLY bounds are known
  const orbitCenter = new THREE.Vector3(0, 0, 0);
  let orbitRadius = 5;

  const orbitSpeed = 0.08;   // rad/s
  const breatheAmplitude = 0.06; // fraction of orbitRadius
  const breatheSpeed = 0.4;

  // Start camera at a sensible default
  camera.position.set(0, 0, orbitRadius);

  function setOrbit(center: THREE.Vector3, radius: number) {
    orbitCenter.copy(center);
    orbitRadius = radius;
    // Position immediately so the first rendered frame is correct
    camera.position.set(center.x, center.y, center.z + radius);
    camera.lookAt(orbitCenter);
  }

  function update(elapsed: number, reducedMotion: boolean) {
    if (reducedMotion) {
      camera.lookAt(orbitCenter);
      return;
    }

    const angle = elapsed * orbitSpeed;
    const breathe = Math.sin(elapsed * breatheSpeed) * orbitRadius * breatheAmplitude;

    camera.position.x = orbitCenter.x + Math.sin(angle) * orbitRadius;
    camera.position.z = orbitCenter.z + Math.cos(angle) * orbitRadius + breathe;
    camera.position.y = orbitCenter.y + Math.sin(elapsed * breatheSpeed * 0.5) * orbitRadius * 0.08;

    camera.lookAt(orbitCenter);
  }

  return { camera, update, setOrbit };
}
