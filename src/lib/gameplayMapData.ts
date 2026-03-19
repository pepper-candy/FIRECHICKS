// Gameplay map: 64x64 units, centered at origin (4x larger than lobby's 16x16)

export const MAP_SIZE = 64;
export const MAP_HALF = MAP_SIZE / 2;

export interface BuildingDef {
  id: number;
  position: { x: number; z: number };
  size: { w: number; h: number; d: number };
}

// Buildings at 4 corners, ~10 units buffer from each edge
export const BUILDINGS: BuildingDef[] = [
  { id: 0, position: { x: -22, z: -22 }, size: { w: 5, h: 6, d: 5 } },
  { id: 1, position: { x:  22, z: -22 }, size: { w: 5, h: 6, d: 5 } },
  { id: 2, position: { x: -22, z:  22 }, size: { w: 5, h: 6, d: 5 } },
  { id: 3, position: { x:  22, z:  22 }, size: { w: 5, h: 6, d: 5 } },
];

// Diagonal pairs for exam tips
export const DIAGONAL_PAIRS: [number, number][] = [
  [0, 3], // top-left ↔ bottom-right
  [1, 2], // top-right ↔ bottom-left
];

export interface ObstacleDef {
  position: { x: number; z: number };
  size: { w: number; h: number; d: number };
  rotation?: number;
}

// Short obstacle bars for chase dynamics — arranged to leave clear paths to all buildings
export const OBSTACLES: ObstacleDef[] = [
  // Center cross
  { position: { x: 0, z: 0 }, size: { w: 6, h: 2, d: 0.5 }, rotation: 0 },
  { position: { x: 0, z: 0 }, size: { w: 0.5, h: 2, d: 6 }, rotation: 0 },

  // Inner ring — angled bars (leave diagonal passages)
  { position: { x: -8, z: -5 }, size: { w: 4, h: 2, d: 0.5 }, rotation: Math.PI / 4 },
  { position: { x:  8, z: -5 }, size: { w: 4, h: 2, d: 0.5 }, rotation: -Math.PI / 4 },
  { position: { x: -8, z:  5 }, size: { w: 4, h: 2, d: 0.5 }, rotation: -Math.PI / 4 },
  { position: { x:  8, z:  5 }, size: { w: 4, h: 2, d: 0.5 }, rotation: Math.PI / 4 },

  // Mid-field horizontal/vertical bars
  { position: { x: -14, z:  0 }, size: { w: 0.5, h: 2, d: 5 }, rotation: 0 },
  { position: { x:  14, z:  0 }, size: { w: 0.5, h: 2, d: 5 }, rotation: 0 },
  { position: { x:   0, z: -14 }, size: { w: 5, h: 2, d: 0.5 }, rotation: 0 },
  { position: { x:   0, z:  14 }, size: { w: 5, h: 2, d: 0.5 }, rotation: 0 },

  // Near buildings (not blocking approach paths)
  { position: { x: -14, z: -14 }, size: { w: 3, h: 2, d: 0.5 }, rotation: Math.PI / 6 },
  { position: { x:  14, z: -14 }, size: { w: 3, h: 2, d: 0.5 }, rotation: -Math.PI / 6 },
  { position: { x: -14, z:  14 }, size: { w: 3, h: 2, d: 0.5 }, rotation: -Math.PI / 6 },
  { position: { x:  14, z:  14 }, size: { w: 3, h: 2, d: 0.5 }, rotation: Math.PI / 6 },

  // Outer ring — spread across far field
  { position: { x:  -6, z: -18 }, size: { w: 4, h: 2, d: 0.5 }, rotation: 0 },
  { position: { x:   6, z: -18 }, size: { w: 4, h: 2, d: 0.5 }, rotation: 0 },
  { position: { x:  -6, z:  18 }, size: { w: 4, h: 2, d: 0.5 }, rotation: 0 },
  { position: { x:   6, z:  18 }, size: { w: 4, h: 2, d: 0.5 }, rotation: 0 },
  { position: { x: -18, z:  -6 }, size: { w: 0.5, h: 2, d: 4 }, rotation: 0 },
  { position: { x: -18, z:   6 }, size: { w: 0.5, h: 2, d: 4 }, rotation: 0 },
  { position: { x:  18, z:  -6 }, size: { w: 0.5, h: 2, d: 4 }, rotation: 0 },
  { position: { x:  18, z:   6 }, size: { w: 0.5, h: 2, d: 4 }, rotation: 0 },
];

// Spawn points for players (spread around center)
export const SPAWN_POINTS: { x: number; z: number }[] = [
  { x: -5, z: -5 },
  { x:  5, z: -5 },
  { x: -5, z:  5 },
  { x:  5, z:  5 },
  { x: -10, z:  0 },
  { x:  10, z:  0 },
  { x:   0, z: -10 },
  { x:   0, z:  10 },
];

export const EAGLE_SPAWN = { x: 0, z: 0 };

// Protected zone radius (around buildings)
export const ZONE_RADIUS = 4.0;
// Eagle attack overlap threshold
export const ATTACK_OVERLAP_THRESHOLD = 2.2;
// Social circle overlap threshold
export const SOCIAL_CIRCLE_THRESHOLD = 1.8;
// Prop pickup radius
export const PROP_PICKUP_RADIUS = 1.8;
// Exam venue entry radius
export const EXAM_ENTRY_RADIUS = 4.5;

/** Returns true if position collides with map boundaries, buildings, or obstacles */
export function checkCollision(
  x: number,
  z: number,
  radius: number = 0.5,
  ignoreObstacles: boolean = false,
): boolean {
  if (Math.abs(x) > MAP_HALF - radius || Math.abs(z) > MAP_HALF - radius) return true;

  for (const b of BUILDINGS) {
    const hw = b.size.w / 2 + radius;
    const hd = b.size.d / 2 + radius;
    if (Math.abs(x - b.position.x) < hw && Math.abs(z - b.position.z) < hd) return true;
  }

  if (ignoreObstacles) return false;

  for (const o of OBSTACLES) {
    const hw = o.size.w / 2 + radius;
    const hd = o.size.d / 2 + radius;
    if (Math.abs(x - o.position.x) < hw && Math.abs(z - o.position.z) < hd) return true;
  }

  return false;
}

/**
 * Sliding AABB collision resolution.
 * Tries: full move → slide along X → slide along Z → stay.
 */
export function resolvePosition(
  newX: number,
  newZ: number,
  oldX: number,
  oldZ: number,
  radius: number = 0.5,
  ignoreObstacles: boolean = false,
): { x: number; z: number } {
  const cx = Math.max(-MAP_HALF + radius, Math.min(MAP_HALF - radius, newX));
  const cz = Math.max(-MAP_HALF + radius, Math.min(MAP_HALF - radius, newZ));

  if (!checkCollision(cx, cz, radius, ignoreObstacles)) return { x: cx, z: cz };
  if (!checkCollision(cx, oldZ, radius, ignoreObstacles)) return { x: cx, z: oldZ };
  if (!checkCollision(oldX, cz, radius, ignoreObstacles)) return { x: oldX, z: cz };
  return { x: oldX, z: oldZ };
}

/** Push an entity out of a wall (e.g. after flying through obstacles) */
export function pushOutOfWall(
  x: number,
  z: number,
  radius: number = 0.5,
): { x: number; z: number } {
  if (!checkCollision(x, z, radius)) return { x, z };
  for (let r = 0.25; r <= 4.0; r += 0.25) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const tx = x + Math.cos(a) * r;
      const tz = z + Math.sin(a) * r;
      if (!checkCollision(tx, tz, radius)) return { x: tx, z: tz };
    }
  }
  return { x, z };
}

/** Check overlap between two world positions */
export function checkOverlap(
  x1: number, z1: number,
  x2: number, z2: number,
  threshold: number = 1.5,
): boolean {
  const dx = x1 - x2;
  const dz = z1 - z2;
  return dx * dx + dz * dz < threshold * threshold;
}

/** Check if position is inside a building's protected zone */
export function isInProtectedZone(
  x: number,
  z: number,
  buildingId: number,
  zoneRadius: number = ZONE_RADIUS,
): boolean {
  const b = BUILDINGS[buildingId];
  if (!b) return false;
  const dx = x - b.position.x;
  const dz = z - b.position.z;
  return dx * dx + dz * dz < zoneRadius * zoneRadius;
}

/** Returns building ID if chick is near any building (for exam entry), else -1 */
export function getAdjacentBuilding(x: number, z: number, radius: number = EXAM_ENTRY_RADIUS): number {
  for (const b of BUILDINGS) {
    if (isInProtectedZone(x, z, b.id, radius)) return b.id;
  }
  return -1;
}
