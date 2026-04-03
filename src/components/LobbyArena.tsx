import { useRef, useEffect, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, Html } from "@react-three/drei";
import type { PlayerState } from "@/hooks/useGameRoom";
import { PLAYER_COLORS } from "@/lib/playerColors";
import CharacterViewer from "@/components/CharacterViewer";
import type { ChickColor } from "@/components/CharacterViewer";
import * as THREE from "three";

interface Props {
  players: Map<string, PlayerState>;
}

const SPEED = 5;
const BALL_RADIUS = 0.75;
const PLAYER_RADIUS = 0.6;
const LOBBY_BOUNDS = 7.5;
const FRICTION = 0.88;
const PUSH_THRESHOLD = BALL_RADIUS + PLAYER_RADIUS;

interface PlayerPos {
  x: number;
  z: number;
  facingAngle: number;
}

interface BallState {
  id: 'LOBBY-SPEED' | 'LOBBY-HEAL';
  x: number;
  z: number;
  vx: number;
  vz: number;
}

type AnimState = "Idle" | "Running";

function getAnimFromJoystick(jx: number, jy: number): { anim: AnimState; angle: number; magnitude: number } {
  const iy = -jy;
  const magnitude = Math.sqrt(jx * jx + iy * iy);
  if (magnitude < 0.05) return { anim: "Idle", angle: 0, magnitude: 0 };
  const angle = Math.atan2(-jx, iy);
  const anim: AnimState = magnitude > 0.6 ? "Running" : "Idle";
  return { anim, angle, magnitude };
}

function LobbyPlayer({
  playerState,
  position,
  chickColor,
}: {
  playerState: PlayerState;
  position: PlayerPos;
  chickColor: ChickColor;
}) {
  const { anim, angle } = getAnimFromJoystick(playerState.joystick.x, playerState.joystick.y);
  const effectiveAngle = anim === "Idle" ? position.facingAngle : angle;
  return (
    <group position={[position.x, 0, position.z]}>
      <Suspense fallback={null}>
        <CharacterViewer color={chickColor} animState={anim} facingAngle={effectiveAngle} />
      </Suspense>
    </group>
  );
}

// Crystal ball prop display
function CrystalBall({ ball, propType }: { ball: BallState; propType: 'speed' | 'heal' }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const innerRef = useRef<THREE.Mesh>(null!);
  const color = propType === 'speed' ? '#facc15' : '#22c55e';
  const label = propType === 'speed' ? 'SPEED UP' : 'HEAL';
  const icon = propType === 'speed' ? '⚡' : '💚';

  useFrame((_, delta) => {
    // Gentle float animation
    if (meshRef.current) {
      meshRef.current.position.y = BALL_RADIUS + Math.sin(Date.now() * 0.002) * 0.08;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y += delta * 0.8;
    }
  });

  return (
    <group position={[ball.x, 0, ball.z]}>
      {/* Outer crystal sphere */}
      <mesh ref={meshRef} position={[0, BALL_RADIUS, 0]}>
        <sphereGeometry args={[BALL_RADIUS, 28, 28]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          transparent
          opacity={0.55}
          roughness={0.0}
          metalness={0.15}
        />
      </mesh>

      {/* Inner glowing core */}
      <mesh ref={innerRef} position={[0, BALL_RADIUS, 0]}>
        <sphereGeometry args={[BALL_RADIUS * 0.45, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Ground glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[BALL_RADIUS * 0.7, BALL_RADIUS * 1.3, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Label tag only — no QR code */}
      <Html position={[0, BALL_RADIUS * 2.2, 0]} center occlude={false} zIndexRange={[100, 0]}>
        <div style={{ pointerEvents: 'none', textAlign: 'center', userSelect: 'none' }}>
          <div style={{
            background: 'linear-gradient(135deg, #fff 60%, #f0f0f0)',
            border: `2.5px solid ${color}`,
            borderRadius: 5,
            padding: '3px 10px',
            whiteSpace: 'nowrap',
            fontSize: 11,
            fontFamily: '"Press Start 2P", monospace',
            fontWeight: 'bold',
            color: '#111',
            boxShadow: `0 3px 10px ${color}88, 0 1px 3px rgba(0,0,0,0.3)`,
            letterSpacing: 1,
          }}>
            {icon} {label}
          </div>
        </div>
      </Html>
    </group>
  );
}

// Handles player movement and ball physics inside Canvas
function SceneUpdater({
  players,
  positions,
  setPositions,
  balls,
  setBalls,
}: {
  players: Map<string, PlayerState>;
  positions: Map<string, PlayerPos>;
  setPositions: React.Dispatch<React.SetStateAction<Map<string, PlayerPos>>>;
  balls: BallState[];
  setBalls: React.Dispatch<React.SetStateAction<BallState[]>>;
}) {
  useFrame((_, delta) => {
    // ── Player movement ──
    let posChanged = false;
    const nextPos = new Map(positions);
    for (const [key, pos] of nextPos) {
      const player = players.get(key);
      if (!player) continue;
      const { joystick } = player;
      const { magnitude } = getAnimFromJoystick(joystick.x, joystick.y);
      if (magnitude < 0.05) continue;
      posChanged = true;
      const iy = -joystick.y;
      const moveAngle = Math.atan2(-joystick.x, iy);
      const spd = magnitude * SPEED * delta;
      nextPos.set(key, {
        x: Math.max(-LOBBY_BOUNDS + PLAYER_RADIUS, Math.min(LOBBY_BOUNDS - PLAYER_RADIUS, pos.x + Math.sin(moveAngle) * spd * -1)),
        z: Math.max(-LOBBY_BOUNDS + PLAYER_RADIUS, Math.min(LOBBY_BOUNDS - PLAYER_RADIUS, pos.z + Math.cos(moveAngle) * spd * -1)),
        facingAngle: moveAngle,
      });
    }
    if (posChanged) setPositions(nextPos);

    // ── Ball physics ──
    const playerList = Array.from(nextPos.values());
    setBalls((prev) => {
      const next = prev.map((ball) => {
        let { x, z, vx, vz } = ball;

        // Apply velocity
        x += vx * delta;
        z += vz * delta;

        // Friction
        vx *= Math.pow(FRICTION, delta * 60);
        vz *= Math.pow(FRICTION, delta * 60);

        // Wall bounce with some energy loss
        if (x < -LOBBY_BOUNDS + BALL_RADIUS) { x = -LOBBY_BOUNDS + BALL_RADIUS; vx = Math.abs(vx) * 0.6; }
        if (x >  LOBBY_BOUNDS - BALL_RADIUS) { x =  LOBBY_BOUNDS - BALL_RADIUS; vx = -Math.abs(vx) * 0.6; }
        if (z < -LOBBY_BOUNDS + BALL_RADIUS) { z = -LOBBY_BOUNDS + BALL_RADIUS; vz = Math.abs(vz) * 0.6; }
        if (z >  LOBBY_BOUNDS - BALL_RADIUS) { z =  LOBBY_BOUNDS - BALL_RADIUS; vz = -Math.abs(vz) * 0.6; }

        // Push from players
        for (const pos of playerList) {
          const dx = x - pos.x;
          const dz = z - pos.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < PUSH_THRESHOLD && dist > 0.01) {
            const force = (PUSH_THRESHOLD - dist) * 6 * delta * 60;
            const nx = dx / dist;
            const nz = dz / dist;
            vx += nx * force;
            vz += nz * force;
            // Push ball out of player
            x = pos.x + nx * PUSH_THRESHOLD;
            z = pos.z + nz * PUSH_THRESHOLD;
          }
        }

        // Cap max speed
        const spd = Math.sqrt(vx * vx + vz * vz);
        if (spd > 12) { vx = (vx / spd) * 12; vz = (vz / spd) * 12; }

        return { ...ball, x, z, vx, vz };
      });

      // Ball-ball collision
      if (next.length === 2) {
        const [a, b] = next;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const minDist = BALL_RADIUS * 2;
        if (dist < minDist && dist > 0.01) {
          const nx = dx / dist;
          const nz = dz / dist;
          const overlap = (minDist - dist) / 2;
          next[0] = { ...a, x: a.x - nx * overlap, z: a.z - nz * overlap };
          next[1] = { ...b, x: b.x + nx * overlap, z: b.z + nz * overlap };
        }
      }

      return next;
    });
  });

  return null;
}

const START_POSITIONS: [number, number][] = [
  [0, -3],
  [-2.5, 2.5],
  [0, 3],
  [2.5, 2.5],
  [-4, -1],
  [4, -1],
  [-3.5, 1],
  [3.5, 1],
];

const INITIAL_BALLS: BallState[] = [
  { id: 'LOBBY-SPEED', x: -1.5, z: 0, vx: 0, vz: 0 },
  { id: 'LOBBY-HEAL',  x:  1.5, z: 0, vx: 0, vz: 0 },
];

export default function LobbyArena({ players }: Props) {
  const [positions, setPositions] = useState<Map<string, PlayerPos>>(new Map());
  const [balls, setBalls] = useState<BallState[]>(INITIAL_BALLS);
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    setPositions((prev) => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (!players.has(key)) next.delete(key);
      }
      let idx = 0;
      for (const key of players.keys()) {
        if (!next.has(key)) {
          const sp = START_POSITIONS[idx % START_POSITIONS.length];
          next.set(key, { x: sp[0], z: sp[1], facingAngle: 0 });
        }
        idx++;
      }
      return next;
    });
  }, [players]);

  return (
    <div className="w-full h-full rounded-lg border border-border overflow-hidden bg-background relative">
      <Canvas
        camera={{ position: [0, 8, 10], fov: 40 }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        gl={{ antialias: !isMobile, powerPreference: 'default', preserveDrawingBuffer: false }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1} />
        <directionalLight position={[-3, 6, -3]} intensity={0.3} />
        <pointLight position={[0, 4, 0]} intensity={0.4} color="#ffffff" />

        <Grid
          args={[20, 20]}
          position={[0, -0.01, 0]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#444444"
          sectionSize={2}
          sectionThickness={1}
          sectionColor="#666666"
          fadeDistance={15}
          infiniteGrid
        />

        <SceneUpdater
          players={players}
          positions={positions}
          setPositions={setPositions}
          balls={balls}
          setBalls={setBalls}
        />

        {/* Crystal ball lobby props */}
        {balls.map((ball) => (
          <CrystalBall
            key={ball.id}
            ball={ball}
            propType={ball.id === 'LOBBY-SPEED' ? 'speed' : 'heal'}
          />
        ))}

        {/* Player characters */}
        {Array.from(positions.entries()).map(([id, pos]) => {
          const player = players.get(id);
          if (!player) return null;
          const colorInfo = PLAYER_COLORS[player.colorIndex] ?? PLAYER_COLORS[0];
          return (
            <LobbyPlayer key={id} playerState={player} position={pos} chickColor={colorInfo.chickColor} />
          );
        })}
      </Canvas>

      {players.size === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-xs text-muted-foreground font-mono animate-pulse">WAITING FOR PLAYERS...</p>
        </div>
      )}
    </div>
  );
}
