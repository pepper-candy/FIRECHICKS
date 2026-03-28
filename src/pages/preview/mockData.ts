import type { GameStateSnapshot, PlayerGameStateSerializable } from '@/lib/gameTypes';

const mockChickPlayer = (connId: string, colorIndex: number, chickColor: string, overrides?: Partial<PlayerGameStateSerializable>): PlayerGameStateSerializable => ({
  connId,
  colorIndex,
  chickColor: chickColor as any,
  isEagle: false,
  health: 4.3,
  alive: true,
  isStarStudent: false,
  tips: [false, false],
  props: [{ type: 'speed', count: 2 }, { type: 'heal', count: 1 }],
  position: { x: 0, z: 0 },
  facingAngle: 0,
  frozen: false,
  frozenUntil: 0,
  attackCooldownUntil: 0,
  socialCircleMet: [],
  invincibleUntil: 0,
  actionScore: 15,
  survivalTime: 45,
  damageTaken: 0,
  damageDealt: 0,
  speedMultiplier: 1,
  speedMultiplierUntil: 0,
  flyCooldownUntil: 0,
  isMoving: false,
  isAttacking: false,
  attackAnimUntil: 0,
  tipShareCooldownUntil: 0,
  teleportPending: false,
  teleportTarget: { x: 0, z: 0 },
  cagedUntil: 0,
  cageCooldownUntil: 0,
  attackRemainingMs: 0,
  flyRemainingMs: 0,
  cageRemainingMs: 0,
  ...overrides,
});

const mockEaglePlayer = (connId: string, colorIndex: number, chickColor: string, overrides?: Partial<PlayerGameStateSerializable>): PlayerGameStateSerializable => ({
  ...mockChickPlayer(connId, colorIndex, chickColor),
  isEagle: true,
  props: [{ type: 'fly', count: 1 }],
  damageDealt: 4,
  actionScore: 25,
  ...overrides,
});

export const MOCK_PLAYERS_1V3: Record<string, PlayerGameStateSerializable> = {
  'eagle-1': mockEaglePlayer('eagle-1', 0, 'Black'),
  'chick-1': mockChickPlayer('chick-1', 2, 'Red', { position: { x: 3, z: 2 } }),
  'chick-2': mockChickPlayer('chick-2', 4, 'Blue', { position: { x: -3, z: -2 }, tips: [true, false], isStarStudent: true }),
  'chick-3': mockChickPlayer('chick-3', 5, 'Green', { position: { x: 1, z: -4 } }),
};

export const MOCK_BUILDINGS = [
  { id: 0, position: { x: -8, z: -8 }, hasTip: true, tipIndex: 0 as const, glowing: true, zoneHealth: 50, zoneActive: true, tipObtained: false, tipObtainedCount: 0 },
  { id: 1, position: { x: 8, z: -8 }, hasTip: false, tipIndex: 0 as const, glowing: false, zoneHealth: 50, zoneActive: false, tipObtained: false, tipObtainedCount: 0 },
  { id: 2, position: { x: -8, z: 8 }, hasTip: false, tipIndex: 0 as const, glowing: false, zoneHealth: 50, zoneActive: false, tipObtained: false, tipObtainedCount: 0 },
  { id: 3, position: { x: 8, z: 8 }, hasTip: true, tipIndex: 1 as const, glowing: true, zoneHealth: 50, zoneActive: true, tipObtained: false, tipObtainedCount: 0 },
];

export function createMockSnapshot(overrides?: Partial<GameStateSnapshot>): GameStateSnapshot {
  return {
    phase: 'playing',
    stage: 1,
    gameTime: 45,
    countdownTime: 0,
    eagleAwake: true,
    players: MOCK_PLAYERS_1V3,
    frozenAll: false,
    frozenAllUntil: 0,
    videoPlaying: null,
    propSpawns: [],
    buildings: MOCK_BUILDINGS,
    winner: null,
    stageLabel: 'Get Exam Tips from glowing buildings!',
    examState: null,
    mysteryBoxes: [],
    activeEvent: null,
    stageTransitionUntil: 0,
    activeTipShareConnIds: [],
    totalPauseMs: 0,
    ...overrides,
  };
}
