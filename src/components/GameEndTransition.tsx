import { useEffect, useMemo, useState } from "react";
import FireParticleField from "@/components/FireParticleField";

interface GameEndTransitionProps {
  onComplete?: () => void;
  variant?: "host" | "client";
}

const GRADING_START_MS = 5000;    // Line 3 at 5 seconds
const READY_START_MS = 10000;     // Final line at 10 seconds
const COMPLETE_MS = 15000;        // End at 15 seconds

export const GameEndTransition = ({ onComplete, variant = "host" }: GameEndTransitionProps) => {
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
  const showLine2 = elapsedMs >= 500 && elapsedMs < READY_START_MS;  // Line 2 at 0.5 seconds
  const showLine3 = elapsedMs >= GRADING_START_MS && elapsedMs < READY_START_MS;
  const showReady = phase === "ready";

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

      {variant === "client" ? (
        <div className="relative z-10 flex items-center justify-center px-6">
          <div className="relative h-32 w-32 md:h-44 md:w-44">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, rgba(220, 38, 38, 0) 0deg, rgba(220, 38, 38, 0.04) 170deg, rgba(220, 38, 38, 0.18) 250deg, rgba(220, 38, 38, 0.55) 320deg, rgba(239, 68, 68, 1) 360deg)",
                animation: "spinnerRotate 1s linear infinite",
                boxShadow: "0 0 32px rgba(220, 38, 38, 0.35)",
              }}
            />
            <div
              className="absolute inset-2 rounded-full blur-md"
              style={{
                background:
                  "conic-gradient(from 0deg, rgba(220, 38, 38, 0) 0deg, rgba(220, 38, 38, 0.02) 200deg, rgba(220, 38, 38, 0.12) 280deg, rgba(248, 113, 113, 0.45) 340deg, rgba(248, 113, 113, 0.8) 360deg)",
                animation: "spinnerRotate 1.6s linear infinite",
              }}
            />
            <div
              className="absolute inset-[22%] rounded-full border border-red-500/15 bg-black/95"
              style={{ boxShadow: "inset 0 0 28px rgba(0, 0, 0, 0.95)" }}
            />
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col items-center justify-center gap-8 px-6 text-center">
          {/* Line 1 - PHONES DOWN (100% size) */}
          <div
            className={`transition-all duration-500 ${
              showLine1
                ? "opacity-100 translate-y-0 animate-fadeInUp"
                : "opacity-0 translate-y-4"
            } ${!showLine1 && "hidden"}`}
            style={{ animation: showLine1 ? "fadeInUp 0.6s ease-out forwards" : "none" }}
          >
            <div
              className="text-3xl md:text-5xl font-pixel text-red-600 whitespace-nowrap"
              style={{ textShadow: "0 0 24px rgba(220, 38, 38, 0.5)" }}
            >
              PHONES DOWN
            </div>
          </div>

          {/* Line 2 - The exam has ended (80% size) */}
          {showLine2 && (
            <div
              className="transition-all duration-500 opacity-100 translate-y-0 animate-fadeInUp"
              style={{ animation: "fadeInUp 0.6s ease-out forwards" }}
            >
              <div
                className="text-2xl md:text-4xl font-pixel text-red-500/90 whitespace-nowrap"
                style={{ textShadow: "0 0 20px rgba(220, 38, 38, 0.4)" }}
              >
                The exam has ended.
              </div>
            </div>
          )}

          {/* Line 3 - grading with dots (70% size, no spinner) */}
          {showLine3 && (
            <div
              className="transition-all duration-500 opacity-100 translate-y-0 animate-fadeInUp"
              style={{ animation: "fadeInUp 0.6s ease-out forwards" }}
            >
              <div
                className="flex items-center gap-1 text-xl md:text-3xl font-pixel text-red-400/80 whitespace-nowrap"
                style={{ textShadow: "0 0 16px rgba(220, 38, 38, 0.3)" }}
              >
                <span>{`Somewhere, someone is grading${gradingDots}`}</span>
              </div>
            </div>
          )}

          {/* Final line - YOUR TRANSCRIPT IS READY (100% size, same as line 1) */}
          {showReady && (
            <div
              className="transition-all duration-500 opacity-100 translate-y-0 animate-fadeInUp"
              style={{ animation: "fadeInUp 0.6s ease-out forwards, pulse 2s ease-in-out infinite" }}
            >
              <div
                className="text-2xl md:text-4xl font-pixel text-red-600 whitespace-nowrap"
                style={{ textShadow: "0 0 24px rgba(220, 38, 38, 0.45)" }}
              >
                YOUR TRANSCRIPT IS READY
              </div>
            </div>
          )}
        </div>
      )}

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

        @keyframes spinnerRotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};
