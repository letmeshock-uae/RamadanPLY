'use client';

export default function OverlayLogos() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 2, padding: 'clamp(16px, 3vw, 40px)' }}
    >
      {/* Top-left: Datum logo */}
      <div className="absolute top-0 left-0" style={{ padding: 'clamp(16px, 3vw, 40px)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/datum.svg"
          alt="Datum"
          className="h-[27px] sm:h-8 w-auto opacity-90"
          draggable={false}
        />
      </div>

      {/* Top-right: Al Ain Museum logo */}
      <div className="absolute top-0 right-0" style={{ padding: 'clamp(16px, 3vw, 40px)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/alainmuseum.svg"
          alt="Al Ain Museum"
          className="h-10 sm:h-12 w-auto opacity-90"
          draggable={false}
        />
      </div>
    </div>
  );
}
