// Gameplay map: 32x32 units, centered at origin

export const MAP_SIZE = 32;
export const MAP_HALF = MAP_SIZE / 2;

// Buildings at 4 corners, offset from edges
export interface BuildingDef {
  id: number;
  position: { x: number; z: number };
  size: { w: number; h: number; d: number }; // width, height, depth
}

export const BUILDINGS: BuildingDef[] = [
  { id: 0, position: { x: -11, z: -11 }, size: { w: 3, h: 4, d: 3 } },
  { id: 1, position: { x:  11, z: -11 }, size: { w: 3, h: 4, d: 3 } },
  { id: 2, position: { x: -11, z:  11 }, size: { w: 3, h: 4, d: 3 } },
  { id: 3, position: { x:  11, z:  11 }, size: { w: 3, h: 4, d: 3 } },
];

// Diagonal pairs for exam tips
export const DIAGONAL_PAIRS: [number, number][] = [
  [0, 3], // top-left, bottom-right
  [1, 2], // top-right, bottom-left
];

// Short obstacle walls for chase dynamics
export interface ObstacleDef {
  position: { x: number; z: number };
  size: { w: number; h: number; d: number };
  rotation?: number; // y-axis rotation in radians
}

export const OBSTACLES: ObstacleDef[] = [
  // Center area obstacles
  { position: { x: 0, z: 0 }, size: { w: 4, h: 1.5, d: 0.4 }, rotation: 0 },
  { position: { x: -5, z: -3 }, size: { w: 3, h: 1.5, d: 0.4 }, rotation: Math.PI / 4 },
  { position: { x: 5, z: 3 }, size: { w: 3, h: 1.5, d: 0.4 }, rotation: -Math.PI / 4 },
  // Mid-area obstacles
  { position: { x: -7, z: 5 }, size: { w: 2.5, h: 1.5, d: 0.4 }, rotation: Math.PI / 6 },
  { position: { x: 7, z: -5 }, size: { w: 2.5, h: 1.5, d: 0.4 }, rotation: -Math.PI / 6 },
  { position: { x: 3, z: -7 }, size: { w: 3, h: 1.5, d: 0.4 }, rotation: Math.PI / 3 },
  { position: { x: -3, z: 7 }, size: { w: 3, h: 1.5, d: 0.4 }, rotation: -Math.PI / 3 },
  // Near buildings
  { position: { x: -6, z: -7 }, size: { w: 2, h: 1.5, d: 0.4 }, rotation: 0 },
  { position: { x: 6, z: 7 }, size: { w: 2, h: 1.5, d: 0.4 }, rotation: 0 },
  { position: { x: 0, z: -6 }, size: { w: 2, h: 1.5, d: 0.4 }, rotation: Math.PI / 2 },
  { position: { x: 0, z: 6 }, size: { w: 2, h: 1.5, d: 0.4 }, rotation: Math.PI / 2 },
];

// Spawn points for players (spread around center)
export const SPAWN_POINTS: { x: number; z: number }[] = [
  { x: -3, z: -3 },
  { x: 3, z: -3 },
  { x: -3, z: 3 },
  { x: 3, z: 3 },
  { x: -6, z: 0 },
  { x: 6, z: 0 },
  { x: 0, z: -6 },
  { x: 0, z: 6 },
];

// Eagle spawn point (center)
export const EAGLE_SPAWN = { x: 0, z: 0 };

// Check if a position collides with any building or obstacle
export function checkCollision(
  x: number, z: number, radius: number = 0.5
): boolean {
  // Map boundaries
  if (Math.abs(x) > MAP_HALF - radius || Math.abs(z) > MAP_HALF - radius) return true;

  // Buildings
  for (const b of BUILDINGS) {
    const hw = b.size.w / 2 + radius;
    const hd = b.size.d / 2 + radius;
    if (Math.abs(x - b.position.x) < hw && Math.abs(z - b.position.z) < hd) return true;
  }

  // Obstacles (simplified AABB - ignoring rotation for collision)
  for (const o of OBSTACLES) {
    const hw = o.size.w / 2 + radius;
    const hd = o.size.d / 2 + radius;
    if (Math.abs(x - o.position.x) < hw && Math.abs(z - o.position.z) < hd) return true;
  }

  return false;
}

// Check overlap between two positions
export function checkOverlap(
  x1: number, z1: number,
  x2: number, z2: number,
  threshold: number = 1.5
): boolean {
  const dx = x1 - x2;
  const dz = z1 - z2;
  return Math.sqrt(dx * dx + dz * dz) < threshold;
}

// Check if position is inside a building's protected zone
export function isInProtectedZone(
  x: number, z: number,
  buildingId: number,
  zoneRadius: number = 2.5
): boolean {
  const b = BUILDINGS[buildingId];
  if (!b) return false;
  const dx = x - b.position.x;
  const dz = z - b.position.z;
  return Math.sqrt(dx * dx + dz * dz) < zoneRadius;
}
