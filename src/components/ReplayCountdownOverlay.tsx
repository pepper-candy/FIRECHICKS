import { useRef, useEffect, useMemo, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import CharacterViewer from '@/components/CharacterViewer';
import type { ReplayData, ReplayFramePlayer } from '@/lib/gameTypes';
import type { ChickColor } from '@/components/CharacterViewer';

interface Props {
  replayData: ReplayData;
  secondsLeft: number;
}

// Interpolate between replay frames based on elapsed time
function useReplayState(replayData: ReplayData, elapsed: number) {
  const { frames, attackTime } = replayData;
  if (frames.length === 0) return null;

  const replayStartTime = attackTime - 3000; // replay covers 3s before attack
  const targetTime = replayStartTime + (elapsed * 3000 / 3); // map 0-3s elapsed to 0-3s of replay

  // Find the two frames to interpolate between
  let frameA = frames[0];
  let frameB = frames[0];
  for (let i = 0; i < frames.length - 1; i++) {
    if (frames[i].time <= targetTime && frames[i + 1].time >= targetTime) {
      frameA = frames[i];
      frameB = frames[i + 1];
      break;
    }
    if (frames[i].time >= targetTime) {
      frameA = frames[i];
      frameB = frames[i];
      break;
    }
  }
  // Use the last frame if target is past all frames
  if (targetTime >= frames[frames.length - 1].time) {
    frameA = frames[frames.length - 1];
    frameB = frameA;
  }

  const dt = frameB.time - frameA.time;
  const t = dt > 0 ? Math.min(1, (targetTime - frameA.time) / dt) : 0;

  // Interpolate all players
  const players: Record<string, ReplayFramePlayer & { interpX: number; interpZ: number }> = {};
  const allIds = new Set([...Object.keys(frameA.players), ...Object.keys(frameB.players)]);
  for (const id of allIds) {
    const a = frameA.players[id];
    const b = frameB.players[id];
    const src = b ?? a;
    if (!src) continue;
    players[id] = {
      ...src,
      interpX: a && b ? a.x + (b.x - a.x) * t : src.x,
      interpZ: a && b ? a.z + (b.z - a.z) * t : src.z,
      facingAngle: src.facingAngle,
    };
  }
  return players;
}

// Camera that follows the eagle with cinematic phases
function ReplayCamera({ replayData, elapsed }: { replayData: ReplayData; elapsed: number }) {
  const { camera } = useThree();
  const { attackerConnId, victimConnIds, frames } = replayData;

  useFrame(() => {
    if (frames.length === 0) return;

    const attackTime = replayData.attackTime;
    const replayStartTime = attackTime - 3000;
    const targetTime = replayStartTime + (elapsed * 3000 / 3);

    // Find current frame
    let currentFrame = frames[frames.length - 1];
    for (const f of frames) {
      if (f.time >= targetTime) {
        currentFrame = f;
        break;
      }
    }

    const eagle = currentFrame.players[attackerConnId];
    const victim = victimConnIds.length > 0 ? currentFrame.players[victimConnIds[0]] : null;

    if (!eagle) return;

    if (elapsed < 1.5) {
      // Phase 1: Wide shot following eagle
      camera.position.set(eagle.x + 8, 12, eagle.z + 10);
      camera.lookAt(eagle.x, 0, eagle.z);
    } else if (elapsed < 2.0) {
      // Phase 2: Attack moment — closer to eagle
      camera.position.set(eagle.x + 4, 6, eagle.z + 5);
      camera.lookAt(eagle.x, 1, eagle.z);
    } else {
      // Phase 3: Static zoom-in on eagle
      const t = (elapsed - 2.0) / 1.0; // 0 to 1
      const startDist = 5;
      const endDist = 3;
      const dist = startDist + (endDist - startDist) * t;
      const targetX = victim ? (eagle.x + victim.x) / 2 : eagle.x;
      const targetZ = victim ? (eagle.z + victim.z) / 2 : eagle.z;
      camera.position.set(targetX + dist * 0.7, 3 + (1 - t) * 2, targetZ + dist);
      camera.lookAt(targetX, 1, targetZ);
    }
  });

  return null;
}

// Renders all characters from replay data
function ReplayCharacters({ replayData, elapsed }: { replayData: ReplayData; elapsed: number }) {
  const players = useReplayState(replayData, elapsed);
  if (!players) return null;

  // Determine attack animation phase
  const inAttackPhase = elapsed >= 1.5 && elapsed < 2.0;

  return (
    <>
      {Object.entries(players).map(([id, p]) => {
        if (!p.alive) return null;
        const isAttacker = id === replayData.attackerConnId;
        const animState = isAttacker && inAttackPhase
          ? 'Attack' as const
          : p.isMoving
            ? 'Running' as const
            : 'Idle' as const;

        return (
          <group key={id} position={[p.interpX, 0, p.interpZ]}>
            <CharacterViewer
              color={p.chickColor as ChickColor}
              animState={animState}
              facingAngle={p.facingAngle}
            />
          </group>
        );
      })}
    </>
  );
}

export default function ReplayCountdownOverlay({ replayData, secondsLeft }: Props) {
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useRef(0) as any; // will use a different approach

  // Track elapsed time with a ref + re-render trigger
  const elapsedRef = useRef(0);

  useEffect(() => {
    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      elapsedRef.current = Math.min(3, (Date.now() - startTimeRef.current) / 1000);
    }, 16);
    return () => clearInterval(interval);
  }, []);

  const countdownNum = Math.ceil(secondsLeft);

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-background/90" style={{ zIndex: 2147483647 }}>
      <div className="relative w-[85vw] h-[65vh] max-w-[1200px] max-h-[700px] rounded-lg shadow-2xl overflow-hidden border border-border bg-card">
        {/* Left side — Replay (trapezoid via clip-path) */}
        <div
          className="absolute inset-0"
          style={{ clipPath: 'polygon(0 0, 70% 0, 55% 100%, 0 100%)' }}
        >
          <ReplayCanvas replayData={replayData} />
          {/* REPLAY label */}
          <div className="absolute top-3 left-4 px-3 py-1 rounded bg-destructive/80 text-destructive-foreground font-pixel text-xs tracking-widest">
            ⏪ REPLAY
          </div>
        </div>

        {/* Diagonal divider "/" */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, transparent calc(70% - 2px), hsl(var(--border)) calc(70% - 1px), hsl(var(--border)) calc(70% + 1px), transparent calc(70% + 2px))',
          }}
        />
        {/* SVG diagonal line */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          <line
            x1="70%"
            y1="0"
            x2="55%"
            y2="100%"
            stroke="hsl(var(--border))"
            strokeWidth="3"
          />
        </svg>

        {/* Right side — Countdown */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ clipPath: 'polygon(70% 0, 100% 0, 100% 100%, 55% 100%)' }}
        >
          <div className="flex flex-col items-center gap-4 translate-x-[10%]">
            <span className="text-xs font-pixel tracking-[0.3em] text-muted-foreground">RESUMING</span>
            <div
              key={countdownNum}
              className="text-[10rem] font-pixel leading-none animate-pulse"
              style={{
                color: 'hsl(var(--accent))',
                textShadow: '0 0 60px hsl(var(--accent) / 0.8), 0 0 120px hsl(var(--accent) / 0.4)',
              }}
            >
              {countdownNum > 0 ? countdownNum : ''}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Separate component so useFrame works inside Canvas
function ReplayScene({ replayData }: { replayData: ReplayData }) {
  const elapsedRef = useRef(0);
  const startTime = useRef(Date.now());

  useFrame(() => {
    elapsedRef.current = Math.min(3, (Date.now() - startTime.current) / 1000);
  });

  return (
    <>
      <ambientLight intensity={0.7} color="#fffaf0" />
      <directionalLight position={[20, 35, 15]} intensity={1.6} color="#fff5e0" />
      <directionalLight position={[-15, 20, -10]} intensity={0.4} color="#b0d0ff" />
      <gridHelper args={[60, 60, '#333', '#222']} />
      <ReplayCamera replayData={replayData} elapsed={elapsedRef.current} />
      <Suspense fallback={null}>
        <ReplayCharacters replayData={replayData} elapsed={elapsedRef.current} />
      </Suspense>
    </>
  );
}

function ReplayCanvas({ replayData }: { replayData: ReplayData }) {
  // Get initial eagle position for camera setup
  const initialPos = useMemo(() => {
    const firstFrame = replayData.frames[0];
    const eagle = firstFrame?.players[replayData.attackerConnId];
    return eagle ? { x: eagle.x, z: eagle.z } : { x: 0, z: 0 };
  }, [replayData]);

  return (
    <Canvas
      camera={{
        position: [initialPos.x + 8, 12, initialPos.z + 10],
        fov: 45,
      }}
      className="w-full h-full"
    >
      <ReplayScene replayData={replayData} />
    </Canvas>
  );
}
