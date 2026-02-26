'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import HeadlineBehind from './HeadlineBehind';
import OverlayLogos from './OverlayLogos';
import Controls from './Controls';
import Toast from './Toast';

// SceneCanvas uses WebGL — must be client-only
const SceneCanvas = dynamic(() => import('./SceneCanvas'), { ssr: false });

type Mode = 'ramadan' | 'eid';

function useReducedMotionPref(): [boolean, () => void] {
  // Start with false to match server-rendered HTML (avoids hydration mismatch).
  // Read browser APIs only in useEffect, after hydration completes.
  const [reduced, setReduced] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem('reducedMotion');
    if (stored !== null) {
      setReduced(stored === 'true');
    } else {
      setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
  }, []);

  const toggle = useCallback(() => {
    setReduced((v) => {
      const next = !v;
      localStorage.setItem('reducedMotion', String(next));
      return next;
    });
  }, []);

  return [reduced, toggle];
}

export default function CardScene() {
  const [mode, setMode] = useState<Mode>('ramadan');
  const [reducedMotion, toggleReducedMotion] = useReducedMotionPref();
  const [toast, setToast] = useState<string | null>(null);
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

  const handleModeToggle = useCallback(() => {
    setMode((m) => (m === 'ramadan' ? 'eid' : 'ramadan'));
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast('Link copied!');
    } catch {
      setToast('Could not copy link');
    }
  }, []);

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  return (
    <div
      ref={cardRef}
      className="relative w-full h-full overflow-hidden bg-[#0d0a1a]"
      onPointerMove={handlePointerMove}
    >
      {/* ── Layer 0: background headline ── */}
      <HeadlineBehind
        mode={mode}
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
            'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(13,10,26,0.65) 100%)',
        }}
      />

      {/* ── Layer 2: logos + controls ── */}
      <OverlayLogos />
      <Controls
        mode={mode}
        reducedMotion={reducedMotion}
        onModeToggle={handleModeToggle}
        onReducedMotionToggle={toggleReducedMotion}
        onShare={handleShare}
      />

      {/* ── Loader ── */}
      {!loaded && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-[#0d0a1a]"
          style={{ zIndex: 10 }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
            <span className="text-white/50 text-sm">Loading scene…</span>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
