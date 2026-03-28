import { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { Link } from 'react-router-dom';
import CharacterViewer, { CHICK_COLORS, type ChickColor } from '@/components/CharacterViewer';
import Thumbstick from '@/components/Thumbstick';
import { Button } from '@/components/ui/button';
import * as THREE from 'three';
import { useAssetLoading } from '@/context/AssetLoadingContext';
import type { AnimState } from '@/lib/gameTypes';
import { useImmersive } from '@/context/ImmersiveContext';
import { useFullscreen } from '@/hooks/useFullscreen';

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
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const [facingAngle, setFacingAngle] = useState(0);
  const [stickActive, setStickActive] = useState(false);
  const [charPos, setCharPos] = useState<[number, number, number]>([0, 0, 0]);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; pos: [number, number, number] } | null>(null);
  const { isImmersive } = useImmersive();
  const { isFullscreen, showImmersiveControl, enter: enterFullscreen } = useFullscreen();
  const [fsSplashDone, setFsSplashDone] = useState(false);

  // Ensure character animation GLBs are loaded if user lands here directly (e.g. bookmark)
  const { characterAnimationsReady, startCharacterAnimationPreload } = useAssetLoading();
  useEffect(() => {
    if (!characterAnimationsReady) {
      startCharacterAnimationPreload();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMove = useCallback((x: number, y: number) => {
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

    setAnimState(magnitude > 0.6 ? 'Running' : 'Idle');
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

  // Pan move/end — moves character position (not camera)
  const handlePanMove = useCallback((clientX: number, clientY: number) => {
    if (!panStartRef.current) return;
    const dx = (clientX - panStartRef.current.x) * 0.02;
    const dy = (clientY - panStartRef.current.y) * 0.02;
    setCharPos([
      panStartRef.current.pos[0] + dx,
      0,
      panStartRef.current.pos[2] + dy,
    ]);
  }, []);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  useEffect(() => {
    const onMM = (e: MouseEvent) => handlePanMove(e.clientX, e.clientY);
    const onMU = () => handlePanEnd();
    const onTM = (e: TouchEvent) => {
      if (panStartRef.current) {
        e.preventDefault();
        handlePanMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTE = () => handlePanEnd();
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);
    window.addEventListener('touchmove', onTM, { passive: false });
    window.addEventListener('touchend', onTE);
    return () => {
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('mouseup', onMU);
      window.removeEventListener('touchmove', onTM);
      window.removeEventListener('touchend', onTE);
    };
  }, [handlePanMove, handlePanEnd]);

  // ─── Fullscreen splash in immersive mode ───
  if (isImmersive && showImmersiveControl && !isFullscreen && !fsSplashDone) {
    return (
      <div
        className="flex flex-col items-center justify-center h-dvh overflow-hidden gap-8 bg-background"
        style={{ touchAction: 'manipulation' }}
      >
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-pixel text-destructive tracking-widest" style={{ textShadow: '0 0 10px hsl(0 80% 55% / 0.6)' }}>FIRECHICK</h1>
          <p className="text-xs font-mono text-muted-foreground">Character Viewer</p>
        </div>

        <button
          onClick={async () => { await enterFullscreen(); setFsSplashDone(true); }}
          className="relative flex flex-col items-center gap-4 px-10 py-8 rounded-2xl
            border-2 border-destructive bg-destructive/10 text-destructive
            shadow-[0_0_40px_hsl(var(--destructive)/0.4),inset_0_0_30px_hsl(var(--destructive)/0.05)]
            hover:bg-destructive/20 active:scale-95 transition-all duration-150
            before:absolute before:inset-0 before:rounded-2xl before:border before:border-destructive/30 before:animate-pulse"
        >
          <span className="text-5xl" style={{ lineHeight: 1 }}>⛶</span>
          <span className="text-base font-pixel tracking-widest">TAP TO FULLSCREEN</span>
        </button>

        <button
          onClick={() => setFsSplashDone(true)}
          className="text-[11px] font-mono text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Skip — continue without fullscreen
        </button>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-background relative flex flex-col">
      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <Canvas
          camera={{ position: [0, 1.8, 3.5], fov: 45 }}
          dpr={isMobile ? [1, 1.5] : [1, 2]}
          gl={{ antialias: !isMobile, powerPreference: 'default', preserveDrawingBuffer: false }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 8, 5]} intensity={1} />
          <directionalLight position={[-3, 4, -3]} intensity={0.3} />

          {/* Grid ground — fixed at world origin */}
          <Grid
            args={[40, 40]}
            position={[0, -0.01, 0]}
            cellSize={0.5}
            cellThickness={0.6}
            cellColor="#444444"
            sectionSize={2}
            sectionThickness={1}
            sectionColor="#666666"
            fadeDistance={20}
            infiniteGrid
          />

          <group position={charPos}>
            <Suspense fallback={null}>
              <CharacterViewer
                color={color}
                animState={animState}
                facingAngle={facingAngle}
              />
            </Suspense>
          </group>

          {/* Camera does NOT follow character — so panning moves the character visually */}
          <OrbitControls
            enablePan={false}
            maxPolarAngle={Math.PI / 2.1}
            minDistance={2}
            maxDistance={8}
            target={new THREE.Vector3(0, 0.5, 0)}
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

        {/* Action buttons + Thumbstick + Pan row */}
        <div className="flex items-center justify-center gap-4">
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
            size={140}
            color={COLOR_HEX[color]}
          />

          {/* Pan button */}
          <div
            className="flex flex-col items-center gap-1 select-none touch-none cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => {
              setIsPanning(true);
              panStartRef.current = { x: e.clientX, y: e.clientY, pos: [...charPos] };
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              const t = e.touches[0];
              setIsPanning(true);
              panStartRef.current = { x: t.clientX, y: t.clientY, pos: [...charPos] };
            }}
          >
            <div
              className="w-14 h-14 rounded-full border-2 border-muted-foreground/40 bg-muted/60 flex items-center justify-center text-xl"
              style={{ boxShadow: isPanning ? `0 0 12px ${COLOR_HEX[color]}44` : 'none' }}
            >
              🖐️
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">Pan</span>
          </div>
        </div>
      </div>
    </div>
  );
}
