import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';
import CharacterViewer from '@/components/CharacterViewer';
import { BUILDINGS, OBSTACLES, MAP_SIZE } from '@/lib/gameplayMapData';
import { PLAYER_COLORS } from '@/lib/playerColors';
import type { PlayerGameStateSerializable, BuildingState } from '@/lib/gameTypes';

interface Props {
  players: Record<string, PlayerGameStateSerializable>;
  buildings?: BuildingState[];
  eagleAwake?: boolean;
}

function Building({ position, size, glowing }: {
  position: { x: number; z: number };
  size: { w: number; h: number; d: number };
  glowing?: boolean;
}) {
  return (
    <group position={[position.x, size.h / 2, position.z]}>
      <mesh>
        <boxGeometry args={[size.w, size.h, size.d]} />
        <meshStandardMaterial
          color={glowing ? '#ffd700' : '#2a2a4a'}
          emissive={glowing ? '#ffd700' : '#1a1a3a'}
          emissiveIntensity={glowing ? 0.5 : 0.2}
        />
      </mesh>
      {/* Roof */}
      <mesh position={[0, size.h / 2 + 0.15, 0]}>
        <boxGeometry args={[size.w + 0.4, 0.3, size.d + 0.4]} />
        <meshStandardMaterial
          color={glowing ? '#ffaa00' : '#3a3a5a'}
          emissive={glowing ? '#ffaa00' : '#2a2a4a'}
          emissiveIntensity={glowing ? 0.4 : 0.1}
        />
      </mesh>
      {/* Protected zone ring (if glowing) */}
      {glowing && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -size.h / 2 + 0.05, 0]}>
          <ringGeometry args={[2.2, 2.6, 32]} />
          <meshStandardMaterial color="#ffd700" emissive="#ffd700" emissiveIntensity={0.6} transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function Obstacle({ position, size, rotation }: {
  position: { x: number; z: number };
  size: { w: number; h: number; d: number };
  rotation?: number;
}) {
  return (
    <mesh
      position={[position.x, size.h / 2, position.z]}
      rotation={[0, rotation ?? 0, 0]}
    >
      <boxGeometry args={[size.w, size.h, size.d]} />
      <meshStandardMaterial
        color="#2a3a5a"
        emissive="#1a2a4a"
        emissiveIntensity={0.3}
      />
    </mesh>
  );
}

function GameCharacter({ player }: { player: PlayerGameStateSerializable }) {
  if (!player.alive) return null;
  const color = PLAYER_COLORS[player.colorIndex];
  if (!color) return null;

  const magnitude = player.speedMultiplier > 1 ? 0.8 : 0;
  const anim = !player.alive ? 'Idle' :
    player.frozen ? 'Idle' :
    magnitude > 0.6 ? 'Running' :
    magnitude > 0.05 ? 'Walking' : 'Idle';

  return (
    <group position={[player.position.x, 0, player.position.z]}>
      <Suspense fallback={null}>
        <CharacterViewer
          color={color.chickColor}
          animState={anim}
          facingAngle={player.facingAngle}
        />
      </Suspense>
    </group>
  );
}

export default function GameplayMap({ players, buildings, eagleAwake }: Props) {
  const playerList = Object.values(players);

  return (
    <div className="w-full h-full rounded-lg border border-border overflow-hidden bg-background">
      <Canvas camera={{ position: [0, 30, 25], fov: 45 }} shadows>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
        <directionalLight position={[-5, 15, -5]} intensity={0.3} />

        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
          <meshStandardMaterial color="#0a0a1a" />
        </mesh>

        {/* Grid */}
        <Grid
          args={[MAP_SIZE, MAP_SIZE]}
          position={[0, 0, 0]}
          cellSize={1}
          cellThickness={0.3}
          cellColor="#222244"
          sectionSize={4}
          sectionThickness={0.6}
          sectionColor="#333366"
          fadeDistance={30}
        />

        {/* Map boundary walls */}
        {[
          [0, 0.5, -MAP_SIZE / 2, MAP_SIZE, 1, 0.2],
          [0, 0.5, MAP_SIZE / 2, MAP_SIZE, 1, 0.2],
          [-MAP_SIZE / 2, 0.5, 0, 0.2, 1, MAP_SIZE],
          [MAP_SIZE / 2, 0.5, 0, 0.2, 1, MAP_SIZE],
        ].map(([x, y, z, w, h, d], i) => (
          <mesh key={`wall-${i}`} position={[x, y, z] as [number, number, number]}>
            <boxGeometry args={[w, h, d] as [number, number, number]} />
            <meshStandardMaterial color="#1a1a3a" emissive="#0a0a2a" emissiveIntensity={0.3} transparent opacity={0.6} />
          </mesh>
        ))}

        {/* Buildings */}
        {BUILDINGS.map((b) => {
          const bState = buildings?.find((bs) => bs.id === b.id);
          return (
            <Building
              key={b.id}
              position={b.position}
              size={b.size}
              glowing={bState?.glowing}
            />
          );
        })}

        {/* Obstacles */}
        {OBSTACLES.map((o, i) => (
          <Obstacle key={i} position={o.position} size={o.size} rotation={o.rotation} />
        ))}

        {/* Characters */}
        {playerList.map((p) => (
          <GameCharacter key={p.connId} player={p} />
        ))}

        {/* Eagle awake indicator */}
        {eagleAwake === false && (
          <mesh position={[0, 5, 0]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="#ff4444" emissive="#ff0000" emissiveIntensity={1} />
          </mesh>
        )}
      </Canvas>
    </div>
  );
}
