import { Suspense, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import CharacterViewer from '@/components/CharacterViewer';
import { MAP_SIZE, MAP_HALF, ZONE_RADIUS, TIP_SHARE_RADIUS } from '@/lib/gameplayMapData';
import { PLAYER_COLORS } from '@/lib/playerColors';
import type { PlayerGameStateSerializable, BuildingState, PropSpawn, MysteryBox, ExamState } from '@/lib/gameTypes';
import type { MapId } from '@/lib/mapVariants';
import { getMapVariant } from '@/lib/mapVariants';
import type { NatureObstacle } from '@/lib/mapVariants';

const FLY_SPEED_MULTIPLIER = 3;

// ─── Static Day Lighting ─────────────────────────────────────────────────────
function DayLighting() {
  return (
    <>
      <directionalLight position={[20, 35, 15]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} color="#fff5e0" />
      <directionalLight position={[-15, 20, -10]} intensity={0.4} color="#b0d0ff" />
      <ambientLight intensity={0.55} color="#fffaf0" />
      <mesh scale={[100, 100, 100]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#4a7ab5" side={THREE.BackSide} transparent opacity={0.25} />
      </mesh>
    </>
  );
}

// Camera stays centered; zoomLevel lets host tune framing
function MapCamera({ zoomLevel = 1 }: { zoomLevel?: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const clamped = Math.max(0.65, Math.min(1.5, zoomLevel));
    camera.position.set(0, 56 / clamped, 42 / clamped);
    (camera as any).fov = 58 / Math.max(0.75, clamped);
    (camera as any).updateProjectionMatrix?.();
    const threshold = 1.2;
    const excess = Math.max(0, clamped - threshold);
    const yLookAt = Math.min(2.0, excess * 1.8);
    camera.lookAt(0, yLookAt, 0);
  }, [camera, zoomLevel]);
  return null;
}

// ─── Nature Obstacles ──────────────────────────────────────────────────────────

function Tree({ position, scale = 1 }: { position: { x: number; z: number }; scale?: number }) {
  const s = scale;
  return (
    <group position={[position.x, 0, position.z]}>
      {/* Trunk */}
      <mesh position={[0, 1.2 * s, 0]}>
        <cylinderGeometry args={[0.15 * s, 0.25 * s, 2.4 * s, 6]} />
        <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
      </mesh>
      {/* Canopy layers */}
      <mesh position={[0, 2.8 * s, 0]}>
        <coneGeometry args={[1.2 * s, 2.0 * s, 6]} />
        <meshStandardMaterial color="#1a5a2a" emissive="#0a2a0a" emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[0, 3.6 * s, 0]}>
        <coneGeometry args={[0.9 * s, 1.5 * s, 6]} />
        <meshStandardMaterial color="#2a6a3a" emissive="#0a3a0a" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, 4.2 * s, 0]}>
        <coneGeometry args={[0.5 * s, 1.0 * s, 6]} />
        <meshStandardMaterial color="#3a7a4a" emissive="#1a4a1a" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

function Pond({ position, scale = 1 }: { position: { x: number; z: number }; scale?: number }) {
  const waterRef = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (waterRef.current) {
      const mat = waterRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.15 + Math.sin(Date.now() * 0.001) * 0.05;
    }
  });
  const r = 1.5 * scale;
  return (
    <group position={[position.x, 0, position.z]}>
      {/* Pond basin */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <circleGeometry args={[r + 0.3, 24]} />
        <meshStandardMaterial color="#2a1a0a" roughness={1} />
      </mesh>
      {/* Water surface */}
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[r, 24]} />
        <meshStandardMaterial
          color="#1a4a6a"
          emissive="#0a2a4a"
          emissiveIntensity={0.2}
          transparent
          opacity={0.8}
          metalness={0.3}
          roughness={0.1}
        />
      </mesh>
      {/* Surface shimmer ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[r * 0.7, r * 0.9, 24]} />
        <meshStandardMaterial color="#3a7aaa" emissive="#2a5a8a" emissiveIntensity={0.3} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Rock({ position, scale = 1 }: { position: { x: number; z: number }; scale?: number }) {
  const s = scale;
  return (
    <group position={[position.x, 0, position.z]}>
      {/* Main rock body — irregular look via squished dodecahedron */}
      <mesh position={[0, 0.5 * s, 0]} scale={[1.0 * s, 0.6 * s, 0.8 * s]}>
        <dodecahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial color="#6a6a5a" roughness={0.95} metalness={0.05} />
      </mesh>
      {/* Small secondary rock */}
      <mesh position={[0.4 * s, 0.2 * s, 0.3 * s]} scale={[0.5 * s, 0.4 * s, 0.6 * s]}>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#7a7a6a" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Bush({ position, scale = 1 }: { position: { x: number; z: number }; scale?: number }) {
  const s = scale;
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[0, 0.4 * s, 0]}>
        <sphereGeometry args={[0.6 * s, 8, 6]} />
        <meshStandardMaterial color="#2a5a1a" emissive="#0a2a0a" emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[0.3 * s, 0.3 * s, 0.2 * s]}>
        <sphereGeometry args={[0.4 * s, 8, 6]} />
        <meshStandardMaterial color="#3a6a2a" emissive="#1a3a0a" emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[-0.25 * s, 0.35 * s, -0.15 * s]}>
        <sphereGeometry args={[0.45 * s, 8, 6]} />
        <meshStandardMaterial color="#1a4a1a" emissive="#0a1a0a" emissiveIntensity={0.1} />
      </mesh>
    </group>
  );
}

function NatureObstacleRenderer({ obstacle }: { obstacle: NatureObstacle }) {
  switch (obstacle.type) {
    case 'tree':
      return <Tree position={obstacle.position} scale={obstacle.scale} />;
    case 'pond':
      return <Pond position={obstacle.position} scale={obstacle.scale} />;
    case 'rock':
      return <Rock position={obstacle.position} scale={obstacle.scale} />;
    case 'bush':
      return <Bush position={obstacle.position} scale={obstacle.scale} />;
    default:
      return null;
  }
}

interface Props {
  players: Record<string, PlayerGameStateSerializable>;
  buildings?: BuildingState[];
  eagleAwake?: boolean;
  propSpawns?: PropSpawn[];
  mysteryBoxes?: MysteryBox[];
  examState?: ExamState | null;
  zoomLevel?: number;
  enableHostDrag?: boolean;
  onHostDragBegin?: (connId: string) => void;
  onHostDragUpdate?: (connId: string, x: number, z: number) => void;
  onHostDragEnd?: (connId: string, valid: boolean) => void;
  activeTipShareConnIds?: string[];
  onHostSkipExam?: () => void;
  mapId?: MapId;
}

// ─── Building ──────────────────────────────────────────────────────────────────
function Building({ position, size, tipSiteActive, zoneActive, zoneHealth }: {
  position: { x: number; z: number };
  size: { w: number; h: number; d: number };
  tipSiteActive?: boolean;
  zoneActive?: boolean;
  zoneHealth?: number;
}) {
  const pulseRef = useRef(0);
  useFrame((_, delta) => { pulseRef.current += delta * 2; });
  const gold = !!tipSiteActive;

  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[0, size.h / 2, 0]}>
        <boxGeometry args={[size.w, size.h, size.d]} />
        <meshStandardMaterial
          color={gold ? '#ffd700' : '#2a2a4a'}
          emissive={gold ? '#ffd700' : '#1a1a3a'}
          emissiveIntensity={gold ? 0.6 : 0.2}
        />
      </mesh>
      <mesh position={[0, size.h + 0.2, 0]}>
        <boxGeometry args={[size.w + 0.5, 0.4, size.d + 0.5]} />
        <meshStandardMaterial
          color={gold ? '#ffaa00' : '#3a3a5a'}
          emissive={gold ? '#ffaa00' : '#2a2a4a'}
          emissiveIntensity={gold ? 0.5 : 0.1}
        />
      </mesh>
      {zoneActive && (
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[ZONE_RADIUS, 24, 24]} />
          <meshStandardMaterial color="#ffd700" emissive="#ffd700" emissiveIntensity={0.3} transparent opacity={0.15} side={THREE.DoubleSide} wireframe={false} />
        </mesh>
      )}
      {zoneActive && zoneHealth !== undefined && (
        <Html position={[0, size.h + 2, 0]} center zIndexRange={[100, 0]}>
          <div style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid #ffd700', borderRadius: 4, padding: '2px 6px', color: '#ffd700', fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
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
const PROP_COLORS: Record<string, string> = { speed: '#facc15', heal: '#22c55e' };

function PropMarker({ spawn }: { spawn: PropSpawn }) {
  const outerRef = useRef<THREE.Mesh>(null!);
  const innerRef = useRef<THREE.Mesh>(null!);
  const color = PROP_COLORS[spawn.type] ?? '#ffffff';
  const icon = spawn.type === 'speed' ? '⚡' : '💚';
  const BALL_R = 0.4;

  useFrame((_, delta) => {
    const t = Date.now() * 0.002;
    if (outerRef.current) outerRef.current.position.y = BALL_R + Math.sin(t) * 0.06;
    if (innerRef.current) innerRef.current.rotation.y += delta * 1.2;
  });

  return (
    <group position={[spawn.position.x, 0, spawn.position.z]}>
      <mesh ref={outerRef} position={[0, BALL_R, 0]}>
        <sphereGeometry args={[BALL_R, 20, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} transparent opacity={0.55} roughness={0.0} metalness={0.1} />
      </mesh>
      <mesh ref={innerRef} position={[0, BALL_R, 0]}>
        <sphereGeometry args={[BALL_R * 0.45, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[BALL_R * 0.6, BALL_R * 1.2, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[0, BALL_R * 2.6, 0]} center occlude={false} zIndexRange={[100, 0]}>
        <div style={{ background: 'rgba(0,0,0,0.75)', border: `1px solid ${color}`, borderRadius: 3, padding: '1px 5px', color, fontSize: 8, fontFamily: 'monospace', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {icon} {spawn.type.toUpperCase()}
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

  useFrame((_, delta) => { if (meshRef.current && isActive) meshRef.current.rotation.y += delta * 3; });

  return (
    <group position={[box.position.x, 0, box.position.z]}>
      <mesh ref={meshRef} position={[0, 0.7, 0]}>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial color={isActive ? '#ff8c00' : '#555'} emissive={isActive ? '#ff4400' : '#222'} emissiveIntensity={isActive ? 1.0 : 0.3} />
      </mesh>
      <Html position={[0, 1.8, 0]} center zIndexRange={[100, 0]}>
        <div style={{ color: isActive ? '#ff8c00' : '#888', fontSize: 14, fontFamily: 'monospace', fontWeight: 'bold', pointerEvents: 'none', textShadow: '0 0 6px #000' }}>
          {isActive ? '?' : `${countdown}s`}
        </div>
      </Html>
    </group>
  );
}

// ─── Invincible Ripple ────────────────────────────────────────────────────────
function InvincibleRipple3D() {
  const ring1 = useRef<THREE.Mesh>(null!);
  const ring2 = useRef<THREE.Mesh>(null!);
  const ring3 = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    const t = (Date.now() % 1500) / 1500;
    const t2 = ((Date.now() + 500) % 1500) / 1500;
    const t3 = ((Date.now() + 1000) % 1500) / 1500;
    const update = (ref: THREE.Mesh | null, phase: number) => {
      if (!ref) return;
      const s = 0.6 + phase * 2.0;
      ref.scale.set(s, s, 1);
      (ref.material as THREE.MeshStandardMaterial).opacity = 0.6 * (1 - phase);
    };
    update(ring1.current, t);
    update(ring2.current, t2);
    update(ring3.current, t3);
  });

  return (
    <group>
      {[ring1, ring2, ring3].map((ref, i) => (
        <mesh key={i} ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.8, 1.0, 32]} />
          <meshStandardMaterial color="#ffd700" emissive="#ffd700" emissiveIntensity={1.5} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Cage Mesh ───────────────────────────────────────────────────────────────
function CageMesh({ countdown }: { countdown: number }) {
  const barColor = '#8b4513';
  const BAR_H = 3;
  const BAR_R = 0.06;
  const CAGE_R = 0.8;
  const bars = 8;

  return (
    <group>
      {Array.from({ length: bars }).map((_, i) => {
        const angle = (i / bars) * Math.PI * 2;
        const x = Math.cos(angle) * CAGE_R;
        const z = Math.sin(angle) * CAGE_R;
        return (
          <mesh key={i} position={[x, BAR_H / 2, z]}>
            <cylinderGeometry args={[BAR_R, BAR_R, BAR_H, 6]} />
            <meshStandardMaterial color={barColor} emissive={barColor} emissiveIntensity={0.3} />
          </mesh>
        );
      })}
      <mesh position={[0, BAR_H, 0]}>
        <cylinderGeometry args={[CAGE_R + 0.1, CAGE_R + 0.1, 0.1, 16]} />
        <meshStandardMaterial color={barColor} emissive={barColor} emissiveIntensity={0.3} />
      </mesh>
      <Html position={[0, BAR_H + 0.8, 0]} center zIndexRange={[100, 0]}>
        <div style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid #ff4444', borderRadius: 4, padding: '2px 6px', color: '#ff4444', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          🔒 DETENTION {countdown}s
        </div>
      </Html>
    </group>
  );
}

// ─── Teleport Target Dot ─────────────────────────────────────────────────────
function TeleportDot({ position, hsl }: { position: { x: number; z: number }; hsl: string }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (meshRef.current) {
      const s = 0.8 + Math.sin(Date.now() * 0.005) * 0.2;
      meshRef.current.scale.set(s, 1, s);
    }
  });
  return (
    <group position={[position.x, 0.1, position.z]}>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 24]} />
        <meshStandardMaterial color={`hsl(${hsl})`} emissive={`hsl(${hsl})`} emissiveIntensity={1} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[0, 1.5, 0]} center zIndexRange={[100, 0]}>
        <div style={{ color: `hsl(${hsl})`, fontSize: 10, fontFamily: 'monospace', pointerEvents: 'none', textShadow: '0 0 4px #000' }}>
          ✕ TELEPORT
        </div>
      </Html>
    </group>
  );
}

// ─── Tip Share Radius Circle ─────────────────────────────────────────────────
function TipShareRadiusCircle({ position }: { position: { x: number; z: number } }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[position.x, 0.03, position.z]}>
      <ringGeometry args={[TIP_SHARE_RADIUS - 0.15, TIP_SHARE_RADIUS, 48]} />
      <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} transparent opacity={0.25} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Game Character ────────────────────────────────────────────────────────────
function GameCharacter({
  player,
  enableHostDrag,
  onHostDragBegin,
  onHostDragUpdate,
  onHostDragEnd,
}: {
  player: PlayerGameStateSerializable;
  enableHostDrag?: boolean;
  onHostDragBegin?: (connId: string) => void;
  onHostDragUpdate?: (connId: string, x: number, z: number) => void;
  onHostDragEnd?: (connId: string, valid: boolean) => void;
}) {
  const { camera, gl, raycaster } = useThree();
  const planeRef = useRef(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  if (!player.alive) return null;
  const color = PLAYER_COLORS[player.colorIndex];
  if (!color) return null;

  const draggable = !!enableHostDrag;
  const isFlying = player.isEagle && player.speedMultiplier >= (FLY_SPEED_MULTIPLIER ?? 3);
  const anim =
    player.frozen ? 'Idle' :
    (player.isAttacking || isFlying) ? 'Attack' :
    player.isMoving ? 'Running' : 'Idle';

  const isInvincible = player.invincibleUntil > Date.now();
  const isCaged = player.cagedUntil > Date.now();
  const cageRemaining = isCaged ? Math.ceil((player.cagedUntil - Date.now()) / 1000) : 0;

  return (
    <group position={[player.position.x, 0, player.position.z]}>
      {isInvincible && <InvincibleRipple3D />}
      {isCaged && <CageMesh countdown={cageRemaining} />}
      <Suspense fallback={null}>
        <CharacterViewer color={color.chickColor} animState={anim} facingAngle={player.facingAngle} />
      </Suspense>
      <Html position={[0, 2.8, 0]} center zIndexRange={[100, 0]}>
        <div style={{
          background: 'rgba(0,0,0,0.6)', border: `1px solid hsl(${color.hsl})`, borderRadius: 3, padding: '1px 5px',
          color: `hsl(${color.hsl})`, fontSize: 9, fontFamily: 'monospace', whiteSpace: 'nowrap',
          pointerEvents: draggable ? 'auto' : 'none', cursor: draggable ? 'grab' : 'default',
        }}>
          <div
            onPointerDown={(e) => {
              if (!draggable) return;
              e.preventDefault();
              e.stopPropagation();
              const connId = player.connId;
              onHostDragBegin?.(connId);
              let lastValid = true;
              const computeHit = (ev: PointerEvent) => {
                const rect = gl.domElement.getBoundingClientRect();
                const ndcX = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
                const ndcY = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
                raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
                const pt = new THREE.Vector3();
                const plane = planeRef.current();
                const hit = raycaster.ray.intersectPlane(plane, pt);
                if (!hit) return null;
                const valid = Math.abs(pt.x) <= MAP_HALF && Math.abs(pt.z) <= MAP_HALF;
                return { x: pt.x, z: pt.z, valid };
              };
              const move = (ev: PointerEvent) => {
                const hit = computeHit(ev);
                if (!hit) return;
                lastValid = hit.valid;
                onHostDragUpdate?.(connId, hit.x, hit.z);
              };
              const up = (ev: PointerEvent) => {
                ev.preventDefault();
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
                window.removeEventListener('pointercancel', up);
                const hit = computeHit(ev);
                onHostDragEnd?.(player.connId, hit ? hit.valid : lastValid);
              };
              window.addEventListener('pointermove', move);
              window.addEventListener('pointerup', up, { once: true });
              window.addEventListener('pointercancel', up, { once: true });
            }}
          >
            {color.name} {player.isEagle ? '🦅' : (player.isStarStudent ? '⭐' : '🐤')}
          </div>
        </div>
      </Html>
    </group>
  );
}

// ─── Main Map Component ────────────────────────────────────────────────────────
export default function GameplayMap({
  players,
  buildings,
  eagleAwake,
  propSpawns,
  mysteryBoxes,
  examState,
  zoomLevel = 1,
  enableHostDrag,
  onHostDragBegin,
  onHostDragUpdate,
  onHostDragEnd,
  activeTipShareConnIds,
  onHostSkipExam,
  mapId = 1,
}: Props) {
  const playerList = Object.values(players);
  const mapVariant = useMemo(() => getMapVariant(mapId), [mapId]);

  return (
    <div className="w-full h-full rounded-lg border border-border overflow-hidden bg-background">
      <Canvas camera={{ position: [0, 56, 42], fov: 58 }} shadows>
        <MapCamera zoomLevel={zoomLevel} />
        <DayNightCycle />

        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
          <meshStandardMaterial color={mapVariant.floorColor} />
        </mesh>

        {/* Grid */}
        <Grid
          args={[MAP_SIZE, MAP_SIZE]}
          position={[0, 0, 0]}
          cellSize={2}
          cellThickness={0.3}
          cellColor={mapVariant.gridCellColor}
          sectionSize={8}
          sectionThickness={0.6}
          sectionColor={mapVariant.gridSectionColor}
          fadeDistance={80}
        />

        {/* Map boundary walls */}
        {[
          [0, 0.5, -MAP_SIZE / 2, MAP_SIZE, 1, 0.3] as const,
          [0, 0.5, MAP_SIZE / 2, MAP_SIZE, 1, 0.3] as const,
          [-MAP_SIZE / 2, 0.5, 0, 0.3, 1, MAP_SIZE] as const,
          [MAP_SIZE / 2, 0.5, 0, 0.3, 1, MAP_SIZE] as const,
        ].map(([x, y, z, w, h, d], i) => (
          <mesh key={`wall-${i}`} position={[x, y, z]}>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color="#1a1a3a" emissive="#0a0a2a" emissiveIntensity={0.4} transparent opacity={0.7} />
          </mesh>
        ))}

        {/* Buildings — use map variant data */}
        {mapVariant.buildings.map((b) => {
          const bState = buildings?.find((bs) => bs.id === b.id);
          return (
            <Building
              key={b.id}
              position={b.position}
              size={b.size}
              tipSiteActive={!!bState?.hasTip && !bState?.tipObtained}
              zoneActive={bState?.zoneActive}
              zoneHealth={bState?.zoneHealth}
            />
          );
        })}

        {/* Box Obstacles */}
        {mapVariant.obstacles.map((o, i) => (
          <Obstacle key={i} position={o.position} size={o.size} rotation={o.rotation} />
        ))}

        {/* Nature Obstacles */}
        {mapVariant.natureObstacles.map((no, i) => (
          <NatureObstacleRenderer key={`nature-${i}`} obstacle={no} />
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
          <GameCharacter
            key={p.connId}
            player={p}
            enableHostDrag={enableHostDrag}
            onHostDragBegin={onHostDragBegin}
            onHostDragUpdate={onHostDragUpdate}
            onHostDragEnd={onHostDragEnd}
          />
        ))}

        {/* Teleport target dots */}
        {playerList.filter((p) => p.teleportPending && p.alive).map((p) => {
          const color = PLAYER_COLORS[p.colorIndex];
          return color ? <TeleportDot key={`tp-${p.connId}`} position={p.teleportTarget} hsl={color.hsl} /> : null;
        })}

        {/* Tip share radius circles */}
        {activeTipShareConnIds?.map((connId) => {
          const p = players[connId];
          return p ? <TipShareRadiusCircle key={`tsr-${connId}`} position={p.position} /> : null;
        })}

        {/* Eagle awake countdown */}
        {eagleAwake === false && (
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[1.5, 1.5, 0.1, 24]} />
            <meshStandardMaterial color="#ff4444" emissive="#ff0000" emissiveIntensity={0.8} transparent opacity={0.4} />
          </mesh>
        )}

        {/* Exam stage indicator + host skip */}
        {examState && !examState.answered && (
          <Html position={[0, 8, 0]} center zIndexRange={[100, 0]}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
              <div style={{ background: 'rgba(0,0,0,0.8)', border: '2px solid #ffd700', borderRadius: 6, padding: '4px 10px', color: '#ffd700', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                📝 FINAL EXAM — {Math.ceil(examState.timeRemaining)}s
              </div>
              {onHostSkipExam && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onHostSkipExam(); }}
                  style={{ pointerEvents: 'auto', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', padding: '6px 12px', borderRadius: 6, border: '1px solid hsl(45 100% 45%)', background: 'rgba(0,0,0,0.85)', color: '#ffd700', fontWeight: 'bold' }}
                >
                  Skip EXAM
                </button>
              )}
            </div>
          </Html>
        )}
      </Canvas>
    </div>
  );
}
