import { useRef, useEffect, useState, useCallback } from 'react';
import { gradeToLetter, getGradeColor } from '@/lib/gradeSystem';
import { Button } from '@/components/ui/button';
import FireParticleField from '@/components/FireParticleField';
import type { ScoreBreakdownEntry } from '@/lib/gameTypes';

interface GameOverScreenProps {
  winner: string | undefined;
  amWinner: boolean;
  isDraw: boolean;
  isEagle: boolean;
  myState: any;
  displayColor: { name: string; hsl: string } | undefined;
  roleTag: string;
  breakdown: Record<string, ScoreBreakdownEntry>;
  breakdownOrder: string[];
  breakdownOpen: boolean;
  setBreakdownOpen: (v: boolean) => void;
  cooperationScore: number;
  onLeave: () => void;
  hideWinnerLine?: boolean;
  resultNodeOverride?: React.ReactNode;
}

export default function GameOverScreen({
  winner, amWinner, isDraw, isEagle, myState,
  displayColor, roleTag, breakdown, breakdownOrder,
  breakdownOpen, setBreakdownOpen, cooperationScore, onLeave,
  hideWinnerLine = false,
  resultNodeOverride,
}: GameOverScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const [sectionOpacities, setSectionOpacities] = useState([1, 0, 0]);
  const isScrolling = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // IntersectionObserver for fade-in
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);

  useEffect(() => {
    const els = sectionRefs.current.filter(Boolean) as HTMLDivElement[];
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setSectionOpacities((prev) => {
          const next = [...prev];
          entries.forEach((entry) => {
            const idx = els.indexOf(entry.target as HTMLDivElement);
            if (idx >= 0) {
              // Use intersectionRatio for smooth fade
              next[idx] = Math.max(0.05, entry.intersectionRatio);
            }
          });
          return next;
        });
      },
      {
        root: containerRef.current,
        threshold: Array.from({ length: 21 }, (_, i) => i / 20), // 0, 0.05, ... 1.0
      },
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // One scroll = one section step, no skipping, no speed linkage
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!containerRef.current || isScrolling.current) {
      e.preventDefault();
      return;
    }
    const el = containerRef.current;
    const viewH = el.clientHeight;
    const currentSection = Math.round(el.scrollTop / viewH);
    const direction = e.deltaY > 0 ? 1 : -1;
    const targetSection = Math.max(0, Math.min(2, currentSection + direction));

    if (targetSection !== currentSection) {
      isScrolling.current = true;
      el.scrollTo({ top: targetSection * viewH, behavior: 'smooth' });
      // Lock scrolling until animation completes
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => { isScrolling.current = false; }, 600);
    }
  }, []);

  // Handle touch-based scrolling: intercept and snap one section at a time
  const touchStartY = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!containerRef.current || isScrolling.current) return;
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(deltaY) < 30) return; // too small, ignore

    const el = containerRef.current;
    const viewH = el.clientHeight;
    const currentSection = Math.round(el.scrollTop / viewH);
    const direction = deltaY > 0 ? 1 : -1;
    const targetSection = Math.max(0, Math.min(2, currentSection + direction));

    if (targetSection !== currentSection) {
      isScrolling.current = true;
      el.scrollTo({ top: targetSection * viewH, behavior: 'smooth' });
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => { isScrolling.current = false; }, 600);
    }
  }, []);

  // Cleanup timeout
  useEffect(() => {
    return () => { if (scrollTimeout.current) clearTimeout(scrollTimeout.current); };
  }, []);

  return (
    <div className="relative h-dvh" style={{ background: 'hsl(0 0% 3%)' }}>
      {/* Fixed fire background — outside scroll container */}
      <div className="fixed inset-0 z-0">
        <FireParticleField parallaxOffset={parallaxOffset} speedMultiplier={1} />
        <div className="immersive-vignette" />
      </div>

      {/* Scrollable content */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="absolute inset-0 z-10 overflow-y-hidden snap-y snap-mandatory hide-scrollbar"
      >
      {/* ── SIGHT 1: Game Over + Grade + Character Tag ── */}
      <div
        ref={(el) => { sectionRefs.current[0] = el; }}
        className="snap-start h-dvh flex flex-col items-center justify-center relative px-6 z-10"
        style={{
          opacity: sectionOpacities[0],
          transform: `translateY(${(1 - sectionOpacities[0]) * 30}px)`,
          transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
        }}
      >
        <div className="flex flex-col items-center gap-5">
          <h1 className="text-2xl font-pixel text-accent ceremony-title-glow">GAME OVER</h1>

          {!hideWinnerLine && (
            <p
              className="text-lg font-pixel"
              style={{
                color:
                  winner === 'eagle'
                    ? 'hsl(0 80% 55%)'
                    : winner === 'chicks'
                      ? 'hsl(var(--primary))'
                      : 'hsl(var(--accent))',
              }}
            >
              {winner === 'eagle' ? '🦅 Eagle Wins!' : winner === 'chicks' ? '🐤 Chicks Win!' : '🤝 Draw!'}
            </p>
          )}

          <div className="w-16 border-t border-border/30" />

          {/* Grade — chick only */}
          {myState && !isEagle && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-mono text-muted-foreground">Your Grade</span>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold" style={{ color: getGradeColor(myState.health) }}>
                  {gradeToLetter(myState.health)}
                </span>
                <span className="text-sm font-mono text-muted-foreground">({myState.health.toFixed(1)})</span>
              </div>
            </div>
          )}

          {/* Eagle — no grade */}
          {isEagle && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-mono text-muted-foreground">Your Grade</span>
              <span className="text-3xl font-bold text-muted-foreground">N/A</span>
            </div>
          )}

          <div className="w-16 border-t border-border/30" />

          {/* Character Tag */}
          <div
            className="px-4 py-1.5 rounded-full border font-mono text-sm backdrop-blur-sm"
            style={{
              borderColor: `hsl(${displayColor?.hsl ?? '0 0% 50%'} / 0.5)`,
              color: `hsl(${displayColor?.hsl ?? '0 0% 50%'})`,
              background: `hsl(${displayColor?.hsl ?? '0 0% 50%'} / 0.08)`,
            }}
          >
            {isEagle ? '🦅' : '🐤'} {roleTag}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 inset-x-0 mx-auto w-fit flex flex-col items-center gap-1 animate-bounce">
          <span className="text-xs font-mono text-muted-foreground/40">scroll</span>
          <span className="text-muted-foreground/40 text-lg">▼</span>
        </div>
      </div>

      {/* ── SIGHT 2: Action Score + How You Were Measured ── */}
      <div
        ref={(el) => { sectionRefs.current[1] = el; }}
        className="snap-start h-dvh flex flex-col items-center justify-center relative px-6 z-10"
        style={{
          opacity: sectionOpacities[1],
          transform: `translateY(${(1 - sectionOpacities[1]) * 30}px)`,
          transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
        }}
      >
        <div className="flex flex-col items-center gap-5 w-full max-w-sm">
          {/* Action Score — expandable breakdown */}
          {myState && (
            <div className="w-full flex flex-col gap-2">
              <button
                onClick={() => setBreakdownOpen(!breakdownOpen)}
                className="flex items-center justify-between w-full py-3 px-4 rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm"
              >
                <span className="text-sm font-pixel">📊 ACTION SCORE</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-accent">{myState.actionScore.toFixed(0)}</span>
                  <span className="text-xs text-muted-foreground">{breakdownOpen ? '▲' : 'Tap →'}</span>
                </div>
              </button>

              {breakdownOpen && (
                <div className="space-y-1.5 pl-3 border-l-2 border-accent/30 font-mono text-xs mx-2">
                  {breakdownOrder.map((key) => {
                    const entry = breakdown[key];
                    const points = entry?.points ?? 0;
                    const count = entry?.count ?? 0;
                    const fmtPts = points % 1 ? points.toFixed(1) : points.toFixed(0);
                    return (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{entry?.label ?? key}</span>
                        <span className={points > 0 ? 'text-foreground' : 'text-muted-foreground/40'}>
                          +{fmtPts} ({count})
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="w-16 border-t border-border/30" />

          {/* Hidden Metrics — chicks only */}
          {myState && !isEagle && (
            <div className="w-full flex flex-col gap-3 px-4 py-3 rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm">
              <span className="text-sm font-pixel">📈 HOW YOU WERE MEASURED</span>
              <div className="space-y-2 font-mono text-xs text-muted-foreground">
                <div className="flex justify-between"><span>QR Scans</span><span>{myState.scansPerformed ?? 0}</span></div>
                <div className="flex justify-between"><span>Time in Zones</span><span>{Math.floor(myState.timeInZones ?? 0)}s</span></div>
                <div className="flex justify-between"><span>Tips Shared</span><span>{myState.tipsShared ?? 0}</span></div>
                <div className="flex justify-between"><span>Social Circle</span><span>{myState.socialCircleCompleted ? '✓' : '✗'}</span></div>
                <div className="w-full border-t border-border/30 my-1" />
                <div className="flex justify-between font-bold text-foreground text-sm">
                  <span>Cooperation Score</span><span>{cooperationScore}</span>
                </div>
              </div>
            </div>
          )}

          {/* Eagle — simpler metrics */}
          {myState && isEagle && (
            <div className="w-full flex flex-col gap-3 px-4 py-3 rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm">
              <span className="text-sm font-pixel">📈 YOUR IMPACT</span>
              <div className="space-y-2 font-mono text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Damage Dealt</span><span>{breakdown['deal-damage']?.count ?? 0}</span></div>
                <div className="flex justify-between"><span>Chicks Caged</span><span>{breakdown['cage']?.count ?? 0}</span></div>
                <div className="flex justify-between"><span>Props Used</span><span>{breakdown['use-prop']?.count ?? 0}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 inset-x-0 mx-auto w-fit flex flex-col items-center gap-1 animate-bounce">
          <span className="text-xs font-mono text-muted-foreground/40">scroll</span>
          <span className="text-muted-foreground/40 text-lg">▼</span>
        </div>
      </div>

      {/* ── SIGHT 3: Result + Quote + Leave ── */}
      <div
        ref={(el) => { sectionRefs.current[2] = el; }}
        className="snap-start h-dvh flex flex-col items-center justify-center relative px-6 z-10"
        style={{
          opacity: sectionOpacities[2],
          transform: `translateY(${(1 - sectionOpacities[2]) * 30}px)`,
          transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
        }}
      >
        <div className="flex flex-col items-center gap-6">
          {/* Team Result */}
          {resultNodeOverride ?? (
            <>
              {amWinner && !isDraw && <p className="text-2xl font-pixel text-primary text-glow-green">🎉 YOU WIN!</p>}
              {isDraw && <p className="text-2xl font-pixel text-accent ceremony-title-glow">🤝 It's a Draw!</p>}
              {!amWinner && !isDraw && <p className="text-2xl font-pixel text-destructive">You Lose</p>}
            </>
          )}

          <div className="w-16 border-t border-border/30" />

          <p className="text-center text-sm font-mono text-muted-foreground/70 italic px-4 leading-relaxed max-w-xs">
            "In this game, your value was calculated by your actions.
            <br />
            Sound familiar?"
          </p>

          <Button
            variant="outline"
            size="sm"
            onClick={onLeave}
            className="text-xs font-mono mt-4 border-border/40 backdrop-blur-sm"
          >
            LEAVE
          </Button>
        </div>
      </div>
      {/* end scroll container */}
      </div>
    {/* end outer wrapper */}
    </div>
  );
}
