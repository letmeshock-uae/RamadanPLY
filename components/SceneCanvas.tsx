'use client';
import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { createRenderer } from '@/lib/three/createRenderer';
import { createCameraRig } from '@/lib/three/createCameraRig';
import { createLights } from '@/lib/three/createLights';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';

interface SceneCanvasProps {
  reducedMotion: boolean;
  onLoad?: () => void;
}

export default function SceneCanvas({ reducedMotion, onLoad }: SceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    let splats: GaussianSplats3D.DropInViewer | null = null;
    let paused = false;

    function onVisibility() {
      paused = document.visibilityState === 'hidden';
    }
    document.addEventListener('visibilitychange', onVisibility);

    // ─── Load Gaussian Splats ─────────────────────────────────────────────
    try {
      // Use DropInViewer which extends THREE.Group
      splats = new GaussianSplats3D.DropInViewer();

      // Flip the model 180 degrees like in the previous implementation
      splats.rotation.z = Math.PI;

      scene.add(splats);

      // Load generic PLY file
      splats.addSplatScene('/models/scene.ply', {
        progressiveLoad: true
      }).then(() => {
        if (!isMounted) return;
        console.log('[Scene] Mkkellogg PLY loaded');

        // We want the model to be larger and lower on the screen.
        // maxDim is just an arbitrary scale factor here.
        const maxDim = 5;
        const fovRad = camera.fov * (Math.PI / 180);

        // Lower multiplier for orbitRadius makes the camera closer (model bigger)
        const orbitRadius = (maxDim / 2 / Math.tan(fovRad / 2)) * 0.7;

        // Lower the Y center of the camera target so the model drops down
        // Positive Y center means camera looks UP, pushing the model DOWN.
        const center = new THREE.Vector3(0, maxDim * 0.4, 0);

        rig.setOrbit(center, orbitRadius);

        camera.near = orbitRadius / 100;
        camera.far = orbitRadius * 100;
        camera.updateProjectionMatrix();

        onLoad?.();
      }).catch((err: any) => {
        console.error('[SceneCanvas] Mkkellogg Splat load error:', err);
        onLoad?.();
      });

    } catch (err) {
      console.error('[SceneCanvas] Splat init error:', err);
      onLoad?.();
    }

    // ─── Render loop ──────────────────────────────────────────────────────
    const startTime = performance.now();

    function animate() {
      if (!isMounted) return;
      animId = requestAnimationFrame(animate);
      if (paused) return;

      const elapsed = (performance.now() - startTime) / 1000;
      updateCamera(elapsed, reducedMotion);

      renderer.render(scene, camera);
    }
    animate();

    // ─── Cleanup ──────────────────────────────────────────────────────────
    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      if (splats) {
        splats.dispose();
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
