import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface GameEndTransitionProps {
    onComplete: () => void;
}

export const GameEndTransition = ({ onComplete }: GameEndTransitionProps) => {
    const [phase, setPhase] = useState(0);

    // Phase timing
    useEffect(() => {
        const timers: NodeJS.Timeout[] = [];

        // Phase 0 -> 1: after 1.5s
        timers.push(setTimeout(() => setPhase(1), 1500));
        // Phase 1 -> 2: after 1.5s (total 3s)
        timers.push(setTimeout(() => setPhase(2), 3000));
        // Phase 2 -> 3: after 4s (total 7s)
        timers.push(setTimeout(() => setPhase(3), 7000));
        // Phase 3 -> complete: after 3s (total 10s)
        timers.push(setTimeout(() => onComplete(), 10000));

        return () => timers.forEach(clearTimeout);
    }, [onComplete]);

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background overflow-hidden">
            <div className="flex flex-col items-center justify-center gap-6 px-6 text-center">
                {/* Line 1: "Phones down." */}
                <div
                    className="text-4xl font-pixel text-primary tracking-[0.3em] transition-all duration-500"
                    style={{
                        textShadow: "0 0 40px hsl(var(--primary) / 0.8)",
                        opacity: phase >= 0 ? 1 : 0,
                        transform: phase >= 0 ? "translateY(0)" : "translateY(20px)",
                    }}
                >
                    PHONES DOWN.
                </div>

                {/* Line 2: "The exam has ended." */}
                <div
                    className="text-lg font-mono text-muted-foreground/80 tracking-widest transition-all duration-500"
                    style={{
                        opacity: phase >= 1 ? 1 : 0,
                        transform: phase >= 1 ? "translateY(0)" : "translateY(20px)",
                    }}
                >
                    THE EXAM HAS ENDED.
                </div>

                {/* Line 3: "Somewhere, someone is grading..." with spinner */}
                <div
                    className="flex items-center gap-2 text-sm font-mono text-muted-foreground/60 tracking-widest transition-all duration-500"
                    style={{
                        opacity: phase >= 2 ? 1 : 0,
                        transform: phase >= 2 ? "translateY(0)" : "translateY(20px)",
                    }}
                >
                    <span>Somewhere, someone is grading...</span>
                    <Loader2 className="w-4 h-4 animate-spin" />
                </div>

                {/* Line 4: "Your transcript is ready." with subtle pulse */}
                <div
                    className="text-lg font-pixel text-primary tracking-[0.3em] mt-8 animate-pulse"
                    style={{
                        textShadow: "0 0 40px hsl(var(--primary) / 0.6)",
                        opacity: phase >= 3 ? 1 : 0,
                        transform: phase >= 3 ? "scale(1)" : "scale(0.95)",
                        animation: phase >= 3 ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
                    }}
                >
                    YOUR TRANSCRIPT IS READY.
                </div>
            </div>
        </div>
    );
};