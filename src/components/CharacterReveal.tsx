import { Suspense, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import CharacterViewer from '@/components/CharacterViewer';
import { PLAYER_COLORS } from '@/lib/playerColors';
import type { ChickColor } from '@/components/CharacterViewer';
import { useRef } from 'react';
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
  if (!color) return null;

  // 5 sec reveal then 3 sec countdown
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    const revealTimer = setTimeout(() => {
      setCountdown(3);
    }, 5000);
    return () => clearTimeout(revealTimer);
  }, []);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-4">
      {/* 3D character at 75% of screen height, scaled 0.8 */}
      <div className="flex-1 w-full max-w-xs" style={{ maxHeight: '75%' }}>
        <Canvas camera={{ position: [0, 1.5, 3.5], fov: 35 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 5, 3]} intensity={1} />
          <group scale={[0.8, 0.8, 0.8]}>
            <RotatingCharacter chickColor={color.chickColor} />
          </group>
        </Canvas>
      </div>

      {/* Info section */}
      <div className="flex flex-col items-center gap-2 pb-4">
        {/* Color indicator with background so black is visible */}
        <div
          className="px-4 py-2 rounded-lg flex items-center gap-3"
          style={{
            backgroundColor: `hsl(${color.hsl} / 0.2)`,
            border: `2px solid hsl(${color.hsl} / 0.5)`,
          }}
        >
          <div
            className="w-6 h-6 rounded-full flex-shrink-0"
            style={{
              backgroundColor: `hsl(${color.hsl})`,
              boxShadow: `0 0 16px hsl(${color.hsl} / 0.5)`,
            }}
          />
          <p className="text-lg font-bold font-mono text-foreground">
            You are <span style={{ color: `hsl(${color.hsl})` }}>{color.name}</span>
          </p>
        </div>

        <p className="text-xl font-pixel" style={{ color: `hsl(${color.hsl})` }}>
          {isEagle ? '🦅 EAGLE' : '🐤 CHICK'}
        </p>

        {isEagle ? (
          <p className="text-xs text-muted-foreground font-mono mt-1 text-center max-w-xs">
            You are the Eagle — catch and eliminate the Chicks!
          </p>
        ) : (
          <p className="text-xs text-muted-foreground font-mono mt-1 text-center max-w-xs">
            You are a Chick — survive, cooperate, and pass the exam!
          </p>
        )}

        {/* Countdown */}
        {countdown !== null && countdown > 0 && (
          <div className="text-4xl font-pixel text-accent animate-pulse mt-2">
            {countdown}
          </div>
        )}
      </div>
    </div>
  );
}
