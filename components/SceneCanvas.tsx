'use client';
import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { createRenderer } from '@/lib/three/createRenderer';
import { createCameraRig } from '@/lib/three/createCameraRig';
import { createLights } from '@/lib/three/createLights';
import { loadPly } from '@/lib/ply/loadPly';
import { SplatRenderer } from '@/lib/three/splat/SplatRenderer';

interface SceneCanvasProps {
  reducedMotion: boolean;
  onLoad?: () => void;
}

export default function SceneCanvas({ reducedMotion, onLoad }: SceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mountedRef = useRef(true);

  const setupScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return () => { };

    let isMounted = true;

    // ─── Renderer ─────────────────────────────────────────────────────────
    const renderer = createRenderer(canvas);
    const scene = new THREE.Scene();
    const rig = createCameraRig(canvas.clientWidth, canvas.clientHeight);
    const { camera, update: updateCamera } = rig;

    createLights(scene);

    // ─── Resize handler ───────────────────────────────────────────────────
    let animId = 0;
    function onResize() {
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    let splatRenderer: SplatRenderer | null = null;
    let pointCloud: THREE.Points | null = null;
    let paused = false;

    function onVisibility() {
      paused = document.visibilityState === 'hidden';
    }
    document.addEventListener('visibilitychange', onVisibility);

    // ─── Load PLY (Async) ─────────────────────────────────────────────────
    (async () => {
      try {
        const plyData = await loadPly('/models/scene.ply');
        if (!isMounted) return;

        const { arrays, is3dgs, vertexCount } = plyData;

        if (is3dgs && vertexCount > 0) {
          splatRenderer = new SplatRenderer(arrays);
          splatRenderer.mesh.rotation.z = Math.PI; // Flip model 180 degrees
          scene.add(splatRenderer.mesh);
        } else {
          const geometry = new THREE.BufferGeometry();
          const x = arrays['x'] ?? new Float32Array(0);
          const y = arrays['y'] ?? new Float32Array(0);
          const z = arrays['z'] ?? new Float32Array(0);
          const pos = new Float32Array(vertexCount * 3);
          for (let i = 0; i < vertexCount; i++) {
            pos[i * 3] = x[i]; pos[i * 3 + 1] = y[i]; pos[i * 3 + 2] = z[i];
          }
          geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));

          const r = arrays['red'] ?? arrays['diffuse_red'];
          const g = arrays['green'] ?? arrays['diffuse_green'];
          const b = arrays['blue'] ?? arrays['diffuse_blue'];
          if (r && g && b) {
            const col = new Float32Array(vertexCount * 3);
            const isUchar = r[0] > 1.0;
            for (let i = 0; i < vertexCount; i++) {
              col[i * 3] = isUchar ? r[i] / 255 : r[i];
              col[i * 3 + 1] = isUchar ? g[i] / 255 : g[i];
              col[i * 3 + 2] = isUchar ? b[i] / 255 : b[i];
            }
            geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
          }

          const material = new THREE.PointsMaterial({
            size: 0.02,
            sizeAttenuation: true,
            vertexColors: !!(r && g && b),
            color: r && g && b ? 0xffffff : 0xffd580,
            transparent: true,
            opacity: 0.85,
          });
          pointCloud = new THREE.Points(geometry, material);
          scene.add(pointCloud);
        }

        console.log(`[Scene] PLY loaded: ${vertexCount} vertices, is3dgs=${is3dgs}`);

        const targetObj = is3dgs ? splatRenderer!.mesh : pointCloud!;
        const box = new THREE.Box3().setFromObject(targetObj);

        if (box.isEmpty()) {
          console.warn('[Scene] Bounding box is empty — no geometry found');
        } else {
          const center = new THREE.Vector3();
          const size = new THREE.Vector3();
          box.getCenter(center);
          box.getSize(size);

          const maxDim = Math.max(size.x, size.y, size.z);
          const fovRad = camera.fov * (Math.PI / 180);
          const orbitRadius = (maxDim / 2 / Math.tan(fovRad / 2)) * 1.4;

          // Shift camera target up so the model is positioned lower in the viewport
          center.y += maxDim * 0.15;

          rig.setOrbit(center, orbitRadius);

          camera.near = orbitRadius / 100;
          camera.far = orbitRadius * 100;
          camera.updateProjectionMatrix();

          if (splatRenderer) {
            splatRenderer.setPointScale(maxDim * 0.5);
          }
        }

        onLoad?.();

        // ─── Render loop ──────────────────────────────────────────────────────
        const startTime = performance.now();

        function animate() {
          if (!isMounted) return;
          animId = requestAnimationFrame(animate);
          if (paused) return;

          const elapsed = (performance.now() - startTime) / 1000;
          updateCamera(elapsed, reducedMotion);

          if (splatRenderer) splatRenderer.sort(camera);

          renderer.render(scene, camera);
        }
        animate();

      } catch (err) {
        console.error('[SceneCanvas] PLY load error:', err);
        onLoad?.();
      }
    })();

    // ─── Cleanup ──────────────────────────────────────────────────────────
    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      if (splatRenderer) splatRenderer.dispose();
      if (pointCloud) {
        pointCloud.geometry.dispose();
        if (pointCloud.material) (pointCloud.material as THREE.Material).dispose();
      }
      renderer.dispose();
    };
  }, [reducedMotion, onLoad]);

  useEffect(() => {
    const cleanup = setupScene();
    return () => cleanup();
  }, [setupScene]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 1 }}
      aria-label="3D Gaussian Splat scene"
    />
  );
}
