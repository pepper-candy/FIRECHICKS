import { useState, useEffect, useRef } from 'react';
import type { GameStage } from '@/lib/gameTypes';

const STAGE_INFO: Record<number, { title: string; instruction: string; icon: string }> = {
  0: { title: 'Social Circle',  instruction: 'Meet ALL other Chicks! 🐣',                           icon: '🤝' },
  1: { title: 'Exam Tips',      instruction: 'Get TIPS from glowing buildings, then SHARE!',         icon: '📍' },
  2: { title: 'Share Tips',     instruction: 'Share your tips with everyone!',                       icon: '🔗' },
  3: { title: 'Final Exam',     instruction: 'Run to any building and finish the EXAM!',             icon: '📝' },
};

const DISPLAY_MS = 15_000;

interface Props {
  stage: GameStage;
  onDismiss: () => void;
  immersive?: boolean;
}

export default function StageTransition({ stage, onDismiss, immersive = false }: Props) {
  const [visible, setVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [flash, setFlash] = useState(false);
  const mountedAtRef = useRef(Date.now());
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  // Slide in shortly after mount
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(id);
  }, []);

  // Single flash burst on mount
  useEffect(() => {
    if (!immersive) return;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 500);
    return () => clearTimeout(id);
  }, [immersive]);

  // Drive the countdown + auto-dismiss
  useEffect(() => {
    const id = setInterval(() => {
      const ms = Date.now() - mountedAtRef.current;
      setElapsed(ms);
      if (ms >= DISPLAY_MS) onDismissRef.current();
    }, 100);
    return () => clearInterval(id);
  }, []);

  const info = STAGE_INFO[stage as number] ?? STAGE_INFO[0];
  const remainingMs = Math.max(0, DISPLAY_MS - elapsed);
  const sec = Math.ceil(remainingMs / 1000);
  const progress = remainingMs / DISPLAY_MS; // 1 → 0

  // ── Immersive full-width banner variant ──────────────────────────────────────
  if (immersive) {
    return (
      <>
        {/* Subtle full-screen flash on stage change */}
        {flash && (
          <div
            className="fixed inset-0 z-[60] pointer-events-none stage-banner-flash"
            style={{ background: 'hsl(var(--accent) / 0.12)' }}
          />
        )}
        <div
          className="absolute left-0 right-0 top-0 z-50 cursor-pointer select-none stage-banner-slide"
          onClick={onDismiss}
          title="Click to dismiss"
        >
          {/* Signal drain line */}
          <div
            className="h-[3px] bg-accent"
            style={{ width: `${progress * 100}%`, transition: 'width 0.1s linear', boxShadow: '0 0 8px hsl(var(--accent) / 0.7)' }}
          />
          <div
            className="px-6 py-3 flex items-center gap-4"
            style={{
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(12px)',
              borderBottom: '1px solid hsl(var(--accent) / 0.3)',
            }}
          >
            <span className="text-3xl leading-none shrink-0">{info.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3 mb-0.5">
                <span className="text-[10px] font-mono text-accent/70 tracking-[0.2em] uppercase">
                  Stage {(stage as number) + 1}
                </span>
                <span className="text-lg font-pixel text-foreground tracking-wide">{info.title}</span>
              </div>
              <p className="text-xs font-mono text-muted-foreground/80 leading-snug">
                {info.instruction}
              </p>
            </div>
            <span
              className="text-sm font-mono text-accent/60 shrink-0 tabular-nums"
              style={{ textShadow: '0 0 10px hsl(var(--accent) / 0.4)' }}
            >
              {sec}s
            </span>
          </div>
        </div>
      </>
    );
  }

  // ── Standard small card ──────────────────────────────────────────────────────
  return (
    <div
      className="absolute left-2 top-36 z-50 w-64 cursor-pointer select-none"
      style={{
        transform: visible ? 'translateX(0)' : 'translateX(-110%)',
        transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      onClick={onDismiss}
      title="Click to dismiss"
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Draining progress bar */}
        <div className="h-1 bg-border">
          <div
            className="h-1 bg-accent"
            style={{ width: `${progress * 100}%`, transition: 'width 0.1s linear' }}
          />
        </div>

        <div className="p-3 flex gap-3 items-start">
          <span className="text-2xl leading-none mt-0.5">{info.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-[10px] font-pixel text-accent tracking-widest">
                STAGE {(stage as number) + 1}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">{sec}s</span>
            </div>
            <p className="text-sm font-pixel text-foreground leading-tight">{info.title}</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-1 leading-snug">
              {info.instruction}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
