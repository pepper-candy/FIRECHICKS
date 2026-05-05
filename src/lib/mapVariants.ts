/**
 * Map variant definitions — 4 unique gameplay maps.
 * Map 1 is the original from gameplayMapData.ts.
 * Maps 2-4 introduce trees, ponds, rocks, and varied layouts.
 */

import type { BuildingDef, ObstacleDef } from './gameplayMapData';

export type MapId = 1 | 2 | 3 | 4;

export type NatureObstacleType = 'tree' | 'pond' | 'rock' | 'bush';

export interface NatureObstacle {
  type: NatureObstacleType;
  position: { x: number; z: number };
  scale?: number;
  rotation?: number;
}

export interface MapVariant {
  id: MapId;
  name: string;
  description: string;
  floorColor: string;
  gridCellColor: string;
  gridSectionColor: string;
  buildings: BuildingDef[];
  obstacles: ObstacleDef[];
  natureObstacles: NatureObstacle[];
  spawnPoints: { x: number; z: number }[];
  eagleSpawnCandidates: { x: number; z: number }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAP 1 — Original Cyber Arena (unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
const MAP1: MapVariant = {
  id: 1,
  name: 'Verdant Enclave',
  description: 'Hidden grassland, glass shelters, open skies',
  floorColor: '#080814',
  gridCellColor: '#1a1a44',
  gridSectionColor: '#2a2a66',
  buildings: [
    { id: 0, position: { x: -22, z: -22 }, size: { w: 5, h: 6, d: 5 } },
    { id: 1, position: { x: 22, z: -22 }, size: { w: 5, h: 6, d: 5 } },
    { id: 2, position: { x: -22, z: 22 }, size: { w: 5, h: 6, d: 5 } },
    { id: 3, position: { x: 22, z: 22 }, size: { w: 5, h: 6, d: 5 } },
  ],
  obstacles: [
    { position: { x: 0, z: 0 }, size: { w: 6, h: 2, d: 0.5 }, rotation: 0 },
    { position: { x: 0, z: 0 }, size: { w: 0.5, h: 2, d: 6 }, rotation: 0 },
    { position: { x: -8, z: -5 }, size: { w: 4, h: 2, d: 0.5 }, rotation: Math.PI / 4 },
    { position: { x: 8, z: -5 }, size: { w: 4, h: 2, d: 0.5 }, rotation: -Math.PI / 4 },
    { position: { x: -8, z: 5 }, size: { w: 4, h: 2, d: 0.5 }, rotation: -Math.PI / 4 },
    { position: { x: 8, z: 5 }, size: { w: 4, h: 2, d: 0.5 }, rotation: Math.PI / 4 },
    { position: { x: -14, z: 0 }, size: { w: 0.5, h: 2, d: 5 }, rotation: 0 },
    { position: { x: 14, z: 0 }, size: { w: 0.5, h: 2, d: 5 }, rotation: 0 },
    { position: { x: 0, z: -14 }, size: { w: 5, h: 2, d: 0.5 }, rotation: 0 },
    { position: { x: 0, z: 14 }, size: { w: 5, h: 2, d: 0.5 }, rotation: 0 },
    { position: { x: -14, z: -14 }, size: { w: 3, h: 2, d: 0.5 }, rotation: Math.PI / 6 },
    { position: { x: 14, z: -14 }, size: { w: 3, h: 2, d: 0.5 }, rotation: -Math.PI / 6 },
    { position: { x: -14, z: 14 }, size: { w: 3, h: 2, d: 0.5 }, rotation: -Math.PI / 6 },
    { position: { x: 14, z: 14 }, size: { w: 3, h: 2, d: 0.5 }, rotation: Math.PI / 6 },
    { position: { x: -6, z: -18 }, size: { w: 4, h: 2, d: 0.5 }, rotation: 0 },
    { position: { x: 6, z: -18 }, size: { w: 4, h: 2, d: 0.5 }, rotation: 0 },
    { position: { x: -6, z: 18 }, size: { w: 4, h: 2, d: 0.5 }, rotation: 0 },
    { position: { x: 6, z: 18 }, size: { w: 4, h: 2, d: 0.5 }, rotation: 0 },
    { position: { x: -18, z: -6 }, size: { w: 0.5, h: 2, d: 4 }, rotation: 0 },
    { position: { x: -18, z: 6 }, size: { w: 0.5, h: 2, d: 4 }, rotation: 0 },
    { position: { x: 18, z: -6 }, size: { w: 0.5, h: 2, d: 4 }, rotation: 0 },
    { position: { x: 18, z: 6 }, size: { w: 0.5, h: 2, d: 4 }, rotation: 0 },
  ],
  natureObstacles: [],
  spawnPoints: [
    { x: -18, z: -18 }, { x: 18, z: -18 }, { x: -18, z: 18 }, { x: 18, z: 18 },
  ],
  eagleSpawnCandidates: [
    { x: 2, z: -2 }, { x: 2, z: 2 }, { x: -2, z: 2 }, { x: -2, z: -2 },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAP 2 — Enchanted Forest
// ═══════════════════════════════════════════════════════════════════════════════
const MAP2: MapVariant = {
  id: 2,
  name: 'Enchanted Forest',
  description: 'Dense woodland with ponds and clearings',
  floorColor: '#0a1a0a',
  gridCellColor: '#1a2a1a',
  gridSectionColor: '#2a3a2a',
  buildings: [
    { id: 0, position: { x: -20, z: -20 }, size: { w: 5, h: 5, d: 5 } },
    { id: 1, position: { x: 20, z: -20 }, size: { w: 5, h: 5, d: 5 } },
    { id: 2, position: { x: -20, z: 20 }, size: { w: 5, h: 5, d: 5 } },
    { id: 3, position: { x: 20, z: 20 }, size: { w: 5, h: 5, d: 5 } },
  ],
  obstacles: [
    { position: { x: -3, z: 0 }, size: { w: 0.5, h: 1.8, d: 4 }, rotation: 0 },
    { position: { x: 3, z: 0 }, size: { w: 0.5, h: 1.8, d: 4 }, rotation: 0 },
    { position: { x: -12, z: -12 }, size: { w: 4, h: 1.8, d: 0.5 }, rotation: Math.PI / 3 },
    { position: { x: 12, z: -12 }, size: { w: 4, h: 1.8, d: 0.5 }, rotation: -Math.PI / 3 },
    { position: { x: -12, z: 12 }, size: { w: 4, h: 1.8, d: 0.5 }, rotation: -Math.PI / 3 },
    { position: { x: 12, z: 12 }, size: { w: 4, h: 1.8, d: 0.5 }, rotation: Math.PI / 3 },
  ],
  natureObstacles: [
    { type: 'tree', position: { x: -8, z: -3 }, scale: 1.2 },
    { type: 'tree', position: { x: -9, z: -1 }, scale: 0.9 },
    { type: 'tree', position: { x: -7, z: 2 }, scale: 1.1 },
    { type: 'tree', position: { x: 8, z: -3 }, scale: 1.0 },
    { type: 'tree', position: { x: 9, z: 1 }, scale: 1.3 },
    { type: 'tree', position: { x: 7, z: 3 }, scale: 0.8 },
    { type: 'tree', position: { x: -16, z: -6 }, scale: 1.4 },
    { type: 'tree', position: { x: -16, z: 6 }, scale: 1.1 },
    { type: 'tree', position: { x: 16, z: -6 }, scale: 1.2 },
    { type: 'tree', position: { x: 16, z: 6 }, scale: 1.0 },
    { type: 'tree', position: { x: -6, z: -16 }, scale: 1.3 },
    { type: 'tree', position: { x: 6, z: -16 }, scale: 0.9 },
    { type: 'tree', position: { x: -6, z: 16 }, scale: 1.1 },
    { type: 'tree', position: { x: 6, z: 16 }, scale: 1.4 },
    { type: 'tree', position: { x: -26, z: -15 }, scale: 1.0 },
    { type: 'tree', position: { x: -15, z: -26 }, scale: 1.2 },
    { type: 'tree', position: { x: 26, z: -15 }, scale: 1.1 },
    { type: 'tree', position: { x: 15, z: -26 }, scale: 0.9 },
    { type: 'tree', position: { x: -26, z: 15 }, scale: 1.3 },
    { type: 'tree', position: { x: -15, z: 26 }, scale: 1.0 },
    { type: 'tree', position: { x: 26, z: 15 }, scale: 0.8 },
    { type: 'tree', position: { x: 15, z: 26 }, scale: 1.2 },
    { type: 'pond', position: { x: 0, z: -10 }, scale: 1.5 },
    { type: 'pond', position: { x: 0, z: 10 }, scale: 1.3 },
    { type: 'pond', position: { x: -18, z: 0 }, scale: 1.0 },
    { type: 'pond', position: { x: 18, z: 0 }, scale: 1.2 },
    { type: 'rock', position: { x: -5, z: -8 }, scale: 0.7 },
    { type: 'rock', position: { x: 5, z: 8 }, scale: 0.9 },
    { type: 'rock', position: { x: -10, z: 10 }, scale: 0.6 },
    { type: 'rock', position: { x: 10, z: -10 }, scale: 0.8 },
    { type: 'bush', position: { x: -4, z: 5 }, scale: 0.8 },
    { type: 'bush', position: { x: 4, z: -5 }, scale: 0.7 },
    { type: 'bush', position: { x: -13, z: -3 }, scale: 0.9 },
    { type: 'bush', position: { x: 13, z: 3 }, scale: 0.6 },
  ],
  spawnPoints: [
    { x: -16, z: -16 }, { x: 16, z: -16 }, { x: -16, z: 16 }, { x: 16, z: 16 },
  ],
  eagleSpawnCandidates: [
    { x: 0, z: 0 }, { x: 3, z: -3 }, { x: -3, z: 3 }, { x: -3, z: -3 },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAP 3 — Rocky Canyon
// ═══════════════════════════════════════════════════════════════════════════════
const MAP3: MapVariant = {
  id: 3,
  name: 'Rocky Canyon',
  description: 'Narrow canyons with towering rock walls',
  floorColor: '#1a0f08',
  gridCellColor: '#2a1a10',
  gridSectionColor: '#3a2a1a',
  buildings: [
    { id: 0, position: { x: -24, z: -18 }, size: { w: 5, h: 7, d: 5 } },
    { id: 1, position: { x: 24, z: -18 }, size: { w: 5, h: 7, d: 5 } },
    { id: 2, position: { x: -18, z: 24 }, size: { w: 5, h: 7, d: 5 } },
    { id: 3, position: { x: 18, z: 24 }, size: { w: 5, h: 7, d: 5 } },
  ],
  obstacles: [
    { position: { x: -10, z: -8 }, size: { w: 8, h: 3, d: 0.6 }, rotation: 0 },
    { position: { x: 10, z: -8 }, size: { w: 8, h: 3, d: 0.6 }, rotation: 0 },
    { position: { x: 0, z: 5 }, size: { w: 12, h: 3, d: 0.6 }, rotation: 0 },
    { position: { x: -5, z: 0 }, size: { w: 0.6, h: 3, d: 8 }, rotation: 0 },
    { position: { x: 5, z: 0 }, size: { w: 0.6, h: 3, d: 8 }, rotation: 0 },
    { position: { x: -18, z: -8 }, size: { w: 0.6, h: 2.5, d: 6 }, rotation: 0 },
    { position: { x: 18, z: -8 }, size: { w: 0.6, h: 2.5, d: 6 }, rotation: 0 },
    { position: { x: -8, z: 18 }, size: { w: 6, h: 2.5, d: 0.6 }, rotation: 0 },
    { position: { x: 8, z: 18 }, size: { w: 6, h: 2.5, d: 0.6 }, rotation: 0 },
  ],
  natureObstacles: [
    { type: 'rock', position: { x: -2, z: -14 }, scale: 2.0 },
    { type: 'rock', position: { x: 2, z: -16 }, scale: 1.8 },
    { type: 'rock', position: { x: 0, z: 14 }, scale: 2.2 },
    { type: 'rock', position: { x: -14, z: 0 }, scale: 1.5 },
    { type: 'rock', position: { x: 14, z: 0 }, scale: 1.7 },
    { type: 'rock', position: { x: -8, z: 12 }, scale: 0.9 },
    { type: 'rock', position: { x: 8, z: 12 }, scale: 1.1 },
    { type: 'rock', position: { x: -20, z: 5 }, scale: 1.3 },
    { type: 'rock', position: { x: 20, z: 5 }, scale: 1.0 },
    { type: 'rock', position: { x: -20, z: -20 }, scale: 0.8 },
    { type: 'rock', position: { x: 20, z: -20 }, scale: 0.7 },
    { type: 'rock', position: { x: -12, z: -20 }, scale: 1.4 },
    { type: 'rock', position: { x: 12, z: -20 }, scale: 1.2 },
    { type: 'tree', position: { x: -15, z: 15 }, scale: 0.7 },
    { type: 'tree', position: { x: 15, z: 15 }, scale: 0.8 },
    { type: 'tree', position: { x: 0, z: -22 }, scale: 0.6 },
    { type: 'tree', position: { x: -24, z: 10 }, scale: 0.9 },
    { type: 'pond', position: { x: 0, z: -2 }, scale: 1.0 },
    { type: 'bush', position: { x: -4, z: -5 }, scale: 0.6 },
    { type: 'bush', position: { x: 4, z: -5 }, scale: 0.5 },
    { type: 'bush', position: { x: -3, z: 8 }, scale: 0.7 },
    { type: 'bush', position: { x: 3, z: 8 }, scale: 0.6 },
  ],
  spawnPoints: [
    { x: -20, z: -14 }, { x: 20, z: -14 }, { x: -14, z: 20 }, { x: 14, z: 20 },
  ],
  eagleSpawnCandidates: [
    { x: 0, z: 0 }, { x: -2, z: -2 }, { x: 2, z: 2 }, { x: 2, z: -2 },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAP 4 — Mystic Lake
// ═══════════════════════════════════════════════════════════════════════════════
const MAP4: MapVariant = {
  id: 4,
  name: 'Mystic Lake',
  description: 'A serene lake surrounded by ancient trees and bridges',
  floorColor: '#060e14',
  gridCellColor: '#102030',
  gridSectionColor: '#1a3050',
  buildings: [
    { id: 0, position: { x: -22, z: 0 }, size: { w: 5, h: 5, d: 5 } },
    { id: 1, position: { x: 22, z: 0 }, size: { w: 5, h: 5, d: 5 } },
    { id: 2, position: { x: 0, z: -22 }, size: { w: 5, h: 5, d: 5 } },
    { id: 3, position: { x: 0, z: 22 }, size: { w: 5, h: 5, d: 5 } },
  ],
  obstacles: [
    { position: { x: -11, z: -11 }, size: { w: 6, h: 0.3, d: 1.5 }, rotation: Math.PI / 4 },
    { position: { x: 11, z: -11 }, size: { w: 6, h: 0.3, d: 1.5 }, rotation: -Math.PI / 4 },
    { position: { x: -11, z: 11 }, size: { w: 6, h: 0.3, d: 1.5 }, rotation: -Math.PI / 4 },
    { position: { x: 11, z: 11 }, size: { w: 6, h: 0.3, d: 1.5 }, rotation: Math.PI / 4 },
    { position: { x: -7, z: 0 }, size: { w: 0.5, h: 2, d: 5 }, rotation: 0 },
    { position: { x: 7, z: 0 }, size: { w: 0.5, h: 2, d: 5 }, rotation: 0 },
    { position: { x: 0, z: -7 }, size: { w: 5, h: 2, d: 0.5 }, rotation: 0 },
    { position: { x: 0, z: 7 }, size: { w: 5, h: 2, d: 0.5 }, rotation: 0 },
  ],
  natureObstacles: [
    { type: 'pond', position: { x: 0, z: 0 }, scale: 3.0 },
    { type: 'pond', position: { x: -14, z: -14 }, scale: 1.2 },
    { type: 'pond', position: { x: 14, z: 14 }, scale: 1.4 },
    { type: 'pond', position: { x: -14, z: 14 }, scale: 1.0 },
    { type: 'pond', position: { x: 14, z: -14 }, scale: 1.1 },
    { type: 'tree', position: { x: -4, z: -4 }, scale: 1.5 },
    { type: 'tree', position: { x: 4, z: -4 }, scale: 1.3 },
    { type: 'tree', position: { x: -4, z: 4 }, scale: 1.4 },
    { type: 'tree', position: { x: 4, z: 4 }, scale: 1.2 },
    { type: 'tree', position: { x: -18, z: -12 }, scale: 1.6 },
    { type: 'tree', position: { x: -18, z: 12 }, scale: 1.4 },
    { type: 'tree', position: { x: 18, z: -12 }, scale: 1.5 },
    { type: 'tree', position: { x: 18, z: 12 }, scale: 1.3 },
    { type: 'tree', position: { x: -12, z: -18 }, scale: 1.2 },
    { type: 'tree', position: { x: 12, z: -18 }, scale: 1.7 },
    { type: 'tree', position: { x: -12, z: 18 }, scale: 1.1 },
    { type: 'tree', position: { x: 12, z: 18 }, scale: 1.4 },
    { type: 'tree', position: { x: -26, z: -26 }, scale: 1.0 },
    { type: 'tree', position: { x: 26, z: -26 }, scale: 1.2 },
    { type: 'tree', position: { x: -26, z: 26 }, scale: 1.1 },
    { type: 'tree', position: { x: 26, z: 26 }, scale: 1.3 },
    { type: 'rock', position: { x: -3, z: -6 }, scale: 0.5 },
    { type: 'rock', position: { x: 3, z: 6 }, scale: 0.6 },
    { type: 'rock', position: { x: -6, z: 3 }, scale: 0.4 },
    { type: 'rock', position: { x: 6, z: -3 }, scale: 0.7 },
    { type: 'bush', position: { x: -10, z: -5 }, scale: 0.8 },
    { type: 'bush', position: { x: 10, z: 5 }, scale: 0.7 },
    { type: 'bush', position: { x: -5, z: 10 }, scale: 0.6 },
    { type: 'bush', position: { x: 5, z: -10 }, scale: 0.9 },
    { type: 'bush', position: { x: -15, z: 0 }, scale: 0.5 },
    { type: 'bush', position: { x: 15, z: 0 }, scale: 0.6 },
  ],
  spawnPoints: [
    { x: -18, z: 4 }, { x: 18, z: -4 }, { x: 4, z: -18 }, { x: -4, z: 18 },
  ],
  eagleSpawnCandidates: [
    { x: 10, z: 10 }, { x: -10, z: -10 }, { x: 10, z: -10 }, { x: -10, z: 10 },
  ],
};

export const MAP_VARIANTS: Record<MapId, MapVariant> = {
  1: MAP1,
  2: MAP2,
  3: MAP3,
  4: MAP4,
};

export const MAP_LIST: MapVariant[] = [MAP1, MAP2, MAP3, MAP4];

export function getMapVariant(id: MapId): MapVariant {
  return MAP_VARIANTS[id] ?? MAP1;
}
