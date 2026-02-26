'use client';

export default function OverlayLogos() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 2, padding: 'clamp(16px, 3vw, 40px)' }}
    >
      {/* Top-left logo */}
      <div className="absolute top-0 left-0" style={{ padding: 'clamp(16px, 3vw, 40px)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-1.svg"
          alt="Logo 1"
          className="h-10 sm:h-12 w-auto opacity-90"
          draggable={false}
        />
      </div>

      {/* Top-right logo */}
      <div className="absolute top-0 right-0" style={{ padding: 'clamp(16px, 3vw, 40px)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-2.svg"
          alt="Logo 2"
          className="h-10 sm:h-12 w-auto opacity-90"
          draggable={false}
        />
      </div>
    </div>
  );
}
