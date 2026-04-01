import { useMemo } from 'react';

function getTraceGradient(colorType: number): string {
  switch (colorType % 6) {
    case 0:
      return `linear-gradient(to top, rgba(255,68,51,0.95) 0%, rgba(255,68,51,0.5) 28%, rgba(204,51,34,0.12) 58%, transparent 100%)`;
    case 1:
      return `linear-gradient(to top, rgba(255,120,77,0.95) 0%, rgba(255,94,77,0.5) 28%, rgba(255,68,51,0.12) 58%, transparent 100%)`;
    case 2:
      return `linear-gradient(to top, rgba(255,140,77,0.95) 0%, rgba(255,120,77,0.5) 28%, rgba(255,94,77,0.12) 58%, transparent 100%)`;
    case 3:
      return `linear-gradient(to top, rgba(255,107,53,0.95) 0%, rgba(255,94,77,0.5) 28%, rgba(255,68,51,0.12) 58%, transparent 100%)`;
    case 4:
      return `linear-gradient(to top, rgba(255,159,67,0.95) 0%, rgba(255,140,77,0.5) 28%, rgba(255,120,77,0.12) 58%, transparent 100%)`;
    default:
      return `linear-gradient(to top, rgba(255,183,77,0.95) 0%, rgba(255,159,67,0.5) 28%, rgba(255,140,77,0.12) 58%, transparent 100%)`;
  }
}

/**
 * Rising fire trace particle field — reusable across pages.
 * Uses `position: fixed` so it sits behind content.
 * Pass `parallaxOffset` (px) to shift vertically for a parallax effect.
 */
export default function FireParticleField({
  parallaxOffset = 0,
  speedMultiplier = 1,
}: {
  parallaxOffset?: number;
  speedMultiplier?: number;
}) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const lineCount = isMobile ? 28 : 44;

  const traces = useMemo(
    () =>
      Array.from({ length: lineCount }, (_, i) => {
        const colorType = i % 6;
        const baseDuration = 5.5 + (i % 5) * 0.35;
        const staggerWindow = 4.8;
        const delay = (i / lineCount) * staggerWindow;
        return { id: i, colorType, baseDuration, delay };
      }),
    [lineCount],
  );

  return (
    <div
      className="fixed inset-0 z-0 flex pointer-events-none overflow-hidden"
      style={{ transform: `translateY(${parallaxOffset}px)` }}
    >
      {traces.map((t) => {
        const duration = t.baseDuration / Math.max(0.3, speedMultiplier);
        return (
          <div key={t.id} className="relative h-full min-w-0 flex-1 flex justify-center">
            <div
              className="absolute bottom-0 w-[2px] rounded-full"
              style={{
                height: 'min(32vh, 220px)',
                background: getTraceGradient(t.colorType),
                boxShadow: '0 0 8px rgba(255, 68, 51, 0.4)',
                animation: `flame-trace-rise ${duration}s linear ${t.delay}s infinite`,
                willChange: 'transform',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
