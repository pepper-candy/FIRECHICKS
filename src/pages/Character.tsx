import { useState, useCallback, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { Link } from 'react-router-dom';
import CharacterViewer, { CHICK_COLORS, type ChickColor } from '@/components/CharacterViewer';
import Thumbstick from '@/components/Thumbstick';
import { Button } from '@/components/ui/button';
import * as THREE from 'three';

type AnimState = 'Idle' | 'Walking' | 'Running' | 'Victory' | 'Attack';

const CAN_ATTACK: ChickColor[] = ['Black', 'Gold'];

const COLOR_HEX: Record<ChickColor, string> = {
  Black: '#333333',
  Blue: '#3b82f6',
  Cyan: '#06b6d4',
  Gold: '#eab308',
  Green: '#22c55e',
  Pink: '#ec4899',
  Red: '#ef4444',
  Yellow: '#facc15',
};

export default function Character() {
  const [color, setColor] = useState<ChickColor>('Gold');
  const [animState, setAnimState] = useState<AnimState>('Idle');
  const [facingAngle, setFacingAngle] = useState(0);
  const [stickActive, setStickActive] = useState(false);

  const handleMove = useCallback((x: number, y: number) => {
    // Invert Y so pushing stick up moves character forward
    const iy = -y;
    const magnitude = Math.sqrt(x * x + iy * iy);
    if (magnitude < 0.05) {
      setStickActive(false);
      setAnimState('Idle');
      return;
    }

    setStickActive(true);
    const angle = Math.atan2(-x, iy);
    setFacingAngle(angle);

    if (magnitude > 0.6) {
      setAnimState('Running');
    } else {
      setAnimState('Walking');
    }
  }, []);

  const handleIdleChange = useCallback((idle: boolean) => {
    if (idle) {
      setStickActive(false);
      setAnimState('Idle');
    }
  }, []);

  const triggerVictory = () => {
    setAnimState('Victory');
    setStickActive(false);
  };

  const triggerAttack = () => {
    if (CAN_ATTACK.includes(color)) {
      setAnimState('Attack');
      setStickActive(false);
    }
  };

  return (
    <div className="w-screen h-screen bg-background relative flex flex-col">
      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <Canvas camera={{ position: [0, 2, 4], fov: 45 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 8, 5]} intensity={1} />
          <directionalLight position={[-3, 4, -3]} intensity={0.3} />

          {/* Ground plane */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="hsl(240, 15%, 10%)" />
          </mesh>

          <Suspense fallback={null}>
            <CharacterViewer
              color={color}
              animState={animState}
              facingAngle={facingAngle}
            />
          </Suspense>

          <OrbitControls
            enablePan={false}
            maxPolarAngle={Math.PI / 2.1}
            minDistance={2}
            maxDistance={8}
          />
        </Canvas>

        {/* Back link */}
        <Link
          to="/"
          className="absolute top-4 left-4 text-sm text-muted-foreground hover:text-foreground font-mono z-10"
        >
          ← Back
        </Link>

        {/* Current info */}
        <div className="absolute top-4 right-4 text-xs font-mono text-muted-foreground z-10 text-right space-y-1">
          <p style={{ color: COLOR_HEX[color] }}>{color}</p>
          <p>{animState}</p>
        </div>
      </div>

      {/* Controls panel */}
      <div className="bg-card border-t border-border p-4 space-y-4">
        {/* Color selector */}
        <div className="flex flex-wrap gap-2 justify-center">
          {CHICK_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-9 h-9 rounded-full border-2 transition-transform ${
                color === c ? 'scale-110 border-foreground' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: COLOR_HEX[c] }}
              title={c}
            />
          ))}
        </div>

        {/* Action buttons + Thumbstick row */}
        <div className="flex items-center justify-center gap-6">
          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={triggerVictory}
              className="text-xs font-mono border-accent/40 text-accent hover:bg-accent/10"
            >
              🏆 Victory
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={triggerAttack}
              disabled={!CAN_ATTACK.includes(color)}
              className="text-xs font-mono border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-30"
            >
              ⚔️ Attack
            </Button>
          </div>

          {/* Thumbstick */}
          <Thumbstick
            onMove={handleMove}
            onIdleChange={handleIdleChange}
            size={160}
            color={COLOR_HEX[color]}
          />
        </div>
      </div>
    </div>
  );
}
