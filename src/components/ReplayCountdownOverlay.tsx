import { useRef, useMemo, Suspense } from "react";
import { createPortal } from "react-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import CharacterViewer from "@/components/CharacterViewer";
import type { ReplayData, ReplayFramePlayer } from "@/lib/gameTypes";
import type { ChickColor } from "@/components/CharacterViewer";

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
  const { camera } = useThree();
  const { attackerConnId, victimConnIds, frames, attackTime, attackerFacingAngle } = replayData;

  // Camera offset: opposite of eagle's facing direction
  const behindDir = useMemo(() => {
    const angle = attackerFacingAngle + Math.PI; // opposite
    return { x: Math.sin(angle), z: Math.cos(angle) };
  }, [attackerFacingAngle]);

  useFrame(() => {
    if (frames.length === 0) return;
    const elapsed = Math.min(3, (Date.now() - startTime.current) / 1000);

    // Replay starts 1.5s before attack
    const replayStartTime = attackTime - 1500;
    const targetTime = replayStartTime + elapsed * 1000;

    // Find closest frame
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
      // Wide shot from behind eagle
      camera.position.set(eagle.x + behindDir.x * 10, 12, eagle.z + behindDir.z * 10);
      camera.lookAt(eagle.x, 0, eagle.z);
    } else if (elapsed < 2.0) {
      // Attack moment — closer, still from behind
      camera.position.set(eagle.x + behindDir.x * 5, 6, eagle.z + behindDir.z * 5);
      camera.lookAt(eagle.x, 1, eagle.z);
    } else {
      // Zoom-in static — focus on eagle/victim midpoint
      const t = Math.min(1, (elapsed - 2.0) / 1.0);
      const dist = 4 - t * 1.5;
      const tx = victim ? (eagle.x + victim.x) / 2 : eagle.x;
      const tz = victim ? (eagle.z + victim.z) / 2 : eagle.z;
      camera.position.set(tx + behindDir.x * dist, 3 + (1 - t) * 2, tz + behindDir.z * dist);
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

  const positionsRef = useRef<
    Record<
      string,
      {
        x: number;
        z: number;
        facingAngle: number;
        isMoving: boolean;
        chickColor: ChickColor;
        isEagle: boolean;
        alive: boolean;
      }
    >
  >({});

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
      if (frames[i].time >= targetTime) {
        frameA = frames[i];
        frameB = frames[i];
        break;
      }
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
        if (f.players[id]) {
          result[id] = f.players[id];
          break;
        }
      }
    }
    return result;
  }, [playerIds, frames]);

  return (
    <group ref={groupRef}>
      {playerIds.map((id) => {
        const p = initialPlayers[id];
        if (!p) return null;
        const isAttacker = id === attackerConnId;
        return (
          <group key={id} position={[p.x, 0, p.z]}>
            <CharacterViewer
              color={p.chickColor as ChickColor}
              animState={isAttacker ? "Running" : p.isMoving ? "Running" : "Idle"}
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
      <gridHelper args={[60, 60, "#333", "#222"]} />
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
        {/* Left side — Replay (trapezoid via clip-path) */}
        <div className="absolute inset-0" style={{ clipPath: "polygon(0 0, 80% 0, 65% 100%, 0 100%)" }}>
          <Canvas camera={{ position: initialCamPos, fov: 45 }} className="w-full h-full">
            <ReplayScene replayData={replayData} />
          </Canvas>
          {/* REPLAY label */}
          <div className="absolute top-3 left-4 px-3 py-1 rounded bg-destructive/80 text-destructive-foreground font-pixel text-xs tracking-widest">
            REPLAY
          </div>
        </div>

        {/* SVG diagonal line divider */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          <line x1="80%" y1="0" x2="65%" y2="100%" stroke="hsl(var(--border))" strokeWidth="3" />
        </svg>

        {/* Right side — Countdown */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ clipPath: "polygon(80% 0, 100% 0, 100% 100%, 65% 100%)" }}
        >
          <div
            className="flex flex-col items-center gap-4"
            style={{
              position: "absolute",
              top: "70%",
              transform: "translateY(-50%)",
              left: "auto",
              right: "8%",
            }}
          >
            <span className="text-sm font-pixel tracking-[0.3em] text-muted-foreground uppercase">Resuming</span>
            <div
              key={countdownNum}
              className="font-pixel leading-none"
              style={{
                fontSize: "clamp(10rem, 25vw, 20rem)",
                color: "hsl(var(--primary))",
                textShadow: "0 0 40px hsl(var(--primary) / 0.6), 0 0 80px hsl(var(--primary) / 0.3)",
                animation: "pulse 1s ease-in-out infinite",
              }}
            >
              {countdownNum > 0 ? countdownNum : ""}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
