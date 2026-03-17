import { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import type { PlayerState } from '@/hooks/useGameRoom';
import { PLAYER_COLORS } from '@/lib/playerColors';
import CharacterViewer from '@/components/CharacterViewer';
import type { ChickColor } from '@/components/CharacterViewer';
import * as THREE from 'three';

interface Props {
  players: Map<string, PlayerState>;
}

const SPEED = 3;

interface PlayerPos {
  x: number;
  z: number;
  facingAngle: number;
}

type AnimState = 'Idle' | 'Walking' | 'Running';

function getAnimFromJoystick(jx: number, jy: number): { anim: AnimState; angle: number; magnitude: number } {
  const iy = -jy; // invert Y
  const magnitude = Math.sqrt(jx * jx + iy * iy);
  if (magnitude < 0.05) return { anim: 'Idle', angle: 0, magnitude: 0 };
  const angle = Math.atan2(-jx, iy);
  const anim: AnimState = magnitude > 0.6 ? 'Running' : 'Walking';
  return { anim, angle, magnitude };
}

// Individual player character in the 3D scene
function LobbyPlayer({ playerState, position, chickColor }: {
  playerState: PlayerState;
  position: PlayerPos;
  chickColor: ChickColor;
}) {
  const { anim, angle } = getAnimFromJoystick(playerState.joystick.x, playerState.joystick.y);
  const effectiveAngle = anim === 'Idle' ? position.facingAngle : angle;

  return (
    <group position={[position.x, 0, position.z]}>
      <Suspense fallback={null}>
        <CharacterViewer
          color={chickColor}
          animState={anim}
          facingAngle={effectiveAngle}
        />
      </Suspense>
    </group>
  );
}

// Position updater component inside the Canvas
function PositionUpdater({
  players,
  positions,
  setPositions,
}: {
  players: Map<string, PlayerState>;
  positions: Map<string, PlayerPos>;
  setPositions: React.Dispatch<React.SetStateAction<Map<string, PlayerPos>>>;
}) {
  useFrame((_, delta) => {
    let changed = false;
    const next = new Map(positions);

    for (const [key, pos] of next) {
      const player = players.get(key);
      if (!player) continue;
      const { joystick } = player;
      const { magnitude } = getAnimFromJoystick(joystick.x, joystick.y);
      if (magnitude < 0.05) continue;

      changed = true;
      const iy = -joystick.y;
      const moveAngle = Math.atan2(-joystick.x, iy);
      const speed = magnitude * SPEED * delta;

      next.set(key, {
        x: Math.max(-8, Math.min(8, pos.x + Math.sin(moveAngle) * speed * -1)),
        z: Math.max(-8, Math.min(8, pos.z + Math.cos(moveAngle) * speed * -1)),
        facingAngle: moveAngle,
      });
    }

    if (changed) setPositions(next);
  });

  return null;
}

// Starting positions for up to 4 players
const START_POSITIONS: [number, number][] = [
  [0, -2],    // Eagle center-back
  [-2, 2],    // Chick left-front
  [0, 2],     // Chick center-front
  [2, 2],     // Chick right-front
];

export default function LobbyArena({ players }: Props) {
  const [positions, setPositions] = useState<Map<string, PlayerPos>>(new Map());

  // Keep positions in sync with active players
  useEffect(() => {
    setPositions((prev) => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (!players.has(key)) next.delete(key);
      }
      let idx = 0;
      for (const key of players.keys()) {
        if (!next.has(key)) {
          const startPos = START_POSITIONS[idx % START_POSITIONS.length];
          next.set(key, { x: startPos[0], z: startPos[1], facingAngle: 0 });
        }
        idx++;
      }
      return next;
    });
  }, [players]);

  return (
    <div className="w-full h-full rounded-lg border border-border overflow-hidden bg-background">
      <Canvas camera={{ position: [0, 8, 10], fov: 40 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1} />
        <directionalLight position={[-3, 6, -3]} intensity={0.3} />

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

        <PositionUpdater
          players={players}
          positions={positions}
          setPositions={setPositions}
        />

        {Array.from(positions.entries()).map(([id, pos]) => {
          const player = players.get(id);
          if (!player) return null;
          const colorInfo = PLAYER_COLORS[player.colorIndex] ?? PLAYER_COLORS[0];
          return (
            <LobbyPlayer
              key={id}
              playerState={player}
              position={pos}
              chickColor={colorInfo.chickColor}
            />
          );
        })}
      </Canvas>

      {/* Empty state */}
      {players.size === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-xs text-muted-foreground font-mono animate-pulse">
            WAITING FOR PLAYERS...
          </p>
        </div>
      )}
    </div>
  );
}
