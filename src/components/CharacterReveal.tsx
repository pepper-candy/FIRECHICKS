import { Suspense, useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import CharacterViewer from '@/components/CharacterViewer';
import { PLAYER_COLORS } from '@/lib/playerColors';
import type { ChickColor } from '@/components/CharacterViewer';
import * as THREE from 'three';

interface Props {
  colorIndex: number;
  isEagle: boolean;
}

function RotatingCharacter({ chickColor }: { chickColor: ChickColor }) {
  const angleRef = useRef(0);
  useFrame((_, delta) => {
    angleRef.current += delta * 1.2;
  });
  return (
    <Suspense fallback={null}>
      <CharacterViewer color={chickColor} animState="Idle" facingAngle={angleRef.current} />
    </Suspense>
  );
}

export default function CharacterReveal({ colorIndex, isEagle }: Props) {
  const color = PLAYER_COLORS[colorIndex];
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  if (!color) return null;

  const progress = Math.min(1, elapsed / 5);
  const remaining = Math.max(0, Math.ceil(5 - elapsed));

  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-3 p-4">
      {/* 3D rotating character */}
      <div className="flex-1 w-full max-w-xs" style={{ maxHeight: '65vh' }}>
        <Canvas camera={{ position: [0, 1.5, 3.5], fov: 35 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 5, 3]} intensity={1.2} />
          <group scale={[0.85, 0.85, 0.85]}>
            <RotatingCharacter chickColor={color.chickColor} />
          </group>
        </Canvas>
      </div>

      {/* Role + Color info */}
      <div className="flex flex-col items-center gap-2">
        {/* Role banner */}
        <div
          className="px-6 py-2 rounded-lg flex items-center gap-3"
          style={{
            backgroundColor: `hsl(${color.hsl} / 0.2)`,
            border: `2px solid hsl(${color.hsl} / 0.6)`,
            boxShadow: `0 0 20px hsl(${color.hsl} / 0.3)`,
          }}
        >
          <div
            className="w-6 h-6 rounded-full flex-shrink-0"
            style={{
              backgroundColor: `hsl(${color.hsl})`,
              boxShadow: `0 0 12px hsl(${color.hsl} / 0.6)`,
            }}
          />
          <p className="text-base font-bold font-mono text-foreground">
            You are <span style={{ color: `hsl(${color.hsl})` }}>{color.name}</span>
          </p>
        </div>

        {/* Eagle / Chick badge */}
        <p className="text-2xl font-pixel" style={{ color: `hsl(${color.hsl})` }}>
          {isEagle ? '🦅 EAGLE' : '🐤 CHICK'}
        </p>

        {/* Role description */}
        <p className="text-xs text-muted-foreground font-mono text-center max-w-xs">
          {isEagle
            ? 'Hunt down the chicks — catch them all to win!'
            : 'Survive, collaborate, and solve the final exam!'}
        </p>

        {/* Countdown bar */}
        <div className="w-full max-w-xs mt-1">
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress * 100}%`,
                backgroundColor: `hsl(${color.hsl})`,
                boxShadow: `0 0 8px hsl(${color.hsl} / 0.6)`,
              }}
            />
          </div>
          <p className="text-center text-[10px] font-mono text-muted-foreground mt-1">
            {remaining > 0 ? `Entering game in ${remaining}s...` : 'Get ready!'}
          </p>
        </div>
      </div>
    </div>
  );
}
