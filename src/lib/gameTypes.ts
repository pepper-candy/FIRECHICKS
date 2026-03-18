import type { ChickColor } from '@/components/CharacterViewer';

export type GameMode = '1v3' | '2v6';
export type GamePhase = 'lobby' | 'reveal' | 'countdown' | 'playing' | 'exam' | 'gameover';
export type GameStage = 0 | 1 | 2 | 3; // social circle, exam tips, share tips, final exam
export type PropType = 'speed' | 'heal' | 'fly' | 'invincible';
export type AnimState = 'Idle' | 'Walking' | 'Running' | 'Victory' | 'Attack';

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

export interface BuildingState {
  id: number;
  position: { x: number; z: number };
  hasTip: boolean;           // T1 or T2
  tipIndex: 0 | 1;           // which tip
  glowing: boolean;
  zoneHealth: number;        // 50 max
  zoneActive: boolean;
  tipObtained: boolean;
  tipObtainedCount: number;  // for 2v6 needs 2
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
  socialCircleMet: Set<string>;   // connIds of chicks met
  invincibleUntil: number;
  actionScore: number;
  survivalTime: number;
  damageTaken: number;
  damageDealt: number;
  speedMultiplier: number;
  speedMultiplierUntil: number;
}

// Serializable version for broadcast
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
  speedMultiplier: number;
  speedMultiplierUntil: number;
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
  winner: 'eagle' | 'chicks' | null;
  stageLabel: string;
}

// Messages host → client
export type HostMessage =
  | { type: 'game-start'; assignments: Record<string, { colorIndex: number; isEagle: boolean; chickColor: ChickColor }> }
  | { type: 'game-state'; state: GameStateSnapshot }
  | { type: 'video-play'; video: 'hurt' | 'dead' }
  | { type: 'phase-change'; phase: GamePhase }
  | { type: 'game-over'; winner: 'eagle' | 'chicks' }
  | { type: 'color-update'; colorIndex: number }
  | { type: 'social-circle-update'; met: string[] }
  | { type: 'tip-received'; tipIndex: number }
  | { type: 'you-died' }
  | { type: 'exam-start'; layer: string; questionNum: number; category: string };

// Messages client → host
export type ClientMessage =
  | { type: 'attack-press' }
  | { type: 'prop-use'; propType: PropType }
  | { type: 'color-swap'; requestedColor: number }
  | { type: 'hitbox-click' }
  | { type: 'scan-result'; data: string }
  | { type: 'answer-submit'; answer: string }
  | { type: 'tip-share'; tipIndex: number };

export function serializePlayerState(p: PlayerGameState): PlayerGameStateSerializable {
  return {
    ...p,
    socialCircleMet: Array.from(p.socialCircleMet),
  };
}
