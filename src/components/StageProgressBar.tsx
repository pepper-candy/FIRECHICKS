import { STAGE_LABELS } from '@/lib/gameTypes';
import type { GameStage } from '@/lib/gameTypes';

interface Props {
  currentStage: GameStage;
  stageLabel?: string;
}

export default function StageProgressBar({ currentStage, stageLabel }: Props) {
  return (
    <div className="absolute bottom-2 left-2 right-2 z-10">
      <div className="flex items-center gap-1 bg-card/80 border border-border rounded px-3 py-2">
        {STAGE_LABELS.map((label, idx) => {
          const isActive = idx === currentStage;
          const isCompleted = idx < currentStage;

          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`h-1.5 w-full rounded-full transition-all ${
                  isCompleted
                    ? 'bg-primary'
                    : isActive
                      ? 'bg-accent animate-pulse'
                      : 'bg-muted'
                }`}
              />
              <span
                className={`text-[9px] font-mono truncate ${
                  isActive
                    ? 'text-accent font-bold'
                    : isCompleted
                      ? 'text-primary'
                      : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      {stageLabel && (
        <p className="text-center text-[10px] text-muted-foreground font-mono mt-1">
          {stageLabel}
        </p>
      )}
    </div>
  );
}
