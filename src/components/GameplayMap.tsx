import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import QRCode from 'react-qr-code';
import CharacterViewer from '@/components/CharacterViewer';
import { BUILDINGS, OBSTACLES, MAP_SIZE, ZONE_RADIUS } from '@/lib/gameplayMapData';
import { PLAYER_COLORS } from '@/lib/playerColors';
import type { PlayerGameStateSerializable, BuildingState, PropSpawn, MysteryBox, ExamState } from '@/lib/gameTypes';

const FLY_SPEED_MULTIPLIER = 3;


interface Props {
  players: Record<string, PlayerGameStateSerializable>;
  buildings?: BuildingState[];
  eagleAwake?: boolean;
  propSpawns?: PropSpawn[];
  mysteryBoxes?: MysteryBox[];
  examState?: ExamState | null;
}

// ─── Building ──────────────────────────────────────────────────────────────────
function Building({ position, size, glowing, zoneActive, zoneHealth }: {
  position: { x: number; z: number };
  size: { w: number; h: number; d: number };
  glowing?: boolean;
  zoneActive?: boolean;
  zoneHealth?: number;
}) {
  const pulseRef = useRef(0);
  useFrame((_, delta) => { pulseRef.current += delta * 2; });

  return (
    <group position={[position.x, 0, position.z]}>
      {/* Building body */}
      <mesh position={[0, size.h / 2, 0]}>
        <boxGeometry args={[size.w, size.h, size.d]} />
        <meshStandardMaterial
          color={glowing ? '#ffd700' : '#2a2a4a'}
          emissive={glowing ? '#ffd700' : '#1a1a3a'}
          emissiveIntensity={glowing ? 0.6 : 0.2}
        />
      </mesh>
      {/* Roof */}
      <mesh position={[0, size.h + 0.2, 0]}>
        <boxGeometry args={[size.w + 0.5, 0.4, size.d + 0.5]} />
        <meshStandardMaterial
          color={glowing ? '#ffaa00' : '#3a3a5a'}
          emissive={glowing ? '#ffaa00' : '#2a2a4a'}
          emissiveIntensity={glowing ? 0.5 : 0.1}
        />
      </mesh>
      {/* Protected zone sphere */}
      {zoneActive && (
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[ZONE_RADIUS, 24, 24]} />
          <meshStandardMaterial
            color="#ffd700"
            emissive="#ffd700"
            emissiveIntensity={0.3}
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
            wireframe={false}
          />
        </mesh>
      )}
      {/* Zone health display */}
      {zoneActive && zoneHealth !== undefined && (
        <Html position={[0, size.h + 2, 0]} center>
          <div style={{
            background: 'rgba(0,0,0,0.7)',
            border: '1px solid #ffd700',
            borderRadius: 4,
            padding: '2px 6px',
            color: '#ffd700',
            fontSize: 11,
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            🛡 {zoneHealth}/50
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Obstacle ──────────────────────────────────────────────────────────────────
function Obstacle({ position, size, rotation }: {
  position: { x: number; z: number };
  size: { w: number; h: number; d: number };
  rotation?: number;
}) {
  return (
    <mesh position={[position.x, size.h / 2, position.z]} rotation={[0, rotation ?? 0, 0]}>
      <boxGeometry args={[size.w, size.h, size.d]} />
      <meshStandardMaterial color="#1e3a5f" emissive="#0a1a3a" emissiveIntensity={0.3} />
    </mesh>
  );
}

// ─── Prop Spawn Marker ─────────────────────────────────────────────────────────
const PROP_COLORS: Record<string, string> = {
  speed: '#facc15',
  heal: '#22c55e',
};

function PropMarker({ spawn }: { spawn: PropSpawn }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 2;
      meshRef.current.position.y = 0.6 + Math.sin(Date.now() * 0.003) * 0.15;
    }
  });

  const color = PROP_COLORS[spawn.type] ?? '#ffffff';
  const icon = spawn.type === 'speed' ? '⚡' : '💚';

  return (
    <group position={[spawn.position.x, 0, spawn.position.z]}>
      {/* Glowing orb */}
      <mesh ref={meshRef} position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
      {/* QR code panel via HTML overlay */}
      <Html position={[0, -0.1, 0]} center occlude={false}>
        <div style={{
          background: 'white',
          padding: 3,
          borderRadius: 3,
          transform: 'scale(0.22)',
          transformOrigin: 'top center',
          pointerEvents: 'none',
          boxShadow: `0 0 8px ${color}`,
        }}>
          <div style={{ textAlign: 'center', fontSize: 9, fontFamily: 'monospace', color: '#000', marginBottom: 2 }}>
            {icon} {spawn.type.toUpperCase()}
          </div>
          <QRCode value={spawn.id} size={100} />
        </div>
      </Html>
    </group>
  );
}

// ─── Mystery Box ──────────────────────────────────────────────────────────────
function MysteryBoxMarker({ box }: { box: MysteryBox }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const now = Date.now();
  const isActive = now >= box.activeAt;
  const countdown = Math.ceil(Math.max(0, (box.activeAt - now) / 1000));

  useFrame((_, delta) => {
    if (meshRef.current && isActive) {
      meshRef.current.rotation.y += delta * 3;
    }
  });

  return (
    <group position={[box.position.x, 0, box.position.z]}>
      <mesh ref={meshRef} position={[0, 0.7, 0]}>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial
          color={isActive ? '#ff8c00' : '#555'}
          emissive={isActive ? '#ff4400' : '#222'}
          emissiveIntensity={isActive ? 1.0 : 0.3}
        />
      </mesh>
      <Html position={[0, 1.8, 0]} center>
        <div style={{
          color: isActive ? '#ff8c00' : '#888',
          fontSize: 14,
          fontFamily: 'monospace',
          fontWeight: 'bold',
          pointerEvents: 'none',
          textShadow: '0 0 6px #000',
        }}>
          {isActive ? '?' : `${countdown}s`}
        </div>
      </Html>
    </group>
  );
}

// ─── Game Character ────────────────────────────────────────────────────────────
function GameCharacter({ player }: { player: PlayerGameStateSerializable }) {
  if (!player.alive) return null;
  const color = PLAYER_COLORS[player.colorIndex];
  if (!color) return null;

  const isFlying = player.isEagle && player.speedMultiplier >= (FLY_SPEED_MULTIPLIER ?? 3);
  const anim =
    player.frozen ? 'Idle' :
    (player.isAttacking || isFlying) ? 'Attack' :
    player.isMoving ? 'Running' :
    'Idle';

  // Invincible shimmer ring
  const isInvincible = player.invincibleUntil > Date.now();

  return (
    <group position={[player.position.x, 0, player.position.z]}>
      {isInvincible && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.6, 0.9, 24]} />
          <meshStandardMaterial color="#ffd700" emissive="#ffd700" emissiveIntensity={1} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Suspense fallback={null}>
        <CharacterViewer
          color={color.chickColor}
          animState={anim}
          facingAngle={player.facingAngle}
        />
      </Suspense>
      {/* Name tag */}
      <Html position={[0, 2.8, 0]} center>
        <div style={{
          background: 'rgba(0,0,0,0.6)',
          border: `1px solid hsl(${color.hsl})`,
          borderRadius: 3,
          padding: '1px 5px',
          color: `hsl(${color.hsl})`,
          fontSize: 9,
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          {color.name} {player.isEagle ? '🦅' : (player.isStarStudent ? '⭐' : '🐤')}
        </div>
      </Html>
    </group>
  );
}

// ─── Main Map Component ────────────────────────────────────────────────────────
export default function GameplayMap({ players, buildings, eagleAwake, propSpawns, mysteryBoxes, examState }: Props) {
  const playerList = Object.values(players);

  return (
    <div className="w-full h-full rounded-lg border border-border overflow-hidden bg-background">
      <Canvas
        camera={{ position: [0, 58, 46], fov: 55 }}
        shadows
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[15, 30, 15]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} />
        <directionalLight position={[-10, 20, -10]} intensity={0.3} />

        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
          <meshStandardMaterial color="#080814" />
        </mesh>

        {/* Grid */}
        <Grid
          args={[MAP_SIZE, MAP_SIZE]}
          position={[0, 0, 0]}
          cellSize={2}
          cellThickness={0.3}
          cellColor="#1a1a44"
          sectionSize={8}
          sectionThickness={0.6}
          sectionColor="#2a2a66"
          fadeDistance={80}
        />

        {/* Map boundary walls */}
        {[
          [0, 0.5, -MAP_SIZE / 2, MAP_SIZE, 1, 0.3] as const,
          [0, 0.5,  MAP_SIZE / 2, MAP_SIZE, 1, 0.3] as const,
          [-MAP_SIZE / 2, 0.5, 0, 0.3, 1, MAP_SIZE] as const,
          [ MAP_SIZE / 2, 0.5, 0, 0.3, 1, MAP_SIZE] as const,
        ].map(([x, y, z, w, h, d], i) => (
          <mesh key={`wall-${i}`} position={[x, y, z]}>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color="#1a1a3a" emissive="#0a0a2a" emissiveIntensity={0.4} transparent opacity={0.7} />
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
              zoneActive={bState?.zoneActive}
              zoneHealth={bState?.zoneHealth}
            />
          );
        })}

        {/* Obstacles */}
        {OBSTACLES.map((o, i) => (
          <Obstacle key={i} position={o.position} size={o.size} rotation={o.rotation} />
        ))}

        {/* Prop spawns */}
        {propSpawns?.filter((p) => p.active).map((spawn) => (
          <PropMarker key={spawn.id} spawn={spawn} />
        ))}

        {/* Mystery boxes */}
        {mysteryBoxes?.map((box) => (
          <MysteryBoxMarker key={box.id} box={box} />
        ))}

        {/* Characters */}
        {playerList.map((p) => (
          <GameCharacter key={p.connId} player={p} />
        ))}

        {/* Eagle awake countdown */}
        {eagleAwake === false && (
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[1.5, 1.5, 0.1, 24]} />
            <meshStandardMaterial color="#ff4444" emissive="#ff0000" emissiveIntensity={0.8} transparent opacity={0.4} />
          </mesh>
        )}

        {/* Exam stage indicator */}
        {examState && !examState.answered && (
          <Html position={[0, 8, 0]} center>
            <div style={{
              background: 'rgba(0,0,0,0.8)',
              border: '2px solid #ffd700',
              borderRadius: 6,
              padding: '4px 10px',
              color: '#ffd700',
              fontSize: 13,
              fontFamily: 'monospace',
              fontWeight: 'bold',
              pointerEvents: 'none',
            }}>
              📝 EXAM — {Math.ceil(examState.timeRemaining)}s
            </div>
          </Html>
        )}
      </Canvas>
    </div>
  );
}
