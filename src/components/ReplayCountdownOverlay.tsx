import { useRef, useMemo, useState, Suspense } from 'react';
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

// Total replay duration = 3s
// Phase 1 (0–1.5s): wide shot from behind eagle, replaying 1.5s before attack
// Phase 2 (1.5–2.0s): attack moment, closer
// Phase 3 (2.0–3.0s): zoom-in static on eagle/victim area

function ReplayCamera({ replayData }: { replayData: ReplayData }) {
  const startTime = useRef(Date.now());
  const { camera, size } = useThree();
  const { attackerConnId, victimConnIds, frames, attackTime } = replayData;

  // Apply view offset so the focal point sits at ~1/3 from the right of the usable canvas area.
  // The right 25% of the canvas is obscured by the countdown panel, so shift the
  // camera frustum to the right so the subject ends up at roughly 2/3 of the visible region.
  const offsetApplied = useRef(false);

  useFrame(() => {
    if (frames.length === 0) return;
    const elapsed = Math.min(3, (Date.now() - startTime.current) / 1000);

    // Apply view offset once we have size — render only in left 75% of canvas
    if (!offsetApplied.current && size.width > 0) {
      const cam = camera as THREE.PerspectiveCamera;
      const leftWidth = size.width * 0.75;
      cam.setViewOffset(size.width, size.height, 0, 0, leftWidth, size.height);
      cam.updateProjectionMatrix();
      offsetApplied.current = true;
    }

    // Replay starts 1.5s before attack
    const replayStartTime = attackTime - 1500;
    const targetTime = replayStartTime + elapsed * 1000;

    // Find closest frame
    let currentFrame = frames[frames.length - 1];
    for (const f of frames) {
      if (f.time >= targetTime) { currentFrame = f; break; }
    }

    const eagle = currentFrame.players[attackerConnId];
    const victim = victimConnIds.length > 0 ? currentFrame.players[victimConnIds[0]] : null;
    if (!eagle) return;

    // Dynamic camera direction: follows eagle's current facing angle (third-person behind)
    const behindAngle = eagle.facingAngle + Math.PI;
    const bx = Math.sin(behindAngle);
    const bz = Math.cos(behindAngle);

    if (elapsed < 1.5) {
      // Wide shot from behind eagle, following eagle's facing
      camera.position.set(
        eagle.x + bx * 10,
        12,
        eagle.z + bz * 10
      );
      camera.lookAt(eagle.x, 0, eagle.z);
    } else if (elapsed < 2.0) {
      // Attack moment — closer, still following facing
      camera.position.set(
        eagle.x + bx * 5,
        6,
        eagle.z + bz * 5
      );
      camera.lookAt(eagle.x, 1, eagle.z);
    } else {
      // Zoom-in — focus on eagle/victim midpoint
      const t = Math.min(1, (elapsed - 2.0) / 1.0);
      const dist = 4 - t * 1.5;
      const tx = victim ? (eagle.x + victim.x) / 2 : eagle.x;
      const tz = victim ? (eagle.z + victim.z) / 2 : eagle.z;
      camera.position.set(
        tx + bx * dist,
        3 + (1 - t) * 2,
        tz + bz * dist
      );
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

  const positionsRef = useRef<Record<string, { x: number; z: number; facingAngle: number; isMoving: boolean; isAttacking: boolean; chickColor: ChickColor; isEagle: boolean; alive: boolean }>>({});
  const [animStates, setAnimStates] = useState<Record<string, string>>({});

  useFrame(() => {
    if (frames.length === 0) return;
    const elapsed = Math.min(3, (Date.now() - startTime.current) / 1000);
    const replayStartTime = attackTime - 1500;
    const targetTime = replayStartTime + elapsed * 1000;

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
    const newAnims: Record<string, string> = {};
    const allIds = new Set([...Object.keys(frameA.players), ...Object.keys(frameB.players)]);
    for (const id of allIds) {
      const a = frameA.players[id];
      const b = frameB.players[id];
      const src = b ?? a;
      if (!src || !src.alive) continue;
      const isAttacking = src.isAttacking ?? false;
      const isMoving = src.isMoving ?? false;
      newPositions[id] = {
        x: a && b ? a.x + (b.x - a.x) * t : src.x,
        z: a && b ? a.z + (b.z - a.z) * t : src.z,
        facingAngle: src.facingAngle,
        isMoving,
        isAttacking,
        chickColor: src.chickColor,
        isEagle: src.isEagle,
        alive: src.alive,
      };
      newAnims[id] = isAttacking ? 'Attack' : (isMoving ? 'Running' : 'Idle');
    }
    positionsRef.current = newPositions;

    // Update anim states for React re-render (throttled)
    setAnimStates(prev => {
      const changed = Object.keys(newAnims).some(id => prev[id] !== newAnims[id]);
      return changed ? newAnims : prev;
    });

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
        const anim = (animStates[id] ?? (p.isAttacking ? 'Attack' : (p.isMoving ? 'Running' : 'Idle'))) as 'Idle' | 'Running' | 'Attack' | 'Victory';
        return (
          <group key={id} position={[p.x, 0, p.z]}>
            <CharacterViewer
              color={p.chickColor as ChickColor}
              animState={anim}
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

  const initialCamPos = useMemo(() => {
    const firstFrame = replayData.frames[0];
    const eagle = firstFrame?.players[replayData.attackerConnId];
    const angle = (replayData.attackerFacingAngle ?? 0) + Math.PI;
    const ex = eagle?.x ?? 0;
    const ez = eagle?.z ?? 0;
    return [ex + Math.sin(angle) * 10, 12, ez + Math.cos(angle) * 10] as [number, number, number];
  }, [replayData]);

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-background/90" style={{ zIndex: 2147483647 }}>
      <div className="relative w-[85vw] h-[65vh] max-w-[1200px] max-h-[700px] rounded-lg shadow-2xl overflow-hidden border border-border bg-card">
        {/* Left side — Replay (trapezoid, right edge at 80%/65% so center ~37.5% ≈ 3/8 from left) */}
        <div
          className="absolute inset-0"
          style={{ clipPath: 'polygon(0 0, 80% 0, 65% 100%, 0 100%)' }}
        >
          <Canvas
            camera={{ position: initialCamPos, fov: 45 }}
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
          <line x1="80%" y1="0" x2="65%" y2="100%" stroke="hsl(var(--border))" strokeWidth="3" />
        </svg>

        {/* Right side — Countdown */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ clipPath: 'polygon(80% 0, 100% 0, 100% 100%, 65% 100%)' }}
        >
          <div className="flex flex-col items-center gap-4" style={{ position: 'absolute', right: '8%', top: '50%', transform: 'translateY(-50%)' }}>
            <span className="text-sm font-pixel tracking-[0.3em] text-muted-foreground uppercase">Resuming</span>
            <div
              key={countdownNum}
              className="font-pixel leading-none"
              style={{
                fontSize: 'clamp(6rem, 15vw, 12rem)',
                color: 'hsl(var(--primary))',
                textShadow: '0 0 40px hsl(var(--primary) / 0.6), 0 0 80px hsl(var(--primary) / 0.3)',
                animation: 'pulse 1s ease-in-out infinite',
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
