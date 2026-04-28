import { useEffect, useMemo, useState } from "react";
import FireParticleField from "@/components/FireParticleField";

interface GameEndTransitionProps {
  onComplete?: () => void;
}

const GRADING_START_MS = 3000;
const READY_START_MS = 7000;
const COMPLETE_MS = 11000;

export const GameEndTransition = ({ onComplete }: GameEndTransitionProps) => {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      const nextElapsed = Date.now() - startedAt;
      setElapsedMs(nextElapsed);
      if (nextElapsed >= COMPLETE_MS) {
        window.clearInterval(tick);
        onComplete?.();
      }
    }, 100);

    return () => window.clearInterval(tick);
  }, [onComplete]);

  const phase = useMemo(() => (elapsedMs >= READY_START_MS ? "ready" : "grading"), [elapsedMs]);
  const gradingDots = useMemo(() => {
    if (elapsedMs < GRADING_START_MS || elapsedMs >= READY_START_MS) return "";
    return ".".repeat(((Math.floor((elapsedMs - GRADING_START_MS) / 500) % 3) + 1));
  }, [elapsedMs]);

  // Line visibility
  const showLine1 = elapsedMs >= 0 && elapsedMs < READY_START_MS;
  const showLine2 = elapsedMs >= 1500 && elapsedMs < READY_START_MS;
  const showLine3 = elapsedMs >= GRADING_START_MS && elapsedMs < READY_START_MS;
  const showReady = phase === "ready";

  // No size change over time – each line keeps its fixed size
  // Only visibility changes

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black">
      {/* Fire particle background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <FireParticleField />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(255, 68, 51, 0.12) 0%, rgba(0, 0, 0, 0.96) 58%, rgba(0, 0, 0, 1) 100%)",
        }}
      />
      <div className="relative z-10 flex flex-col items-center justify-center gap-3 px-6 text-center">
        {/* Line 1 - PHONES DOWN (100% size) */}
        <div
          className={`transition-all duration-500 ${
            showLine1
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          } ${!showLine1 && "hidden"}`}
        >
          <div className="text-3xl md:text-5xl font-pixel text-red-600 whitespace-nowrap"
            style={{ textShadow: "0 0 24px rgba(220, 38, 38, 0.5)" }}>
            PHONES DOWN
          </div>
        </div>

        {/* Line 2 - The exam has ended (80% size) */}
        {showLine2 && (
          <div className="transition-all duration-500 opacity-100 translate-y-0">
            <div className="text-2xl md:text-4xl font-pixel text-red-500/90 whitespace-nowrap"
              style={{ textShadow: "0 0 20px rgba(220, 38, 38, 0.4)" }}>
              The exam has ended.
            </div>
          </div>
        )}

        {/* Line 3 - grading with dots (70% size, no spinner) */}
        {showLine3 && (
          <div className="transition-all duration-500 opacity-100 translate-y-0">
            <div className="flex items-center gap-1 text-xl md:text-3xl font-pixel text-red-400/80 whitespace-nowrap"
              style={{ textShadow: "0 0 16px rgba(220, 38, 38, 0.3)" }}>
              <span>{`Somewhere, someone is grading${gradingDots}`}</span>
            </div>
          </div>
        )}

        {/* Final line - YOUR TRANSCRIPT IS READY (100% size, same as line 1) */}
        {showReady && (
          <div className="transition-all duration-500 opacity-100 translate-y-0">
            <div className="text-2xl md:text-4xl font-pixel text-red-600 animate-pulse whitespace-nowrap"
              style={{
                textShadow: "0 0 24px rgba(220, 38, 38, 0.45)",
                animation: "fadeInUp 0.6s ease-out, pulse 2s ease-in-out infinite",
              }}>
              YOUR TRANSCRIPT IS READY
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};