import { useRef, useMemo, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import CharacterViewer from "@/components/CharacterViewer";
import type { ReplayData, ReplayFramePlayer } from "@/lib/gameTypes";
import type { ChickColor } from "@/components/CharacterViewer";
import type { AnimState } from "@/lib/gameTypes";

const FLY_SPEED_MULTIPLIER = 3;

interface Props {
  replayData: ReplayData;
  secondsLeft: number;
}

function ReplayCamera({ replayData }: { replayData: ReplayData }) {
  const startTime = useRef(Date.now());
  const { camera } = useThree();
  const { attackerConnId, victimConnIds, frames, attackTime, attackerFacingAngle } = replayData;

  const behindDir = useMemo(() => {
    const angle = attackerFacingAngle + Math.PI;
    return { x: Math.sin(angle), z: Math.cos(angle) };
  }, [attackerFacingAngle]);

  useFrame(() => {
    if (frames.length === 0) return;
    const elapsed = Math.min(3, (Date.now() - startTime.current) / 1000);
    const replayStartTime = attackTime - 1500;
    const targetTime = replayStartTime + elapsed * 1000;

    let currentFrame = frames[frames.length - 1];
    for (const f of frames) {
      if (f.time >= targetTime) { currentFrame = f; break; }
    }

    const eagle = currentFrame.players[attackerConnId];
    const victim = victimConnIds.length > 0 ? currentFrame.players[victimConnIds[0]] : null;
    if (!eagle) return;

    if (elapsed < 1.5) {
      camera.position.set(eagle.x + behindDir.x * 10, 12, eagle.z + behindDir.z * 10);
      camera.lookAt(eagle.x, 0, eagle.z);
    } else if (elapsed < 2.0) {
      camera.position.set(eagle.x + behindDir.x * 5, 6, eagle.z + behindDir.z * 5);
      camera.lookAt(eagle.x, 1, eagle.z);
    } else {
      const t = Math.min(1, (elapsed - 2.0) / 1.0);
      const dist = 4 - t * 1;
      const tx = victim ? (eagle.x + victim.x) / 2 : eagle.x;
      const tz = victim ? (eagle.z + victim.z) / 2 : eagle.z;
      camera.position.set(tx + behindDir.x * dist, 3 + (1 - t) * 2, tz + behindDir.z * dist);
      camera.lookAt(tx, 1, tz);
    }
  });

  return null;
}

function getAnimForPlayer(p: ReplayFramePlayer, isAttacker: boolean, elapsedMs: number, attackTime: number, replayStartTime: number): AnimState {
  // After the attack moment (1.5s into replay), keep the eagle attacker in Attack animation
  const attackMomentInReplay = attackTime - replayStartTime;
  if (isAttacker && elapsedMs >= attackMomentInReplay) return "Attack";
  const isFlying = p.isEagle && (p.speedMultiplier ?? 1) >= FLY_SPEED_MULTIPLIER;
  if (p.isAttacking || isFlying) return "Attack";
  if (p.isMoving) return "Running";
  return "Idle";
}

function ReplayCharacters({ replayData }: { replayData: ReplayData }) {
  const startTime = useRef(Date.now());
  const groupRef = useRef<THREE.Group>(null);
  const { frames, attackTime, attackerConnId } = replayData;

  const [animStates, setAnimStates] = useState<Record<string, AnimState>>({});

  useFrame(() => {
    if (frames.length === 0) return;
    const elapsed = Math.min(3, (Date.now() - startTime.current) / 1000);
    const replayStartTime = attackTime - 1500;
    const targetTime = replayStartTime + elapsed * 1000;

    let frameA = frames[0];
    let frameB = frames[0];
    for (let i = 0; i < frames.length - 1; i++) {
      if (frames[i].time <= targetTime && frames[i + 1].time >= targetTime) {
        frameA = frames[i]; frameB = frames[i + 1]; break;
      }
      if (frames[i].time >= targetTime) {
        frameA = frames[i]; frameB = frames[i]; break;
      }
    }
    if (targetTime >= frames[frames.length - 1].time) {
      frameA = frames[frames.length - 1]; frameB = frameA;
    }

    const dt = frameB.time - frameA.time;
    const t = dt > 0 ? Math.min(1, (targetTime - frameA.time) / dt) : 0;

    const newAnims: Record<string, AnimState> = {};
    const allIds = new Set([...Object.keys(frameA.players), ...Object.keys(frameB.players)]);

    if (groupRef.current) {
      const idsArr = Array.from(allIds);
      let childIdx = 0;
      for (const id of idsArr) {
        const a = frameA.players[id];
        const b = frameB.players[id];
        const src = b ?? a;
        if (!src || !src.alive) continue;

        const x = a && b ? a.x + (b.x - a.x) * t : src.x;
        const z = a && b ? a.z + (b.z - a.z) * t : src.z;

        if (childIdx < groupRef.current.children.length) {
          groupRef.current.children[childIdx].position.set(x, 0, z);
        }

        const isAttacker = id === attackerConnId;
        newAnims[id] = getAnimForPlayer(src, isAttacker, elapsed * 1000, attackTime, replayStartTime);
        childIdx++;
      }
    }

    setAnimStates(prev => {
      let changed = false;
      for (const k in newAnims) {
        if (prev[k] !== newAnims[k]) { changed = true; break; }
      }
      return changed ? newAnims : prev;
    });
  });

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
      {playerIds.map((id) => {
        const p = initialPlayers[id];
        if (!p) return null;
        const isAttacker = id === attackerConnId;
        const anim = animStates[id] ?? getAnimForPlayer(p, isAttacker, 0, attackTime, attackTime - 1500);
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
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background/90" style={{ zIndex: 2147483647 }}>
      {/* REPLAY badge above the box */}
      <div className="mb-2 px-4 py-1 rounded bg-destructive/80 text-destructive-foreground font-pixel text-sm tracking-widest z-20">
        REPLAY
      </div>

      <div className="relative w-[85vw] h-[65vh] max-w-[1200px] max-h-[700px] rounded-lg shadow-2xl overflow-hidden border border-border bg-card">
        {/* Left Top Countdown */}
        <div className="absolute" style={{ top: "6%", left: "3%" }}>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-pixel tracking-[0.3em] text-muted-foreground uppercase">Resuming</span>
            <div
              key={countdownNum}
              className="font-pixel leading-none"
              style={{
                fontSize: "clamp(4rem, 10vw, 8rem)",
                color: "hsl(var(--primary))",
                textShadow: "0 0 40px hsl(var(--primary) / 0.6), 0 0 80px hsl(var(--primary) / 0.3)",
                animation: "pulse 1s ease-in-out infinite",
              }}
            >
              {countdownNum > 0 ? countdownNum : ""}
            </div>
          </div>
        </div>

        {/* SVG diagonal line divider 1 */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          <line x1="20%" y1="0" x2="5%" y2="100%" stroke="hsl(var(--border))" strokeWidth="3" />
        </svg>

        {/* Replay area */}
        <div className="absolute inset-0" style={{ clipPath: "polygon(20% 0, 95% 0, 80% 100%, 5% 100%)" }}>
          <Canvas camera={{ position: initialCamPos, fov: 45 }} className="w-full h-full">
            <ReplayScene replayData={replayData} />
          </Canvas>
        </div>

        {/* SVG diagonal line divider 2 */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          <line x1="95%" y1="0" x2="80%" y2="100%" stroke="hsl(var(--border))" strokeWidth="3" />
        </svg>

        {/* Right Bottom Countdown */}
        <div className="absolute" style={{ bottom: "5%", right: "2.5%" }}>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-pixel tracking-[0.3em] text-muted-foreground uppercase">Resuming</span>
            <div
              key={countdownNum}
              className="font-pixel leading-none"
              style={{
                fontSize: "clamp(4rem, 10vw, 8rem)",
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
