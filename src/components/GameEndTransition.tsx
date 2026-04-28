import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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

  // Line 1 shrink/up styles when line 2 appears
  const line1Shrunk = elapsedMs >= 1500 && !showReady;
  // Line 2 shrink/up styles when line 3 appears
  const line2Shrunk = elapsedMs >= GRADING_START_MS && !showReady;

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
       {/* Line 1 - PHONES DOWN */}
        <div
          className={`transition-all duration-500 ${
            showLine1
              ? line1Shrunk
                ? "text-sm font-mono text-red-400/70 -translate-y-4"
                : "text-3xl md:text-5xl font-pixel text-red-600 translate-y-0"
              : "opacity-0 translate-y-4"
          } ${!showLine1 && "hidden"}`}
          style={{ textShadow: line1Shrunk ? "none" : "0 0 24px rgba(220, 38, 38, 0.5)" }}
        >
          PHONES DOWN
        </div>

        {/* Line 2 - The exam has ended */}
        {showLine2 && (
          <div
            className={`transition-all duration-500 ${
              line2Shrunk
                ? "text-xs font-mono text-red-400/60 -translate-y-2"
                : "text-base md:text-xl font-pixel text-red-500/90"
            } ${!showLine2 && "opacity-0 translate-y-4"}`}
          >
            The exam has ended.
          </div>
        )}

        {/* Line 3 - grading with ONLY dots (no spinner) */}
        {showLine3 && (
          <div
            className={`flex items-center gap-1 text-xs md:text-sm font-mono text-red-400/70 transition-all duration-500 ${
              !showLine3 && "opacity-0 translate-y-4"
            }`}
          >
            <span>{`Somewhere, someone is grading${gradingDots}`}</span>
          </div>
        )}

        {/* Final line - YOUR TRANSCRIPT IS READY */}
        {showReady && (
          <div
            className="text-2xl md:text-4xl font-pixel text-red-600 animate-pulse transition-all duration-500"
            style={{
              textShadow: "0 0 24px rgba(220, 38, 38, 0.45)",
              animation: "fadeInUp 0.6s ease-out, pulse 2s ease-in-out infinite",
            }}
          >
            YOUR TRANSCRIPT IS READY
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