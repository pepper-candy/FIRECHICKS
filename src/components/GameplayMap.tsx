import { Suspense, useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, Html, Edges, Text } from "@react-three/drei";
import * as THREE from "three";
import CharacterViewer from "@/components/CharacterViewer";
import { MAP_SIZE, MAP_HALF, ZONE_RADIUS, TIP_SHARE_RADIUS } from "@/lib/gameplayMapData";
import { PLAYER_COLORS } from "@/lib/playerColors";
import type { PlayerGameStateSerializable, BuildingState, PropSpawn, MysteryBox, ExamState } from "@/lib/gameTypes";
import type { MapId } from "@/lib/mapVariants";
import { getMapVariant } from "@/lib/mapVariants";
import type { NatureObstacle } from "@/lib/mapVariants";

const FLY_SPEED_MULTIPLIER = 3;
const WORLD_SCALE = 0.5; // Shrinks visual map without affecting game logic
const CHARACTER_VISUAL_SCALE = 1.5 / WORLD_SCALE;
const DEBUG_MODE = true;

// ─── Static Day Lighting ─────────────────────────────────────────────────────
function DayLighting() {
  return (
    <>
      <directionalLight
        position={[20, 35, 15]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        color="#fff5e0"
      />
      <directionalLight position={[-15, 20, -10]} intensity={0.4} color="#b0d0ff" />
      <ambientLight intensity={0.55} color="#fffaf0" />
      <mesh scale={[100, 100, 100]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#4a7ab5" side={THREE.BackSide} transparent opacity={0.25} />
      </mesh>
    </>
  );
}

// ─── Bright Light Mode Lighting ──────────────────────────────────────────────
function LightModeLighting() {
  return (
    <>
      <directionalLight
        position={[20, 40, 15]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        color="#ffffff"
      />
      <directionalLight position={[-15, 30, -10]} intensity={1.0} color="#ffffff" />
      <ambientLight intensity={1.2} color="#ffffff" />
      <mesh scale={[100, 100, 100]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#e8e8ee" side={THREE.BackSide} />
      </mesh>
    </>
  );
}

// ─── Semi-Light Mode Lighting (softer, dark background sky) ─────────────────
function SemiLightLighting() {
  return (
    <>
      <directionalLight
        position={[20, 35, 15]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        color="#ffffff"
      />
      <directionalLight position={[-15, 25, -10]} intensity={0.5} color="#d0d8ff" />
      <ambientLight intensity={0.7} color="#f0f0f0" />
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

    // As zoom increases, camera moves farther (dolly back)
    const posY = 40 + (clamped - 0.65) * 25;
    const posZ = 28 + (clamped - 0.65) * 22;

    // Vertical pan — keep the working -30 multiplier
    const lookY = (clamped - 1) * -25 - 10;

    camera.position.set(0, posY, posZ);
    (camera as any).fov = 58 / Math.max(0.75, clamped);
    (camera as any).updateProjectionMatrix?.();
    camera.lookAt(0, lookY, 0);
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
        <meshStandardMaterial
          color="#3a7aaa"
          emissive="#2a5a8a"
          emissiveIntensity={0.3}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
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

function NatureObstacleRenderer({
  obstacle,
  index,
  devMode,
}: {
  obstacle: NatureObstacle;
  index?: number;
  devMode?: boolean;
}) {
  if (devMode) {
    const bounds = getNatureDebugDimensions(obstacle);
    const label = `N${index ?? 0} (${obstacle.position.x}, ${obstacle.position.z})`;
    return (
      <group position={[obstacle.position.x, 0, obstacle.position.z]}>
        <DebugLabel position={[0, bounds.h + 1, 0]} color={getDebugColor("nature")} label={label} />
        <mesh position={[0, bounds.h / 2, 0]} rotation={[0, obstacle.rotation ?? 0, 0]}>
          <boxGeometry args={[bounds.w, bounds.h, bounds.d]} />
          <meshStandardMaterial
            color={getDebugColor("nature")}
            emissive={getDebugColor("nature")}
            emissiveIntensity={0.2}
            transparent
            opacity={0.65}
          />
        </mesh>
      </group>
    );
  }

  switch (obstacle.type) {
    case "tree":
      return <Tree position={obstacle.position} scale={obstacle.scale} />;
    case "pond":
      return <Pond position={obstacle.position} scale={obstacle.scale} />;
    case "rock":
      return <Rock position={obstacle.position} scale={obstacle.scale} />;
    case "bush":
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
  themeHue?: number;
  immersive?: boolean;
  themeMode?: "dark" | "semi" | "light";
  hideOverlays?: boolean;
  devMode?: boolean;  // ← ADD THIS LINE
}

// Helper: derive themed colors from a hue (0-360)
function themedColor(hue: number, saturation: number, lightness: number): string {
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function darkenColor(color: string, factor = 0.82): string {
  const value = new THREE.Color(color).multiplyScalar(factor);
  return `#${value.getHexString()}`;
}

function DebugLabel({
  position,
  color,
  label,
}: {
  position: [number, number, number];
  color: string;
  label: string;
}) {
  return (
    <Text
      position={position}
      fontSize={0.7}
      color={color}
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.06}
      outlineColor="#000000"
    >
      {label}
    </Text>
  );
}

// ─── Immersive Atmosphere ─────────────────────────────────────────────────────

function SceneFog({ color, density }: { color: string; density: number }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.FogExp2(color, density);
    return () => {
      scene.fog = null;
    };
  }, [scene, color, density]);
  return null;
}

function ImmersiveLighting() {
  const skyRef = useRef<THREE.Group>(null!);
  useFrame((_, delta) => {
    if (skyRef.current) skyRef.current.rotation.y += delta * 0.006;
  });
  return (
    <>
      <ambientLight intensity={0.28} color="#1a1a3e" />
      <directionalLight position={[10, 25, 10]} intensity={1.1} color="#c4d0ff" castShadow />
      <directionalLight position={[-8, 15, -8]} intensity={0.45} color="#7050c0" />
      <group ref={skyRef}>
        {/* Deep indigo night sky */}
        <mesh scale={[120, 120, 120]}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial color="#050510" side={THREE.BackSide} />
        </mesh>
        {/* Subtle teal horizon glow band */}
        <mesh scale={[118, 118, 118]}>
          <sphereGeometry args={[1, 32, 8, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.22]} />
          <meshBasicMaterial color="#0a1628" side={THREE.BackSide} transparent opacity={0.55} />
        </mesh>
      </group>
    </>
  );
}

function MapParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const count = 90;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * MAP_SIZE * 0.85,
        z: (Math.random() - 0.5) * MAP_SIZE * 0.85,
        y: Math.random() * 14,
        speed: 0.25 + Math.random() * 0.7,
        scale: 0.14 + Math.random() * 0.2,
      })),
    [],
  );

  useEffect(() => {
    data.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [data, dummy]);

  useFrame((_, delta) => {
    data.forEach((p, i) => {
      p.y += p.speed * delta;
      if (p.y > 16) {
        p.y = 0;
        p.x = (Math.random() - 0.5) * MAP_SIZE * 0.85;
        p.z = (Math.random() - 0.5) * MAP_SIZE * 0.85;
      }
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 5, 5]} />
      <meshStandardMaterial color="#9db5ff" emissive="#5777ff" emissiveIntensity={2.0} transparent opacity={0.65} />
    </instancedMesh>
  );
}

// ─── Debug Color Helper ────────────────────────────────────────────────────────
function getDebugColor(type: 'building' | 'obstacle' | 'nature'): string {
  switch (type) {
    case 'building': return '#4488ff'; // Blue
    case 'obstacle': return '#ff4444';  // Red
    case 'nature': return '#44ff44';    // Green
  }
}

function getNatureDebugDimensions(obstacle: NatureObstacle) {
  const scale = obstacle.scale ?? 1;
  switch (obstacle.type) {
    case "tree":
      return { w: 1.6 * scale, h: 4.8 * scale, d: 1.6 * scale };
    case "pond":
      return { w: 3.2 * scale, h: 0.2, d: 3.2 * scale };
    case "rock":
      return { w: 1.6 * scale, h: 1.0 * scale, d: 1.4 * scale };
    case "bush":
      return { w: 1.2 * scale, h: 0.9 * scale, d: 1.2 * scale };
    default:
      return { w: scale, h: scale, d: scale };
  }
}

// ─── Building ──────────────────────────────────────────────────────────────────
function Building({
  position,
  size,
  tipSiteActive,
  zoneActive,
  zoneHealth,
  baseColor,
  baseEmissive,
  immersive,
  lightMode,
  hideOverlays,
  devMode,
  label,
}: {
  position: { x: number; z: number };
  size: { w: number; h: number; d: number };
  tipSiteActive?: boolean;
  zoneActive?: boolean;
  zoneHealth?: number;
  baseColor?: string;
  baseEmissive?: string;
  immersive?: boolean;
  lightMode?: boolean;
  hideOverlays?: boolean;
  devMode?: boolean;
  label?: string;
}) {
  const pulseRef = useRef(0);
  useFrame((_, delta) => {
    pulseRef.current += delta * 2;
  });
  const gold = !!tipSiteActive;

  return (
    <group position={[position.x, 0, position.z]}>
      {devMode && label && <DebugLabel position={[0, size.h + 1.2, 0]} color={getDebugColor("building")} label={label} />}
      <mesh position={[0, size.h / 2, 0]}>
        <boxGeometry args={[size.w, size.h, size.d]} />
        <meshStandardMaterial
          color={devMode ? getDebugColor('building') : (gold ? "#ffd700" : (baseColor ?? "#2a2a4a"))}
          emissive={devMode ? getDebugColor('building') : (gold ? "#ffd700" : (baseEmissive ?? "#1a1a3a"))}
          emissiveIntensity={devMode ? 0.4 : (gold ? 0.6 : immersive ? 0.35 : 0.2)}
          transparent={devMode}
          opacity={devMode ? 0.7 : 1}
        />
        {(immersive || lightMode) && !devMode && (
          <Edges scale={1.005} threshold={12} color={gold ? "#ffe566" : lightMode ? "#222222" : "#7070b8"} />
        )}
      </mesh>
      <mesh position={[0, size.h + 0.2, 0]}>
        <boxGeometry args={[size.w + 0.5, 0.4, size.d + 0.5]} />
        <meshStandardMaterial
          color={devMode ? getDebugColor('building') : (gold ? "#ffaa00" : (baseColor ?? "#3a3a5a"))}
          emissive={devMode ? getDebugColor('building') : (gold ? "#ffaa00" : (baseEmissive ?? "#2a2a4a"))}
          emissiveIntensity={devMode ? 0.3 : (gold ? 0.5 : immersive ? 0.18 : 0.1)}
          transparent={devMode}
          opacity={devMode ? 0.5 : 1}
        />
        {(immersive || lightMode) && !devMode && (
          <Edges scale={1.01} threshold={12} color={gold ? "#ffcc44" : lightMode ? "#333333" : "#5555a0"} />
        )}
      </mesh>
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
      {zoneActive && zoneHealth !== undefined && !hideOverlays && (
        <Html position={[0, size.h + 1.5, 0]} center zIndexRange={[100, 0]}>
          <div
            style={{
              background: "rgba(0,0,0,0.7)",
              border: "1px solid #ffd700",
              borderRadius: 4,
              padding: "2px 6px",
              color: "#ffd700",
              fontSize: 11,
              fontFamily: "monospace",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            🛡 {zoneHealth}/50
          </div>
        </Html>
      )}
      {devMode && (
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[size.w + 0.1, 0.05, size.d + 0.1]} />
          <meshBasicMaterial color={getDebugColor('building')} transparent opacity={0.2} />
        </mesh>
      )}
    </group>
  );
}

// ─── Obstacle ──────────────────────────────────────────────────────────────────
function Obstacle({
  position,
  size,
  rotation,
  baseColor,
  baseEmissive,
  lightMode,
  devMode,
  label,
}: {
  position: { x: number; z: number };
  size: { w: number; h: number; d: number };
  rotation?: number;
  baseColor?: string;
  baseEmissive?: string;
  lightMode?: boolean;
  devMode?: boolean;
  label?: string;
}) {
  return (
    <group position={[position.x, 0, position.z]}>
      {devMode && label && <DebugLabel position={[0, size.h + 0.9, 0]} color={getDebugColor("obstacle")} label={label} />}
      <mesh position={[0, size.h / 2, 0]} rotation={[0, rotation ?? 0, 0]}>
        <boxGeometry args={[size.w, size.h, size.d]} />
        <meshStandardMaterial
          color={devMode ? getDebugColor('obstacle') : (baseColor ?? "#1e3a5f")}
          emissive={devMode ? getDebugColor('obstacle') : (baseEmissive ?? "#0a1a3a")}
          emissiveIntensity={devMode ? 0.3 : (lightMode ? 0.05 : 0.3)}
          transparent={devMode}
          opacity={devMode ? 0.6 : 1}
        />
        {lightMode && !devMode && <Edges scale={1.005} threshold={12} color="#222222" />}
      </mesh>
    </group>
  );
}

function InstancedObstacleLayer({
  obstacles,
  color,
  emissive,
  lightMode,
}: {
  obstacles: Array<{
    position: { x: number; z: number };
    size: { w: number; h: number; d: number };
    rotation?: number;
  }>;
  color: string;
  emissive: string;
  lightMode?: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    obstacles.forEach((obstacle, index) => {
      dummy.position.set(obstacle.position.x, obstacle.size.h / 2, obstacle.position.z);
      dummy.rotation.set(0, obstacle.rotation ?? 0, 0);
      dummy.scale.set(obstacle.size.w, obstacle.size.h, obstacle.size.d);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(index, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy, obstacles]);

  if (obstacles.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, obstacles.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={lightMode ? 0.05 : 0.3}
      />
    </instancedMesh>
  );
}

// ─── Prop Spawn Marker ─────────────────────────────────────────────────────────
const PROP_COLORS: Record<string, string> = { speed: "#facc15", heal: "#22c55e" };

function PropMarker({ spawn }: { spawn: PropSpawn }) {
  const outerRef = useRef<THREE.Mesh>(null!);
  const innerRef = useRef<THREE.Mesh>(null!);
  const color = PROP_COLORS[spawn.type] ?? "#ffffff";
  const icon = spawn.type === "speed" ? "⚡" : "💚";
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
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          transparent
          opacity={0.55}
          roughness={0.0}
          metalness={0.1}
        />
      </mesh>
      <mesh ref={innerRef} position={[0, BALL_R, 0]}>
        <sphereGeometry args={[BALL_R * 0.45, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[BALL_R * 0.6, BALL_R * 1.2, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Html position={[0, BALL_R * 2.6, 0]} center occlude={false} zIndexRange={[100, 0]}>
        <div
          style={{
            background: "rgba(0,0,0,0.75)",
            border: `1px solid ${color}`,
            borderRadius: 3,
            padding: "1px 5px",
            color,
            fontSize: 8,
            fontFamily: "monospace",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {icon} {spawn.type.toUpperCase()}
        </div>
      </Html>
    </group>
  );
}

// ─── Mystery Box ──────────────────────────────────────────────────────────────
function MysteryBoxAura() {
  const outerRef = useRef<THREE.Group>(null!);
  const innerRef = useRef<THREE.Group>(null!);
  useFrame((_, delta) => {
    if (outerRef.current) outerRef.current.rotation.y += delta * 1.8;
    if (innerRef.current) innerRef.current.rotation.y -= delta * 2.4;
    if (innerRef.current) innerRef.current.rotation.x += delta * 0.6;
  });
  return (
    <>
      <group ref={outerRef} position={[0, 0.7, 0]}>
        <mesh>
          <torusGeometry args={[1.05, 0.035, 8, 28]} />
          <meshStandardMaterial color="#ff8c00" emissive="#ff4400" emissiveIntensity={1.8} transparent opacity={0.65} />
        </mesh>
      </group>
      <group ref={innerRef} position={[0, 0.7, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.85, 0.025, 8, 24]} />
          <meshStandardMaterial color="#ffcc00" emissive="#ff8800" emissiveIntensity={1.5} transparent opacity={0.45} />
        </mesh>
      </group>
    </>
  );
}

function MysteryBoxMarker({ box, immersive }: { box: MysteryBox; immersive?: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const now = Date.now();
  const isActive = now >= box.activeAt;
  const countdown = Math.ceil(Math.max(0, (box.activeAt - now) / 1000));

  useFrame((_, delta) => {
    if (meshRef.current && isActive) meshRef.current.rotation.y += delta * 3;
  });

  return (
    <group position={[box.position.x, 0, box.position.z]}>
      {immersive && isActive && <MysteryBoxAura />}
      <mesh ref={meshRef} position={[0, 0.7, 0]}>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial
          color={isActive ? "#ff8c00" : "#555"}
          emissive={isActive ? "#ff4400" : "#222"}
          emissiveIntensity={isActive ? (immersive ? 1.6 : 1.0) : 0.3}
        />
        {immersive && isActive && <Edges scale={1.05} threshold={10} color="#ffaa44" />}
      </mesh>
      <Html position={[0, 1.8, 0]} center zIndexRange={[100, 0]}>
        <div
          style={{
            color: isActive ? "#ff8c00" : "#888",
            fontSize: 14,
            fontFamily: "monospace",
            fontWeight: "bold",
            pointerEvents: "none",
            textShadow: "0 0 6px #000",
          }}
        >
          {isActive ? "?" : `${countdown}s`}
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
          <meshStandardMaterial
            color="#ffd700"
            emissive="#ffd700"
            emissiveIntensity={1.5}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Cage Mesh ───────────────────────────────────────────────────────────────
function CageMesh({ countdown }: { countdown: number }) {
  const barColor = "#8b4513";
  const BAR_H = 4.5;
  const BAR_R = 0.09;
  const CAGE_R = 1.2;
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
        <cylinderGeometry args={[CAGE_R + 0.15, CAGE_R + 0.15, 0.12, 16]} />
        <meshStandardMaterial color={barColor} emissive={barColor} emissiveIntensity={0.3} />
      </mesh>
      <Html position={[0, BAR_H + 1.0, 0]} center zIndexRange={[100, 0]}>
        <div
          style={{
            background: "rgba(0,0,0,0.8)",
            border: "1px solid #ff4444",
            borderRadius: 4,
            padding: "2px 6px",
            color: "#ff4444",
            fontSize: 12,
            fontFamily: "monospace",
            fontWeight: "bold",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
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
        <meshStandardMaterial
          color={`hsl(${hsl})`}
          emissive={`hsl(${hsl})`}
          emissiveIntensity={1}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Html position={[0, 1.5, 0]} center zIndexRange={[100, 0]}>
        <div
          style={{
            color: `hsl(${hsl})`,
            fontSize: 10,
            fontFamily: "monospace",
            pointerEvents: "none",
            textShadow: "0 0 4px #000",
          }}
        >
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
      <meshStandardMaterial
        color="#22c55e"
        emissive="#22c55e"
        emissiveIntensity={0.5}
        transparent
        opacity={0.25}
        side={THREE.DoubleSide}
      />
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
  const anim = player.frozen
    ? "Idle"
    : player.isAttacking || isFlying
      ? "Attack"
      : player.isMoving
        ? "Running"
        : "Idle";

  const isInvincible = player.invincibleUntil > Date.now();
  const isCaged = player.cagedUntil > Date.now();
  const cageRemaining = isCaged ? Math.ceil((player.cagedUntil - Date.now()) / 1000) : 0;

  return (
    <group position={[player.position.x, 0, player.position.z]}>
      {isInvincible && <InvincibleRipple3D />}
      {isCaged && <CageMesh countdown={cageRemaining} />}
      <group scale={CHARACTER_VISUAL_SCALE}>
        <Suspense fallback={null}>
          <CharacterViewer color={color.chickColor} animState={anim} facingAngle={player.facingAngle} />
        </Suspense>
      </group>
      <Html position={[0, 2.8, 0]} center zIndexRange={[100, 0]}>
        <div
          style={{
            background: "rgba(0,0,0,0.6)",
            border: `1px solid hsl(${color.hsl})`,
            borderRadius: 3,
            padding: "1px 5px",
            color: `hsl(${color.hsl})`,
            fontSize: 9,
            fontFamily: "monospace",
            whiteSpace: "nowrap",
            pointerEvents: draggable ? "auto" : "none",
            cursor: draggable ? "grab" : "default",
          }}
        >
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
                const logicalX = pt.x / WORLD_SCALE;
                const logicalZ = pt.z / WORLD_SCALE;
                const valid = Math.abs(logicalX) <= MAP_HALF && Math.abs(logicalZ) <= MAP_HALF;
                return { x: logicalX, z: logicalZ, valid };
              };
              const move = (ev: PointerEvent) => {
                const hit = computeHit(ev);
                if (!hit) return;
                lastValid = hit.valid;
                onHostDragUpdate?.(connId, hit.x, hit.z);
              };
              const up = (ev: PointerEvent) => {
                ev.preventDefault();
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
                window.removeEventListener("pointercancel", up);
                const hit = computeHit(ev);
                onHostDragEnd?.(player.connId, hit ? hit.valid : lastValid);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up, { once: true });
              window.addEventListener("pointercancel", up, { once: true });
            }}
          >
            {color.name} {player.isEagle ? "🦅" : player.isStarStudent ? "⭐" : "🐤"}
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
  themeHue,
  immersive = false,
  themeMode = "dark",
  hideOverlays = false,
  devMode = false,
}: Props) {
  const playerList = Object.values(players);
  const mapVariant = useMemo(() => getMapVariant(mapId), [mapId]);
  const debugMode = DEBUG_MODE || devMode;
  const isLight = themeMode === "light";
  const isSemi = themeMode === "semi";
  const hasEdges = isLight || isSemi; // both light modes get edges

  // Derive themed colors when host picks a hue
  const hasTheme = themeHue !== undefined;
  const floorColor = isLight
    ? "#f0f0f0"
    : isSemi
      ? "#f0f0f0"
      : hasTheme
        ? themedColor(themeHue, 30, 8)
        : mapVariant.floorColor;
  const gridCell = isLight
    ? "#d0d0d0"
    : isSemi
      ? "#d0d0d0"
      : hasTheme
        ? themedColor(themeHue, 25, 15)
        : mapVariant.gridCellColor;
  const gridSection = isLight
    ? "#b0b0b0"
    : isSemi
      ? "#b0b0b0"
      : hasTheme
        ? themedColor(themeHue, 25, 22)
        : mapVariant.gridSectionColor;
  const wallColor = isLight || isSemi ? "#cccccc" : hasTheme ? themedColor(themeHue, 35, 18) : "#1a1a3a";
  const wallEmissive = isLight || isSemi ? "#999999" : hasTheme ? themedColor(themeHue, 40, 10) : "#0a0a2a";
  const buildingColor = isLight || isSemi ? "#e0e0e0" : hasTheme ? themedColor(themeHue, 30, 20) : "#2a2a4a";
  const buildingEmissive = isLight || isSemi ? "#cccccc" : hasTheme ? themedColor(themeHue, 35, 14) : "#1a1a3a";
  const obstacleColor = isLight || isSemi ? "#d8d8d8" : hasTheme ? themedColor(themeHue, 40, 25) : "#1e3a5f";
  const obstacleEmissive = isLight || isSemi ? "#bbbbbb" : hasTheme ? themedColor(themeHue, 45, 12) : "#0a1a3a";
  const floorVisualColor = useMemo(() => darkenColor(floorColor, debugMode ? 0.55 : 0.82), [debugMode, floorColor]);

  return (
    <div
      className={`w-full h-full rounded-lg border overflow-hidden relative ${isLight ? "border-border bg-white" : immersive ? "border-primary/20 bg-black" : "border-border bg-background"}`}
    >
      {/* Edge vignette haze — blurs map boundaries into void */}
      {immersive && (
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.85) 100%)" }}
        />
      )}
      <Canvas camera={{ position: [0, 56, 42], fov: 58 }} shadows>
        <MapCamera zoomLevel={zoomLevel} />
        {isLight ? (
          <LightModeLighting />
        ) : isSemi ? (
          <SemiLightLighting />
        ) : immersive ? (
          <ImmersiveLighting />
        ) : (
          <DayLighting />
        )}
        {immersive && !isLight && !isSemi && <SceneFog color="#050510" density={0.008} />}
        {immersive && !isLight && !isSemi && <MapParticles />}

        <group scale={[WORLD_SCALE, WORLD_SCALE, WORLD_SCALE]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
            <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
            <meshStandardMaterial color={floorVisualColor} roughness={0.9} />
          </mesh>

          <Grid
            args={[MAP_SIZE, MAP_SIZE]}
            position={[0, 0, 0]}
            cellSize={2}
            cellThickness={0.3}
            cellColor={gridCell}
            sectionSize={8}
            sectionThickness={0.6}
            sectionColor={gridSection}
            fadeDistance={80}
          />

          {[
            [0, 0.5, -MAP_SIZE / 2, MAP_SIZE, 1, 0.3] as const,
            [0, 0.5, MAP_SIZE / 2, MAP_SIZE, 1, 0.3] as const,
            [-MAP_SIZE / 2, 0.5, 0, 0.3, 1, MAP_SIZE] as const,
            [MAP_SIZE / 2, 0.5, 0, 0.3, 1, MAP_SIZE] as const,
          ].map(([x, y, z, w, h, d], i) => (
            <mesh key={`wall-${i}`} position={[x, y, z]}>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial
                color={wallColor}
                emissive={wallEmissive}
                emissiveIntensity={0.4}
                transparent
                opacity={0.7}
              />
            </mesh>
          ))}

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
                baseColor={buildingColor}
                baseEmissive={buildingEmissive}
                immersive={immersive}
                lightMode={hasEdges}
                hideOverlays={hideOverlays}
                devMode={debugMode}
                label={`B${b.id} (${b.position.x}, ${b.position.z})`}
              />
            );
          })}

          {debugMode ? (
            mapVariant.obstacles.map((o, i) => (
              <Obstacle
                key={i}
                position={o.position}
                size={o.size}
                rotation={o.rotation}
                baseColor={obstacleColor}
                baseEmissive={obstacleEmissive}
                lightMode={hasEdges}
                devMode
                label={`O${i} (${o.position.x}, ${o.position.z})`}
              />
            ))
          ) : (
            <InstancedObstacleLayer
              obstacles={mapVariant.obstacles}
              color={obstacleColor}
              emissive={obstacleEmissive}
              lightMode={hasEdges}
            />
          )}

          {mapVariant.natureObstacles.map((no, i) => (
            <NatureObstacleRenderer key={`nature-${i}`} obstacle={no} index={i} devMode={debugMode} />
          ))}

          {!hideOverlays &&
            propSpawns?.filter((p) => p.active).map((spawn) => <PropMarker key={spawn.id} spawn={spawn} />)}

          {!hideOverlays && mysteryBoxes?.map((box) => <MysteryBoxMarker key={box.id} box={box} immersive={immersive} />)}

          {!hideOverlays &&
            playerList.map((p) => (
              <GameCharacter
                key={p.connId}
                player={p}
                enableHostDrag={enableHostDrag}
                onHostDragBegin={onHostDragBegin}
                onHostDragUpdate={onHostDragUpdate}
                onHostDragEnd={onHostDragEnd}
              />
            ))}

          {!hideOverlays &&
            playerList
              .filter((p) => p.teleportPending && p.alive)
              .map((p) => {
                const color = PLAYER_COLORS[p.colorIndex];
                return color ? <TeleportDot key={`tp-${p.connId}`} position={p.teleportTarget} hsl={color.hsl} /> : null;
              })}

          {!hideOverlays &&
            activeTipShareConnIds?.map((connId) => {
              const p = players[connId];
              return p ? <TipShareRadiusCircle key={`tsr-${connId}`} position={p.position} /> : null;
            })}

          {!hideOverlays && eagleAwake === false && (
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[1.5, 1.5, 0.1, 24]} />
              <meshStandardMaterial
                color="#ff4444"
                emissive="#ff0000"
                emissiveIntensity={0.8}
                transparent
                opacity={0.4}
              />
            </mesh>
          )}

          {!hideOverlays && examState && !examState.answered && (
            <Html position={[0, 8, 0]} center zIndexRange={[100, 0]}>
              <div
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none" }}
              >
                <div
                  style={{
                    background: "rgba(0,0,0,0.8)",
                    border: "2px solid #ffd700",
                    borderRadius: 6,
                    padding: "4px 10px",
                    color: "#ffd700",
                    fontSize: 13,
                    fontFamily: "monospace",
                    fontWeight: "bold",
                    whiteSpace: "nowrap",
                  }}
                >
                  📝 FINAL EXAM — {Math.ceil(examState.timeRemaining)}s
                </div>
                {onHostSkipExam && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onHostSkipExam();
                    }}
                    style={{
                      pointerEvents: "auto",
                      cursor: "pointer",
                      fontSize: 11,
                      fontFamily: "monospace",
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid hsl(45 100% 45%)",
                      background: "rgba(0,0,0,0.85)",
                      color: "#ffd700",
                      fontWeight: "bold",
                    }}
                  >
                    Skip EXAM
                  </button>
                )}
              </div>
            </Html>
          )}

          {debugMode && (
            <gridHelper args={[MAP_SIZE, MAP_SIZE / 2, "#666666", "#444444"]} position={[0, 0.02, 0]} />
          )}
        </group>
      </Canvas>
    </div>
  );
}
