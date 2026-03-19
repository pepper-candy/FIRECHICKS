import { PLAYER_COLORS } from '@/lib/playerColors';
import { gradeToLetter, getGradeColor } from '@/lib/gradeSystem';
import type { PlayerGameStateSerializable } from '@/lib/gameTypes';
import { Star } from 'lucide-react';

interface Props {
  players: Record<string, PlayerGameStateSerializable>;
}

export default function HealthDisplay({ players }: Props) {
  const sorted = Object.values(players)
    .filter((p) => !p.isEagle)
    .sort((a, b) => b.health - a.health);

  return (
    <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 font-mono">
      {sorted.map((p) => {
        const color = PLAYER_COLORS[p.colorIndex];
        const letter = gradeToLetter(p.health);
        const gradeColor = getGradeColor(p.health);

        return (
          <div
            key={p.connId}
            className={`flex items-center gap-2 px-2 py-1 rounded text-xs border ${
              p.alive ? 'bg-card/80 border-border' : 'bg-card/40 border-border/50 opacity-50'
            }`}
          >
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{
                backgroundColor: `hsl(${color?.hsl ?? '0 0% 50%'})`,
                boxShadow: `0 0 6px hsl(${color?.hsl ?? '0 0% 50%'} / 0.4)`,
              }}
            />
            <span className="text-muted-foreground w-12 truncate">
              {color?.name ?? '?'} {p.isEagle ? '🦅' : '🐤'}
            </span>
            {p.isStarStudent && <Star className="w-3 h-3 text-accent fill-accent" />}
            <span className="font-bold text-sm w-8 text-right" style={{ color: gradeColor }}>
              {p.alive ? letter : 'F'}
            </span>
            <span className="text-muted-foreground text-[10px] w-6 text-right">
              {p.alive ? p.health.toFixed(1) : '0.0'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
