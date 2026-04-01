import { useEffect, useState } from 'react';
import type { GameEvent, CrossyLane } from '@/lib/gameTypes';

interface Props {
  event: GameEvent;
  players: Record<string, any>;
  gameMode?: string;
}

const LANE_COLORS = [
  'hsl(var(--muted))',
  'hsl(var(--accent) / 0.15)',
  'hsl(var(--muted))',
  'hsl(var(--accent) / 0.15)',
  'hsl(var(--muted))',
];

const CHICK_COLORS = [
  'hsl(0 80% 55%)',    // Red
  'hsl(220 80% 55%)',  // Blue
  'hsl(145 80% 50%)',  // Green
  'hsl(280 70% 55%)',  // Purple
  'hsl(48 96% 53%)',   // Gold
  'hsl(340 80% 65%)',  // Pink
  'hsl(180 60% 50%)',  // Cyan
  'hsl(25 90% 55%)',   // Orange
];

const FIELD_WIDTH = 100; // game units

export default function CrossyRoadHost({ event, players, gameMode }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const timeLeft = Math.max(0, Math.ceil((event.endAt - now) / 1000));
  const lanes = event.crossyLanes ?? [];
  const crossyStates = event.crossyPlayerStates ?? {};
  const speedBoost = event.eagleSpeedBoost ?? 1;

  const aliveChicks = Object.values(players).filter((p: any) => !p.isEagle && p.alive);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
      <div className="flex items-center justify-between w-full max-w-lg">
        <h2 className="text-lg font-pixel text-accent">🐔 CROSSY ROAD</h2>
        <span className="font-mono text-lg font-bold text-primary">{timeLeft}s</span>
      </div>

      {/* Eagle speed */}
      <div className="text-xs font-mono text-muted-foreground text-center">
        <p>🦅 Speed: <span className="text-accent font-bold">{speedBoost.toFixed(1)}×</span></p>
      </div>

      {/* Lane visualization */}
      <div className="w-full max-w-lg border-2 border-accent/30 rounded-lg overflow-hidden bg-card">
        {/* Finish zone */}
        <div className="h-6 bg-primary/20 flex items-center justify-center border-b border-primary/30">
          <span className="text-[10px] font-pixel text-primary">🏁 SAFE ZONE</span>
        </div>

        {lanes.map((lane, i) => (
          <div
            key={lane.id}
            className="relative h-10 border-b border-border/30"
            style={{ background: LANE_COLORS[i % LANE_COLORS.length] }}
          >
            {/* Direction indicator */}
            <span className="absolute left-1 top-1 text-[8px] text-muted-foreground opacity-50">
              {lane.direction === 'left' ? '←' : '→'}
            </span>

            {/* Obstacles */}
            {lane.obstacles.map((obs, oi) => {
              const leftPct = ((obs.x % FIELD_WIDTH + FIELD_WIDTH) % FIELD_WIDTH) / FIELD_WIDTH * 100;
              const widthPct = (obs.width / FIELD_WIDTH) * 100;
              return (
                <div
                  key={oi}
                  className="absolute top-1 bottom-1 rounded bg-destructive/70"
                  style={{
                    left: `${leftPct}%`,
                    width: `${Math.max(widthPct, 3)}%`,
                    transition: 'left 0.1s linear',
                  }}
                >
                  <span className="text-[10px] flex items-center justify-center h-full">🔥</span>
                </div>
              );
            })}

            {/* Chick dots in this lane */}
            {aliveChicks.map((p: any) => {
              const cs = crossyStates[p.connId];
              if (!cs || cs.laneIndex !== i + 1) return null; // lanes are 1-5, index i is 0-4
              const xPct = ((cs.xPosition % FIELD_WIDTH + FIELD_WIDTH) % FIELD_WIDTH) / FIELD_WIDTH * 100;
              return (
                <div
                  key={p.connId}
                  className="absolute top-0.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold"
                  style={{
                    left: `${xPct}%`,
                    backgroundColor: CHICK_COLORS[p.colorIndex % CHICK_COLORS.length],
                    transition: 'left 0.1s linear, top 0.15s ease',
                    transform: 'translateX(-50%)',
                  }}
                >
                  🐤
                </div>
              );
            })}
          </div>
        ))}

        {/* Start zone */}
        <div className="h-6 bg-secondary/30 flex items-center justify-center border-t border-secondary/50">
          <span className="text-[10px] font-pixel text-secondary-foreground">🏠 START</span>
        </div>

        {/* Chick dots in start zone (lane 0) */}
        <div className="relative h-0">
          {aliveChicks.map((p: any) => {
            const cs = crossyStates[p.connId];
            if (!cs || cs.laneIndex !== 0) return null;
            return (
              <div
                key={p.connId}
                className="absolute -top-5 w-4 h-4 rounded-full border border-white flex items-center justify-center text-[7px]"
                style={{
                  left: `${(((cs.xPosition % FIELD_WIDTH) + FIELD_WIDTH) % FIELD_WIDTH) / FIELD_WIDTH * 100}%`,
                  backgroundColor: CHICK_COLORS[p.colorIndex % CHICK_COLORS.length],
                  transform: 'translateX(-50%)',
                }}
              >
                🐤
              </div>
            );
          })}
        </div>
      </div>

      {/* Scoreboard */}
      <div className="flex flex-wrap gap-3 justify-center">
        {aliveChicks.map((p: any) => {
          const cs = crossyStates[p.connId];
          return (
            <div key={p.connId} className="text-center">
              <div
                className="w-6 h-6 rounded-full mx-auto border-2 border-white"
                style={{ backgroundColor: CHICK_COLORS[p.colorIndex % CHICK_COLORS.length] }}
              />
              <span className="text-xs font-mono text-foreground">{cs?.crossings ?? 0}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
