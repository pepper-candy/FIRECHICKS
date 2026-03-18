import { Suspense } from 'react';
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

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      <div className="w-64 h-64">
        <Canvas camera={{ position: [0, 2, 4], fov: 35 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 5, 3]} intensity={1} />
          <RotatingCharacter chickColor={color.chickColor} />
        </Canvas>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div
          className="w-8 h-8 rounded-full"
          style={{
            backgroundColor: `hsl(${color.hsl})`,
            boxShadow: `0 0 20px hsl(${color.hsl} / 0.5)`,
          }}
        />
        <p className="text-lg font-bold font-mono" style={{ color: `hsl(${color.hsl})` }}>
          {color.name}
        </p>
        <p className="text-xl font-pixel" style={{ color: `hsl(${color.hsl})` }}>
          {isEagle ? '🦅 EAGLE' : '🐤 CHICK'}
        </p>
        {isEagle && (
          <p className="text-xs text-muted-foreground font-mono mt-2 text-center max-w-xs">
            You are the Eagle — catch and eliminate the Chicks!
          </p>
        )}
        {!isEagle && (
          <p className="text-xs text-muted-foreground font-mono mt-2 text-center max-w-xs">
            You are a Chick — survive, cooperate, and pass the exam!
          </p>
        )}
      </div>
    </div>
  );
}
