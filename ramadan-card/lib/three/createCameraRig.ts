import * as THREE from 'three';

export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  update: (elapsed: number, reducedMotion: boolean) => void;
}

export function createCameraRig(width: number, height: number): CameraRig {
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 0, 5);

  // Orbit parameters
  const orbitRadius = 5;
  const orbitSpeed = 0.08;   // radians per second
  const breatheAmplitude = 0.15;
  const breatheSpeed = 0.4;

  function update(elapsed: number, reducedMotion: boolean) {
    if (reducedMotion) return;

    const angle = elapsed * orbitSpeed;
    const breathe = Math.sin(elapsed * breatheSpeed) * breatheAmplitude;

    camera.position.x = Math.sin(angle) * orbitRadius;
    camera.position.z = Math.cos(angle) * orbitRadius + breathe;
    camera.position.y = Math.sin(elapsed * breatheSpeed * 0.5) * 0.3;

    camera.lookAt(0, 0, 0);
  }

  return { camera, update };
}
