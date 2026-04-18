import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface GameEndTransitionProps {
  onComplete: () => void;
  durationMs?: number;
}

export const GameEndTransition = ({
  onComplete,
  durationMs = 10000,
}: GameEndTransitionProps) => {
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<"loading" | "complete">("loading");

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - startTime;
      setElapsed(delta);

      if (delta >= durationMs) {
        setPhase("complete");
        clearInterval(interval);
        // Brief delay before calling onComplete to show completion state
        setTimeout(() => onComplete(), 500);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [durationMs, onComplete]);

  const progress = Math.min(100, (elapsed / durationMs) * 100);

  // Message phases based on elapsed time
  const showPhase1 = elapsed >= 0;
  const showPhase2 = elapsed >= 2000; // 2 seconds
  const showPhase3 = elapsed >= 5000; // 5 seconds
  const showPhase4 = elapsed >= 8000; // 8 seconds

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm overflow-hidden">
      {/* Spinner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <Loader2 className="w-16 h-16 text-primary animate-spin" />
      </motion.div>

      {/* Progress bar */}
      <div className="w-48 h-1 bg-border rounded-full overflow-hidden mb-12">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1, ease: "linear" }}
        />
      </div>

      {/* Message phases */}
      <div className="h-24 flex flex-col items-center justify-center text-center px-6 max-w-md">
        {/* Phase 1: Analyzing exam */}
        {showPhase1 && !showPhase2 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-lg font-pixel text-primary tracking-wider">
              ANALYZING EXAM...
            </p>
            <p className="text-xs font-mono text-muted-foreground mt-2">
              Evaluating your team's submission
            </p>
          </motion.div>
        )}

        {/* Phase 2: Calculating scores */}
        {showPhase2 && !showPhase3 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-lg font-pixel text-accent tracking-wider">
              CALCULATING SCORES...
            </p>
            <p className="text-xs font-mono text-muted-foreground mt-2">
              Computing grade adjustments
            </p>
          </motion.div>
        )}

        {/* Phase 3: Compiling results */}
        {showPhase3 && !showPhase4 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-lg font-pixel text-secondary tracking-wider">
              COMPILING RESULTS...
            </p>
            <p className="text-xs font-mono text-muted-foreground mt-2">
              Tallying final scores
            </p>
          </motion.div>
        )}

        {/* Phase 4: Finalizing */}
        {showPhase4 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-lg font-pixel text-destructive tracking-wider animate-pulse">
              FINALIZING...
            </p>
            <p className="text-xs font-mono text-muted-foreground mt-2">
              Preparing your transcript
            </p>
          </motion.div>
        )}
      </div>

      {/* Percentage counter at bottom */}
      <motion.div
        className="mt-12 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-sm font-mono text-muted-foreground">
          <span className="text-primary font-bold">{Math.floor(progress)}%</span> COMPLETE
        </p>
      </motion.div>
    </div>
  );
};
