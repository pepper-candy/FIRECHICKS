import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

interface GameEndTransitionProps {
  onComplete: () => void;
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
        onComplete();
      }
    }, 100);

    return () => window.clearInterval(tick);
  }, [onComplete]);

  const phase = useMemo(() => (elapsedMs >= READY_START_MS ? "ready" : "grading"), [elapsedMs]);
  const gradingDots = useMemo(() => {
    if (elapsedMs < GRADING_START_MS || elapsedMs >= READY_START_MS) return "";
    return ".".repeat(((Math.floor((elapsedMs - GRADING_START_MS) / 500) % 3) + 1));
  }, [elapsedMs]);

  const showLine1 = elapsedMs >= 0 && elapsedMs < READY_START_MS;
  const showLine2 = elapsedMs >= 1500 && elapsedMs < READY_START_MS;
  const showLine3 = elapsedMs >= GRADING_START_MS && elapsedMs < READY_START_MS;
  const showReady = phase === "ready";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(255, 68, 51, 0.12) 0%, rgba(0, 0, 0, 0.96) 58%, rgba(0, 0, 0, 1) 100%)",
        }}
      />
      <div className="relative z-10 flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div
          className={`text-3xl md:text-5xl font-pixel text-primary transition-all duration-500 ${
            showLine1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ textShadow: "0 0 24px hsl(var(--primary) / 0.5)" }}
        >
          PHONES DOWN
        </div>

        <div
          className={`text-base md:text-xl font-pixel text-primary/90 transition-all duration-500 ${
            showLine2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          The exam has ended.
        </div>

        <div
          className={`flex items-center gap-2 text-xs md:text-sm font-mono text-muted-foreground transition-all duration-500 ${
            showLine3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <span>{`Somewhere, someone is grading${gradingDots}`}</span>
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>

        <div
          className={`text-2xl md:text-4xl font-pixel text-primary transition-all duration-500 ${
            showReady ? "opacity-100 scale-100" : "opacity-0 scale-95"
          } ${showReady ? "animate-pulse" : ""}`}
          style={{ textShadow: "0 0 24px hsl(var(--primary) / 0.45)" }}
        >
          Your transcript is ready.
        </div>
      </div>
    </div>
  );
};
