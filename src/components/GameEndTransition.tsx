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

  // Line 1 shrink when line 2 appears
  const line1Shrunk = elapsedMs >= 1500 && !showReady;
  // Line 2 shrink when line 3 appears
  const line2Shrunk = elapsedMs >= GRADING_START_MS && !showReady;

  // Container shift to keep newest line centered
  const containerOffset = showReady ? "-8rem" : showLine3 ? "-6rem" : showLine2 ? "-3rem" : "0";

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
      
      {/* Container shifts upward as lines stack */}
      <div 
        className="relative z-10 flex flex-col items-center justify-center gap-4 px-6 text-center transition-transform duration-500"
        style={{ transform: `translateY(${containerOffset})` }}
      >
        {/* Line 1 - PHONES DOWN */}
        <div
          className={`transition-all duration-500 ${
            showLine1
              ? line1Shrunk
                ? "scale-90 text-red-400/70"
                : "scale-100 text-red-600 glow-red"
              : "opacity-0 scale-95"
          } ${!showLine1 && "hidden"}`}
          style={{ textShadow: line1Shrunk ? "none" : "0 0 20px rgba(220, 38, 38, 0.6)" }}
        >
          <div className="text-2xl md:text-4xl font-pixel whitespace-nowrap">
            PHONES DOWN
          </div>
        </div>

        {/* Line 2 - The exam has ended */}
        {showLine2 && (
          <div
            className={`transition-all duration-500 ${
              line2Shrunk
                ? "scale-90 text-red-400/70"
                : "scale-100 text-red-600 glow-red"
            }`}
            style={{ textShadow: line2Shrunk ? "none" : "0 0 20px rgba(220, 38, 38, 0.6)" }}
          >
            <div className="text-2xl md:text-4xl font-pixel whitespace-nowrap">
              The exam has ended.
            </div>
          </div>
        )}

        {/* Line 3 - grading with ONLY dots (no spinner) */}
        {showLine3 && (
          <div
            className={`flex items-center gap-1 transition-all duration-500 ${
              showReady
                ? "scale-90 text-red-400/70"
                : "scale-100 text-red-600 glow-red"
            }`}
            style={{ textShadow: showReady ? "none" : "0 0 20px rgba(220, 38, 38, 0.6)" }}
          >
            <div className="text-2xl md:text-4xl font-pixel whitespace-nowrap">
              {`Somewhere, someone is grading${gradingDots}`}
            </div>
          </div>
        )}

        {/* Final line - YOUR TRANSCRIPT IS READY */}
        {showReady && (
          <div className="text-2xl md:text-4xl font-pixel text-red-600 glow-red animate-pulse transition-all duration-500">
            YOUR TRANSCRIPT IS READY
          </div>
        )}
      </div>
    </div>
  );
};