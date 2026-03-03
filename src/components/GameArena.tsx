import { useRef, useEffect, useState } from 'react';
import type { JoystickData } from '@/hooks/useGameRoom';

interface Props {
  joystick: JoystickData;
}

const SPEED = 4;
const PLAYER_SIZE = 24;

export default function GameArena({ joystick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 }); // percentage

  useEffect(() => {
    if (joystick.x === 0 && joystick.y === 0) return;

    const id = setInterval(() => {
      setPos((prev) => {
        const container = containerRef.current;
        if (!container) return prev;

        const w = container.clientWidth;
        const h = container.clientHeight;
        const pxX = (prev.x / 100) * w + joystick.x * SPEED;
        const pxY = (prev.y / 100) * h + joystick.y * SPEED;

        return {
          x: Math.max(0, Math.min(100, (pxX / w) * 100)),
          y: Math.max(0, Math.min(100, (pxY / h) * 100)),
        };
      });
    }, 16);

    return () => clearInterval(id);
  }, [joystick]);

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
      {/* Player */}
      <div
        className="absolute rounded-full bg-player glow-green transition-none"
        style={{
          width: PLAYER_SIZE,
          height: PLAYER_SIZE,
          left: `calc(${pos.x}% - ${PLAYER_SIZE / 2}px)`,
          top: `calc(${pos.y}% - ${PLAYER_SIZE / 2}px)`,
        }}
      />
      {/* Trail effect */}
      <div
        className="absolute rounded-full bg-player/20 blur-md"
        style={{
          width: PLAYER_SIZE * 2,
          height: PLAYER_SIZE * 2,
          left: `calc(${pos.x}% - ${PLAYER_SIZE}px)`,
          top: `calc(${pos.y}% - ${PLAYER_SIZE}px)`,
        }}
      />
    </div>
  );
}
