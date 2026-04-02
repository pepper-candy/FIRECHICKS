import { useRef, useEffect, useMemo, useState, Suspense } from 'react';
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

// Camera that follows the eagle with cinematic phases
function ReplayCamera({ replayData }: { replayData: ReplayData }) {
  const startTime = useRef(Date.now());
  const { camera } = useThree();
  const { attackerConnId, victimConnIds, frames, attackTime } = replayData;

  useFrame(() => {
    if (frames.length === 0) return;
    const elapsed = Math.min(3, (Date.now() - startTime.current) / 1000);

    const replayStartTime = attackTime - 3000;
    const targetTime = replayStartTime + elapsed * 1000;

    // Find closest frame
    let currentFrame = frames[frames.length - 1];
    for (const f of frames) {
      if (f.time >= targetTime) { currentFrame = f; break; }
    }

    const eagle = currentFrame.players[attackerConnId];
    const victim = victimConnIds.length > 0 ? currentFrame.players[victimConnIds[0]] : null;
    if (!eagle) return;

    if (elapsed < 1.5) {
      camera.position.set(eagle.x + 8, 12, eagle.z + 10);
      camera.lookAt(eagle.x, 0, eagle.z);
    } else if (elapsed < 2.0) {
      camera.position.set(eagle.x + 4, 6, eagle.z + 5);
      camera.lookAt(eagle.x, 1, eagle.z);
    } else {
      const t = Math.min(1, (elapsed - 2.0) / 1.0);
      const dist = 5 - t * 2;
      const tx = victim ? (eagle.x + victim.x) / 2 : eagle.x;
      const tz = victim ? (eagle.z + victim.z) / 2 : eagle.z;
      camera.position.set(tx + dist * 0.7, 3 + (1 - t) * 2, tz + dist);
      camera.lookAt(tx, 1, tz);
    }
  });

  return null;
}

// Renders all characters, interpolating positions from recorded frames
function ReplayCharacters({ replayData }: { replayData: ReplayData }) {
  const startTime = useRef(Date.now());
  const groupRef = useRef<THREE.Group>(null);
  const { frames, attackTime, attackerConnId } = replayData;

  // Store latest positions in refs for smooth updates
  const positionsRef = useRef<Record<string, { x: number; z: number; facingAngle: number; isMoving: boolean; chickColor: ChickColor; isEagle: boolean; alive: boolean }>>({});
  const inAttackPhaseRef = useRef(false);

  useFrame(() => {
    if (frames.length === 0) return;
    const elapsed = Math.min(3, (Date.now() - startTime.current) / 1000);
    const replayStartTime = attackTime - 3000;
    const targetTime = replayStartTime + elapsed * 1000;

    inAttackPhaseRef.current = elapsed >= 1.5 && elapsed < 2.0;

    // Find interpolation frames
    let frameA = frames[0];
    let frameB = frames[0];
    for (let i = 0; i < frames.length - 1; i++) {
      if (frames[i].time <= targetTime && frames[i + 1].time >= targetTime) {
        frameA = frames[i];
        frameB = frames[i + 1];
        break;
      }
      if (frames[i].time >= targetTime) { frameA = frames[i]; frameB = frames[i]; break; }
    }
    if (targetTime >= frames[frames.length - 1].time) {
      frameA = frames[frames.length - 1];
      frameB = frameA;
    }

    const dt = frameB.time - frameA.time;
    const t = dt > 0 ? Math.min(1, (targetTime - frameA.time) / dt) : 0;

    const newPositions: typeof positionsRef.current = {};
    const allIds = new Set([...Object.keys(frameA.players), ...Object.keys(frameB.players)]);
    for (const id of allIds) {
      const a = frameA.players[id];
      const b = frameB.players[id];
      const src = b ?? a;
      if (!src || !src.alive) continue;
      newPositions[id] = {
        x: a && b ? a.x + (b.x - a.x) * t : src.x,
        z: a && b ? a.z + (b.z - a.z) * t : src.z,
        facingAngle: src.facingAngle,
        isMoving: src.isMoving,
        chickColor: src.chickColor,
        isEagle: src.isEagle,
        alive: src.alive,
      };
    }
    positionsRef.current = newPositions;

    // Update group children positions
    if (groupRef.current) {
      const ids = Object.keys(newPositions);
      groupRef.current.children.forEach((child, i) => {
        const id = ids[i];
        if (id && newPositions[id]) {
          child.position.set(newPositions[id].x, 0, newPositions[id].z);
        }
      });
    }
  });

  // Get initial player set from first frame for rendering
  const playerIds = useMemo(() => {
    const allIds = new Set<string>();
    for (const f of frames) {
      for (const id of Object.keys(f.players)) {
        if (f.players[id].alive) allIds.add(id);
      }
    }
    return Array.from(allIds);
  }, [frames]);

  const initialPlayers = useMemo(() => {
    const result: Record<string, ReplayFramePlayer> = {};
    for (const id of playerIds) {
      for (const f of frames) {
        if (f.players[id]) { result[id] = f.players[id]; break; }
      }
    }
    return result;
  }, [playerIds, frames]);

  return (
    <group ref={groupRef}>
      {playerIds.map(id => {
        const p = initialPlayers[id];
        if (!p) return null;
        const isAttacker = id === attackerConnId;
        return (
          <group key={id} position={[p.x, 0, p.z]}>
            <CharacterViewer
              color={p.chickColor as ChickColor}
              animState={isAttacker ? 'Running' : (p.isMoving ? 'Running' : 'Idle')}
              facingAngle={p.facingAngle}
            />
          </group>
        );
      })}
    </group>
  );
}

function ReplayScene({ replayData }: { replayData: ReplayData }) {
  return (
    <>
      <ambientLight intensity={0.7} color="#fffaf0" />
      <directionalLight position={[20, 35, 15]} intensity={1.6} color="#fff5e0" />
      <directionalLight position={[-15, 20, -10]} intensity={0.4} color="#b0d0ff" />
      <gridHelper args={[60, 60, '#333', '#222']} />
      <ReplayCamera replayData={replayData} />
      <Suspense fallback={null}>
        <ReplayCharacters replayData={replayData} />
      </Suspense>
    </>
  );
}

export default function ReplayCountdownOverlay({ replayData, secondsLeft }: Props) {
  const countdownNum = Math.ceil(secondsLeft);

  const initialPos = useMemo(() => {
    const firstFrame = replayData.frames[0];
    const eagle = firstFrame?.players[replayData.attackerConnId];
    return eagle ? { x: eagle.x, z: eagle.z } : { x: 0, z: 0 };
  }, [replayData]);

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-background/90" style={{ zIndex: 2147483647 }}>
      <div className="relative w-[85vw] h-[65vh] max-w-[1200px] max-h-[700px] rounded-lg shadow-2xl overflow-hidden border border-border bg-card">
        {/* Left side — Replay (trapezoid via clip-path) */}
        <div
          className="absolute inset-0"
          style={{ clipPath: 'polygon(0 0, 70% 0, 55% 100%, 0 100%)' }}
        >
          <Canvas
            camera={{ position: [initialPos.x + 8, 12, initialPos.z + 10], fov: 45 }}
            className="w-full h-full"
          >
            <ReplayScene replayData={replayData} />
          </Canvas>
          {/* REPLAY label */}
          <div className="absolute top-3 left-4 px-3 py-1 rounded bg-destructive/80 text-destructive-foreground font-pixel text-xs tracking-widest">
            ⏪ REPLAY
          </div>
        </div>

        {/* SVG diagonal line divider */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          <line x1="70%" y1="0" x2="55%" y2="100%" stroke="hsl(var(--border))" strokeWidth="3" />
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
