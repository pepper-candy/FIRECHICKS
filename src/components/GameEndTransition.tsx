import { useEffect } from "react";

interface GameEndTransitionProps {
  onComplete: () => void;
}

export const GameEndTransition = ({ onComplete }: GameEndTransitionProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 10000); // 10 seconds

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background overflow-hidden">
      {/* Main content centered */}
      <div className="flex flex-col items-center justify-center gap-8">
        {/* Line 1: "Phones down." - fades in at 0s */}
        <div
          className="text-4xl font-pixel text-primary tracking-[0.3em]"
          style={{
            textShadow: "0 0 40px hsl(var(--primary) / 0.8)",
            animation: "fadeIn 0.6s ease-out forwards",
            animationDelay: "0s",
          }}
        >
          PHONES DOWN
        </div>

        {/* Line 2: "The exam has ended." - fades in at 1.5s */}
        <div
          className="text-lg font-mono text-muted-foreground/80 tracking-widest"
          style={{
            animation: "fadeIn 0.6s ease-out forwards",
            animationDelay: "1.5s",
            opacity: 0,
          }}
        >
          THE EXAM HAS ENDED
        </div>

        {/* Line 3: "Somewhere, someone is grading..." - fades in at 3s */}
        <div
          className="text-sm font-mono text-muted-foreground/60 tracking-widest mt-4"
          style={{
            animation: "fadeIn 0.6s ease-out forwards",
            animationDelay: "3s",
            opacity: 0,
          }}
        >
          <span
            style={{
              animation: "cyclePeriods 1.5s steps(3, end) 3s forwards",
              display: "inline-block",
            }}
          >
            SOMEWHERE, SOMEONE IS GRADING<span className="dots">.</span>
          </span>
        </div>

        {/* Line 4: "Your transcript is ready." - fades in at 7s */}
        <div
          className="text-lg font-pixel text-primary tracking-[0.3em] mt-8"
          style={{
            textShadow: "0 0 40px hsl(var(--primary) / 0.6)",
            animation: "fadeIn 0.8s ease-out forwards, pulse 2s ease-in-out 7s infinite",
            animationDelay: "7s",
            opacity: 0,
          }}
        >
          YOUR TRANSCRIPT IS READY
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes cyclePeriods {
          0% { content: "SOMEWHERE, SOMEONE IS GRADING."; }
          33% { content: "SOMEWHERE, SOMEONE IS GRADING.."; }
          66% { content: "SOMEWHERE, SOMEONE IS GRADING..."; }
          100% { content: "SOMEWHERE, SOMEONE IS GRADING..."; }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        .dots {
          animation: cyclePeriods 1.5s steps(3, end) infinite;
        }
      `}</style>
    </div>
  );
};
