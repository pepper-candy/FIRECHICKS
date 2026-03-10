import { useRef, useEffect, useState } from 'react';
import type { PlayerState } from '@/hooks/useGameRoom';
import { PLAYER_COLORS } from '@/lib/playerColors';

interface Props {
  players: Map<string, PlayerState>;
}

const SPEED = 4;
const PLAYER_SIZE = 24;

interface PlayerPos {
  x: number;
  y: number;
}

export default function GameArena({ players }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Map<string, PlayerPos>>(new Map());

  // Keep positions in sync with active players
  useEffect(() => {
    setPositions((prev) => {
      const next = new Map(prev);
      // Remove disconnected players
      for (const key of next.keys()) {
        if (!players.has(key)) next.delete(key);
      }
      // Add new players at center
      for (const key of players.keys()) {
        if (!next.has(key)) next.set(key, { x: 50, y: 50 });
      }
      return next;
    });
  }, [players]);

  // Animation loop
  useEffect(() => {
    const id = setInterval(() => {
      setPositions((prev) => {
        const container = containerRef.current;
        if (!container) return prev;

        const w = container.clientWidth;
        const h = container.clientHeight;
        let changed = false;
        const next = new Map(prev);

        for (const [key, pos] of next) {
          const player = players.get(key);
          if (!player) continue;
          const { joystick } = player;
          if (joystick.x === 0 && joystick.y === 0) continue;

          changed = true;
          const pxX = (pos.x / 100) * w + joystick.x * SPEED;
          const pxY = (pos.y / 100) * h + joystick.y * SPEED;

          next.set(key, {
            x: Math.max(0, Math.min(100, (pxX / w) * 100)),
            y: Math.max(0, Math.min(100, (pxY / h) * 100)),
          });
        }

        return changed ? next : prev;
      });
    }, 16);

    return () => clearInterval(id);
  }, [players]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-arena rounded-lg border border-border overflow-hidden"
      style={{
        backgroundImage:
          'linear-gradient(hsl(var(--arena-grid)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--arena-grid)) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      {Array.from(positions.entries()).map(([id, pos]) => {
        const player = players.get(id);
        if (!player) return null;
        const color = PLAYER_COLORS[player.colorIndex] ?? PLAYER_COLORS[0];

        return (
          <div key={id}>
            {/* Trail/glow */}
            <div
              className="absolute rounded-full blur-md"
              style={{
                width: PLAYER_SIZE * 2,
                height: PLAYER_SIZE * 2,
                left: `calc(${pos.x}% - ${PLAYER_SIZE}px)`,
                top: `calc(${pos.y}% - ${PLAYER_SIZE}px)`,
                backgroundColor: `hsl(${color.hsl} / 0.2)`,
              }}
            />
            {/* Player dot */}
            <div
              className="absolute rounded-full transition-none"
              style={{
                width: PLAYER_SIZE,
                height: PLAYER_SIZE,
                left: `calc(${pos.x}% - ${PLAYER_SIZE / 2}px)`,
                top: `calc(${pos.y}% - ${PLAYER_SIZE / 2}px)`,
                backgroundColor: `hsl(${color.hsl})`,
                boxShadow: `0 0 20px hsl(${color.hsl} / 0.4), 0 0 60px hsl(${color.hsl} / 0.15)`,
              }}
            />
          </div>
        );
      })}

      {/* Empty state */}
      {positions.size === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-muted-foreground font-mono animate-pulse">
            WAITING FOR PLAYERS...
          </p>
        </div>
      )}
    </div>
  );
}
