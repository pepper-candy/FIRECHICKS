import { useState, useEffect } from 'react';
import type { GameStage } from '@/lib/gameTypes';

const STAGE_INFO: Record<number, { title: string; instruction: string; icon: string }> = {
  0: { title: 'Social Circle', instruction: 'Meet ALL other Chicks! 🐣', icon: '🤝' },
  1: { title: 'Exam Tips', instruction: 'Get TIPS from glowing buildings, then SHARE!', icon: '📍' },
  2: { title: 'Share Tips', instruction: 'Share your tips with everyone!', icon: '🔗' },
  3: { title: 'Final Exam', instruction: 'Run to any building and finish the EXAM!', icon: '📝' },
};

interface Props {
  stage: GameStage;
  remainingMs: number;
}

export default function StageTransition({ stage, remainingMs }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const info = STAGE_INFO[stage] ?? STAGE_INFO[0];
  const sec = Math.ceil(remainingMs / 1000);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="text-6xl mb-4">{info.icon}</div>
      <h1 className="text-2xl font-pixel text-accent tracking-widest mb-2">STAGE {stage + 1}</h1>
      <h2 className="text-lg font-pixel text-foreground mb-4">{info.title}</h2>
      <p className="text-sm font-mono text-muted-foreground text-center max-w-xs px-4 mb-6">
        {info.instruction}
      </p>
      <div className="text-4xl font-pixel text-primary animate-pulse">{sec > 0 ? sec : 'GO!'}</div>
    </div>
  );
}
