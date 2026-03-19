import type { GameStage } from '@/lib/gameTypes';

interface Props {
  currentStage: GameStage;
  stageLabel?: string;
}

const STAGES = [
  { label: 'Social Circle', icon: '🤝' },
  { label: 'Get Exam Tips', icon: '📍' },
  { label: 'Share Tips',    icon: '🔗' },
  { label: 'Final Exam',   icon: '📝' },
] as const;

export default function StageProgressBar({ currentStage, stageLabel }: Props) {
  // Stage 2 means sharing — highlight both stage 1 and stage 2 simultaneously
  const isSharingPhase = currentStage === 2;

  return (
    <div className="absolute bottom-2 left-2 right-2 z-10">
      <div className="flex items-center gap-1 bg-card/85 border border-border rounded px-3 py-2">
        {STAGES.map((s, idx) => {
          const isCompleted = idx < currentStage && !(isSharingPhase && (idx === 1 || idx === 2));
          const isActive = idx === currentStage || (isSharingPhase && (idx === 1 || idx === 2));
          const isBeforeSharing = isSharingPhase && idx < 1;

          const barColor = isCompleted || isBeforeSharing
            ? 'bg-primary'
            : isActive
              ? 'bg-accent'
              : 'bg-muted';

          const labelColor = isActive
            ? 'text-accent font-bold'
            : isCompleted || isBeforeSharing
              ? 'text-primary'
              : 'text-muted-foreground';

          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1.5 w-full rounded-full transition-all ${barColor} ${isActive ? 'animate-pulse' : ''}`} />
              <span className={`text-[8px] font-mono truncate text-center ${labelColor}`}>
                {s.icon} {s.label}
              </span>
            </div>
          );
        })}
      </div>
      {stageLabel && (
        <p className="text-center text-[10px] text-muted-foreground font-mono mt-0.5 truncate px-4">
          {stageLabel}
        </p>
      )}
    </div>
  );
}
