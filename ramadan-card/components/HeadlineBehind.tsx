'use client';
import { playfair } from '@/app/fonts';

interface HeadlineBehindProps {
  mode: 'ramadan' | 'eid';
  pointerX: number; // -0.5 to 0.5 normalised
  pointerY: number;
  reducedMotion: boolean;
}

export default function HeadlineBehind({
  mode,
  pointerX,
  pointerY,
  reducedMotion,
}: HeadlineBehindProps) {
  const parallaxX = reducedMotion ? 0 : pointerX * 24;
  const parallaxY = reducedMotion ? 0 : pointerY * 12;

  const mainText = mode === 'ramadan' ? 'Ramadan Kareem' : 'Eid Mubarak';
  const arabicText = mode === 'ramadan' ? 'رمضان كريم' : 'عيد مبارك';

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
        className="text-center"
      >
        <h1
          className={`${playfair.className} text-[clamp(3rem,10vw,9rem)] font-bold leading-none
                       text-white/15 tracking-wide`}
          aria-label={mainText}
        >
          {mainText}
        </h1>
        <p
          className={`${playfair.className} text-[clamp(1.5rem,4vw,4rem)] font-medium
                       text-white/10 mt-2 tracking-widest`}
          dir="rtl"
          aria-hidden="true"
        >
          {arabicText}
        </p>
      </div>
    </div>
  );
}
