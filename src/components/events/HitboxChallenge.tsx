import type { GameEvent } from '@/lib/gameTypes';

interface Props {
  event: GameEvent;
  players: Record<string, any>;
  gameMode?: string;
}

export default function HitboxChallenge({ event, players, gameMode }: Props) {
  const now = Date.now();
  const aliveChicks = Object.values(players).filter((p: any) => !p.isEagle && p.alive);
  const chickTotal = aliveChicks.reduce((sum: number, p: any) => sum + (event.chickClicks[p.connId] ?? 0), 0);
  const eagleTotal = Object.values(players)
    .filter((p: any) => p.isEagle && p.alive)
    .reduce((sum: number, p: any) => sum + (event.eagleClicks[p.connId] ?? 0), 0);
  const timeLeft = Math.max(0, Math.ceil((event.endAt - now) / 1000));

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <h2 className="text-lg font-pixel text-accent">👊 HITBOX BATTLE — {timeLeft}s</h2>
      <div className="flex justify-around w-full max-w-md">
        <div className="text-center">
          <div className="text-4xl font-pixel text-primary">{chickTotal}</div>
          <div className="text-xs font-mono text-muted-foreground">
            🐤 Chicks (avg: {aliveChicks.length > 0 ? (chickTotal / aliveChicks.length).toFixed(1) : 0})
          </div>
        </div>
        <div className="text-2xl text-muted-foreground">vs</div>
        <div className="text-center">
          <div className="text-4xl font-pixel text-destructive">{eagleTotal}</div>
          <div className="text-xs font-mono text-muted-foreground">
            🦅 Eagle{gameMode === '2v6' ? 's' : ''}
          </div>
        </div>
      </div>
      <p className="text-xs font-mono text-muted-foreground">TAP HITBOX AS FAST AS POSSIBLE!</p>
    </div>
  );
}
