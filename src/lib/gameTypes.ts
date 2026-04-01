import type { ChickColor } from '@/components/CharacterViewer';

export type GameMode = '1v3' | '2v6';
export type GamePhase = 'lobby' | 'reveal' | 'countdown' | 'playing' | 'exam' | 'gameover';
export type GameStage = 0 | 1 | 2 | 3;
export type PropType = 'speed' | 'heal' | 'fly' | 'invincible' | 'teleport' | 'cage';
export type AnimState = 'Idle' | 'Running' | 'Victory' | 'Attack';

export const STAGE_LABELS = [
  'Social Circle',
  'Get Exam Tips',
  'Share Tips',
  'Final Exam',
] as const;

export interface PropItem {
  type: PropType;
  count: number;
}

export interface PropSpawn {
  id: string;
  type: 'speed' | 'heal';
  position: { x: number; z: number };
  active: boolean;
}

export interface MysteryBox {
  id: string;
  position: { x: number; z: number };
  spawnedAt: number;
  activeAt: number;
  triggered: boolean;
  collected: boolean;
}

export interface BuildingState {
  id: number;
  position: { x: number; z: number };
  hasTip: boolean;
  tipIndex: 0 | 1;
  glowing: boolean;
  zoneHealth: number;
  zoneActive: boolean;
  tipObtained: boolean;
  tipObtainedCount: number;
}

export interface ExamState {
  questionNum: number;
  category: 'Final';
  timeRemaining: number;
  layer1ConnId: string;
  layer2ConnIds: string[];
  answered: boolean;
  layer1Dead: boolean;
  anyAnswerSubmitted: boolean;
  hostDisplayLayer?: 'none' | '1' | '2';
  /** One random non-bot chick gets PW layer on white bg on phone; host showing a layer disables it. */
  examWhiteBgConnId?: string | null;
  /** Track which chicks have submitted answers (for early advance) */
  submittedConnIds?: string[];
  /** Total wrong attempts across all submitters (max 3) */
  wrongCount?: number;
}

export type EventType = 'mock-exam' | 'hitbox' | 'crossy-road';

export interface CrossyLane {
  id: number;
  direction: 'left' | 'right';
  speed: number;
  obstacles: { x: number; width: number }[];
}

export interface CrossyPlayerState {
  laneIndex: number;   // 0=start zone, 5=finish zone
  xPosition: number;
  crossings: number;
  hitCount: number;
}

export interface GameEvent {
  type: EventType;
  phase: 'countdown' | 'active' | 'result';
  startedAt: number;
  endAt: number;
  // Mock exam
  questionNum?: number;
  mockExamSubmitted?: Record<string, true>;
  // Hitbox challenge
  chickClicks: Record<string, number>;
  eagleClicks: Record<string, number>;
  result: 'chick' | 'eagle' | 'pending';
  // Crossy Road
  crossyLanes?: CrossyLane[];
  crossyPlayerStates?: Record<string, CrossyPlayerState>;
  eagleSpeedBoost?: number;
}

export interface PlayerGameState {
  connId: string;
  colorIndex: number;
  chickColor: ChickColor;
  isEagle: boolean;
  health: number;
  alive: boolean;
  isStarStudent: boolean;
  tips: [boolean, boolean];
  props: PropItem[];
  position: { x: number; z: number };
  facingAngle: number;
  frozen: boolean;
  frozenUntil: number;
  attackCooldownUntil: number;
  socialCircleMet: Set<string>;
  invincibleUntil: number;
  actionScore: number;
  survivalTime: number;
  damageTaken: number;
  damageDealt: number;
  speedMultiplier: number;
  speedMultiplierUntil: number;
  flyCooldownUntil: number;
  // Animation state
  isMoving: boolean;
  isAttacking: boolean;
  attackAnimUntil: number;
  // Tips
  tipShareCooldownUntil: number;
  // Teleport
  teleportPending: boolean;
  teleportTarget: { x: number; z: number };
  // Cage
  cagedUntil: number;
  cageCooldownUntil: number;
}

export interface PlayerGameStateSerializable {
  connId: string;
  colorIndex: number;
  chickColor: ChickColor;
  isEagle: boolean;
  health: number;
  alive: boolean;
  isStarStudent: boolean;
  tips: [boolean, boolean];
  props: PropItem[];
  position: { x: number; z: number };
  facingAngle: number;
  frozen: boolean;
  frozenUntil: number;
  attackCooldownUntil: number;
  socialCircleMet: string[];
  invincibleUntil: number;
  actionScore: number;
  survivalTime: number;
  damageTaken: number;
  damageDealt: number;
  speedMultiplier: number;
  speedMultiplierUntil: number;
  flyCooldownUntil: number;
  isMoving: boolean;
  isAttacking: boolean;
  attackAnimUntil: number;
  tipShareCooldownUntil: number;
  teleportPending: boolean;
  teleportTarget: { x: number; z: number };
  cagedUntil: number;
  cageCooldownUntil: number;
  // Host-calculated remaining cooldown ms (no client Date.now() needed)
  attackRemainingMs: number;
  flyRemainingMs: number;
  cageRemainingMs: number;
}

export interface GameStateSnapshot {
  phase: GamePhase;
  stage: GameStage;
  gameTime: number;
  countdownTime: number;
  eagleAwake: boolean;
  players: Record<string, PlayerGameStateSerializable>;
  frozenAll: boolean;
  frozenAllUntil: number;
  videoPlaying: 'hurt' | 'dead' | null;
  propSpawns: PropSpawn[];
  buildings: BuildingState[];
  winner: 'eagle' | 'chicks' | 'draw' | null;
  stageLabel: string;
  examState: ExamState | null;
  mysteryBoxes: MysteryBox[];
  activeEvent: GameEvent | null;
  tipObtainTimers?: Record<string, { buildingId: number; remainingMs: number }>;
  stageTransitionUntil: number;
  activeTipShareConnIds: string[];
  totalPauseMs: number;
}

// Messages host → client
export type HostMessage =
  | { type: 'game-start'; assignments: Record<string, { colorIndex: number; isEagle: boolean; chickColor: ChickColor }> }
  | { type: 'game-state'; state: GameStateSnapshot }
  | { type: 'phase-change'; phase: GamePhase }
  | { type: 'game-over'; winner: 'eagle' | 'chicks' | 'draw' }
  | { type: 'color-update'; colorIndex: number; isEagle?: boolean }
  | { type: 'you-died'; connId: string }
  | { type: 'game-mode'; gameMode: GameMode }
  | { type: 'tip-qr'; forConnId: string; code: string; tipIndex: 0 | 1 }
  | { type: 'tip-reject'; forConnId: string; reason: 'too-far' }
  | {
      type: 'exam-start';
      assignments: Record<string, { layer: '1' | '2'; questionNum: number; category: 'Final' }>;
      examWhiteBgConnId?: string | null;
    }
  | { type: 'lobby-prop-granted'; colorIndex: number; propType: 'speed' | 'heal' }
  | { type: 'exam-wrong'; attemptsLeft: number };

// Messages client → host
export type ClientMessage =
  | { type: 'attack-press' }
  | { type: 'prop-use'; propType: PropType }
  | { type: 'color-swap'; requestedColor: number }
  | { type: 'hitbox-click' }
  | { type: 'scan-result'; data: string }
  | { type: 'answer-submit'; answer: string }
  | { type: 'tip-request'; tipIndex: 0 | 1 }
  | { type: 'event-hitbox-click' }
  | { type: 'event-answer'; answer: string }
  | { type: 'crossy-hop'; direction: 'up' | 'down' }
  | { type: 'crossy-eagle-action'; action: 'speed-up' | 'add-obstacle' }
  | { type: 'teleport-set'; x: number; z: number }
  | { type: 'teleport-confirm' };

export function serializePlayerState(p: PlayerGameState, now?: number): PlayerGameStateSerializable {
  const t = now ?? Date.now();
  return {
    ...p,
    socialCircleMet: Array.from(p.socialCircleMet),
    attackRemainingMs: Math.max(0, p.attackCooldownUntil - t),
    flyRemainingMs: Math.max(0, p.flyCooldownUntil - t),
    cageRemainingMs: Math.max(0, p.cageCooldownUntil - t),
  };
}
