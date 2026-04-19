import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface GameEndTransitionProps {
    onComplete: () => void;
}

export const GameEndTransition = ({ onComplete }: GameEndTransitionProps) => {
    const [showLine1, setShowLine1] = useState(false);
    const [showLine2, setShowLine2] = useState(false);
    const [showLine3, setShowLine3] = useState(false);
    const [showLine4, setShowLine4] = useState(false);
    const [completed, setCompleted] = useState(false);

        // Phase timing - more reliable approach
    useEffect(() => {
        console.log('[GameEndTransition] useEffect, completed:', completed);
        if (completed) return;

        const timer1 = setTimeout(() => { setShowLine1(true); console.log('[GameEndTransition] line1'); }, 0); // 0s
        const timer2 = setTimeout(() => { setShowLine2(true); console.log('[GameEndTransition] line2'); }, 1500); // 1.5s
        const timer3 = setTimeout(() => { setShowLine3(true); console.log('[GameEndTransition] line3'); }, 3000); // 3s
        const timer4 = setTimeout(() => { setShowLine4(true); console.log('[GameEndTransition] line4'); }, 7000); // 7s
        const timerComplete = setTimeout(() => {
            console.log('[GameEndTransition] timerComplete, calling onComplete');
            setCompleted(true);
            onComplete();
        }, 10000); // 10s

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
            clearTimeout(timerComplete);
        };
    }, [onComplete, completed]);

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background overflow-hidden">
            <div className="flex flex-col items-center justify-center gap-6 px-6 text-center">
                {/* Line 1: "Phones down." */}
                <div
                    className="text-4xl font-pixel text-primary tracking-[0.3em] transition-all duration-500"
                    style={{
                        textShadow: "0 0 40px hsl(var(--primary) / 0.8)",
                        opacity: showLine1 ? 1 : 0,
                        transform: showLine1 ? "translateY(0)" : "translateY(20px)",
                    }}
                >
                    PHONES DOWN.
                </div>

                {/* Line 2: "The exam has ended." */}
                <div
                    className="text-lg font-mono text-muted-foreground/80 tracking-widest transition-all duration-500"
                    style={{
                        opacity: showLine2 ? 1 : 0,
                        transform: showLine2 ? "translateY(0)" : "translateY(20px)",
                    }}
                >
                    THE EXAM HAS ENDED.
                </div>

                {/* Line 3: "Somewhere, someone is grading..." with spinner */}
                {showLine3 && (
                    <div
                        className="flex items-center gap-2 text-sm font-mono text-muted-foreground/60 tracking-widest transition-all duration-500"
                        style={{
                            opacity: showLine3 ? 1 : 0,
                            transform: showLine3 ? "translateY(0)" : "translateY(20px)",
                        }}
                    >
                        <span>Somewhere, someone is grading...</span>
                        <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                )}

                {/* Line 4: "Your transcript is ready." with subtle pulse */}
                <div
                    className="text-lg font-pixel text-primary tracking-[0.3em] transition-all duration-500"
                    style={{
                        textShadow: "0 0 40px hsl(var(--primary) / 0.6)",
                        opacity: showLine4 ? 1 : 0,
                        transform: showLine4 ? "scale(1)" : "scale(0.95)",
                    }}
                >
                    {showLine4 && (
                        <span className="animate-pulse">
                            YOUR TRANSCRIPT IS READY.
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};