'use client';
import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { createRenderer } from '@/lib/three/createRenderer';
import { createCameraRig } from '@/lib/three/createCameraRig';
import { createLights } from '@/lib/three/createLights';
import { fitCameraToBounds } from '@/lib/three/fitCameraToBounds';
import { loadPly } from '@/lib/ply/loadPly';
import { SplatRenderer } from '@/lib/three/splat/SplatRenderer';

interface SceneCanvasProps {
  reducedMotion: boolean;
  onLoad?: () => void;
}

export default function SceneCanvas({ reducedMotion, onLoad }: SceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mountedRef = useRef(true);

  const setupScene = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ─── Renderer ─────────────────────────────────────────────────────────
    const renderer = createRenderer(canvas);
    const scene = new THREE.Scene();
    const rig = createCameraRig(canvas.clientWidth, canvas.clientHeight);
    const { camera, update: updateCamera } = rig;

    createLights(scene);

    // ─── Resize handler ───────────────────────────────────────────────────
    let animId = 0;
    function onResize() {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    // ─── Loader placeholder ───────────────────────────────────────────────
    let splatRenderer: SplatRenderer | null = null;
    let pointCloud: THREE.Points | null = null;

    // ─── Load PLY ─────────────────────────────────────────────────────────
    try {
      const plyData = await loadPly('/models/scene.ply');
      if (!mountedRef.current) return;

      const { arrays, is3dgs, vertexCount } = plyData;

      if (is3dgs && vertexCount > 0) {
        // Path A — 3DGS splat rendering
        splatRenderer = new SplatRenderer(arrays);
        scene.add(splatRenderer.mesh);
      } else {
        // Path B — point cloud fallback
        const geometry = new THREE.BufferGeometry();
        const x = arrays['x'] ?? new Float32Array(0);
        const y = arrays['y'] ?? new Float32Array(0);
        const z = arrays['z'] ?? new Float32Array(0);
        const pos = new Float32Array(vertexCount * 3);
        for (let i = 0; i < vertexCount; i++) {
          pos[i * 3] = x[i];
          pos[i * 3 + 1] = y[i];
          pos[i * 3 + 2] = z[i];
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));

        // Color attribute if present
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

      // Fit camera to scene bounds
      const box = new THREE.Box3().setFromObject(is3dgs ? splatRenderer!.mesh : pointCloud!);
      if (!box.isEmpty()) {
        fitCameraToBounds(camera, box);
      }

      onLoad?.();
    } catch (err) {
      console.error('[SceneCanvas] PLY load error:', err);
      onLoad?.(); // hide loader even on error
    }

    // ─── Render loop ──────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let paused = false;

    function onVisibility() {
      paused = document.visibilityState === 'hidden';
    }
    document.addEventListener('visibilitychange', onVisibility);

    function animate() {
      animId = requestAnimationFrame(animate);
      if (paused) return;

      const elapsed = clock.getElapsedTime();
      updateCamera(elapsed, reducedMotion);

      if (splatRenderer) {
        splatRenderer.sort(camera);
      }

      renderer.render(scene, camera);
    }
    animate();

    // ─── Cleanup ──────────────────────────────────────────────────────────
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(animId);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      splatRenderer?.dispose();
      pointCloud?.geometry.dispose();
      (pointCloud?.material as THREE.Material | undefined)?.dispose();
      renderer.dispose();
    };
  }, [reducedMotion, onLoad]);

  useEffect(() => {
    mountedRef.current = true;
    let cleanup: (() => void) | undefined;
    setupScene().then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
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
