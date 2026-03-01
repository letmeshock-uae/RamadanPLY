'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import HeadlineBehind from './HeadlineBehind';
import OverlayLogos from './OverlayLogos';
import Toast from './Toast';

// SceneCanvas uses WebGL — must be client-only
const SceneCanvas = dynamic(() => import('./SceneCanvas'), { ssr: false });

function useReducedMotionPref(): [boolean] {
  const [reduced, setReduced] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem('reducedMotion');
    if (stored !== null) {
      setReduced(stored === 'true');
    } else {
      setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
  }, []);

  return [reduced];
}

export default function CardScene() {
  const [reducedMotion] = useReducedMotionPref();
  const [toast] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Pointer tracking for parallax
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPointer({
      x: (e.clientX - rect.left) / rect.width - 0.5,
      y: (e.clientY - rect.top) / rect.height - 0.5,
    });
  }, []);

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  return (
    <div
      ref={cardRef}
      className="relative w-full h-full overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 50%, #13374F 0%, #0C0B19 100%)',
      }}
      onPointerMove={handlePointerMove}
    >
      {/* ── Layer 0: background headline SVGs ── */}
      <HeadlineBehind
        pointerX={pointer.x}
        pointerY={pointer.y}
        reducedMotion={reducedMotion}
      />

      {/* ── Layer 1: 3D canvas ── */}
      <SceneCanvas reducedMotion={reducedMotion} onLoad={handleLoad} />

      {/* ── Vignette overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(12,11,25,0.65) 100%)',
        }}
      />

      {/* ── Layer 2: logos ── */}
      <OverlayLogos />

      {/* ── Loader ── */}
      {!loaded && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 10, background: 'radial-gradient(circle at 50% 50%, #13374F 0%, #0C0B19 100%)' }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
            <span className="text-white/50 text-sm">Loading scene…</span>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && <Toast message={toast} onDone={() => { }} />}
    </div>
  );
}
