'use client';

interface HeadlineBehindProps {
  pointerX: number; // -0.5 to 0.5 normalised
  pointerY: number;
  reducedMotion: boolean;
}

export default function HeadlineBehind({
  pointerX,
  pointerY,
  reducedMotion,
}: HeadlineBehindProps) {
  const parallaxX = reducedMotion ? 0 : pointerX * 24;
  const parallaxY = reducedMotion ? 0 : pointerY * 12;

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none"
      style={{ zIndex: 0 }}
    >
      <div
        style={{
          transform: `translate(${parallaxX}px, ${parallaxY}px)`,
          transition: reducedMotion ? 'none' : 'transform 0.1s ease-out',
        }}
        className="flex flex-col items-center gap-6"
      >
        {/* Ramadan Kareem SVG */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/ramadan-kareem.svg"
          alt="Ramadan Kareem"
          className="w-[clamp(364px,71.5vw,1066px)] h-auto opacity-90"
          draggable={false}
        />
        {/* Ramadan SVG */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/ramadan.svg"
          alt="Ramadan"
          className="w-[clamp(182px,28.6vw,442px)] h-auto opacity-80"
          draggable={false}
        />
      </div>
    </div>
  );
}
