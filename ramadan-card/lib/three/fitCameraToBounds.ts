import * as THREE from 'three';

export function fitCameraToBounds(
  camera: THREE.PerspectiveCamera,
  box: THREE.Box3,
  paddingFactor = 1.4
): void {
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  const cameraZ = (maxDim / 2 / Math.tan(fov / 2)) * paddingFactor;

  camera.position.set(center.x, center.y, center.z + cameraZ);
  camera.near = cameraZ / 100;
  camera.far = cameraZ * 100;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}
