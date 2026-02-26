'use client';

interface ControlsProps {
  mode: 'ramadan' | 'eid';
  reducedMotion: boolean;
  onModeToggle: () => void;
  onReducedMotionToggle: () => void;
  onShare: () => void;
}

export default function Controls({
  mode,
  reducedMotion,
  onModeToggle,
  onReducedMotionToggle,
  onShare,
}: ControlsProps) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3
                 pb-[clamp(16px,3vw,40px)] px-4"
      style={{ zIndex: 2 }}
    >
      {/* Mode toggle */}
      <button
        onClick={onModeToggle}
        className="rounded-full bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm
                   px-4 py-2 backdrop-blur-sm border border-white/20 transition-all
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        aria-label={`Switch to ${mode === 'ramadan' ? 'Eid Mubarak' : 'Ramadan Kareem'}`}
      >
        {mode === 'ramadan' ? '🌙 Eid Mubarak' : '✨ Ramadan Kareem'}
      </button>

      {/* Reduced motion toggle */}
      <button
        onClick={onReducedMotionToggle}
        className="rounded-full bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm
                   px-4 py-2 backdrop-blur-sm border border-white/20 transition-all
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        aria-label={`${reducedMotion ? 'Enable' : 'Disable'} motion`}
        aria-pressed={reducedMotion}
      >
        {reducedMotion ? '▶ Motion On' : '⏸ Reduce Motion'}
      </button>

      {/* Share button */}
      <button
        onClick={onShare}
        className="rounded-full bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm
                   px-4 py-2 backdrop-blur-sm border border-white/20 transition-all
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        aria-label="Share this page"
      >
        📤 Share
      </button>
    </div>
  );
}
