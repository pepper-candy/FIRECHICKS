import { useRef, useCallback, useEffect, useState } from "react";
import type {
  GamePhase,
  GameStage,
  GameStateSnapshot,
  ExamState,
  MysteryBox,
  GameEvent,
  PlayerGameState,
  PlayerGameStateSerializable,
  PropSpawn,
  BuildingState,
  ClientMessage,
  HostMessage,
  PropType,
  ReplayFrame,
  ReplayData,
  ReplayCountdownState,
} from "@/lib/gameTypes";
import { serializePlayerState } from "@/lib/gameTypes";
import { PLAYER_COLORS, EAGLE_COLOR_INDICES } from "@/lib/playerColors";
import { STARTING_HEALTH, applyDamage, applyHeal, isDead, addSubGrades } from "@/lib/gradeSystem";
import {
  BUILDINGS,
  EAGLE_SPAWN_CANDIDATES,
  DIAGONAL_PAIRS,
  resolvePosition,
  pushOutOfWall,
  checkOverlap,
  isInProtectedZone,
  getAdjacentBuilding,
  checkCollision,
  ATTACK_OVERLAP_THRESHOLD,
  SOCIAL_CIRCLE_THRESHOLD,
  PROP_PICKUP_RADIUS,
  MAP_HALF,
  TIP_SHARE_RADIUS,
  SPAWN_POINTS,
  setActiveMap,
} from "@/lib/gameplayMapData";
import { getMapVariant } from "@/lib/mapVariants";
import type { PlayerState, ConnectionMode } from "@/hooks/useGameRoom";
import type { ChickColor } from "@/components/CharacterViewer";
import { updateBot, isBot } from "@/lib/botAI";
import { gameLogger } from "@/lib/gameLogger";
import type { OverlayVideo } from "@/lib/stageInfo";
import { STAGE_TRANSITION_TOTAL_MS } from "@/lib/stageInfo";

// ─── Constants ────────────────────────────────────────────────────────────────
const SPEED = 10;
const EAGLE_SPEED = 10;
const ATTACK_COOLDOWN = 3000;
const FREEZE_DURATION = 3000;
/** After Hurt/Dead combat video ends or is skipped — overlap no longer double-taps. */
const POST_HIT_VIDEO_CHICK_INVINC_MS = 500;
/** Applied immediately on eagle hit — covers overlap during splash + bot spam. */
const POST_HIT_IMMEDIATE_CHICK_INVINC_MS = 2500;
const EAGLE_AWAKE_DELAY = 5000;
const SPEED_BOOST_DURATION = 2000;
const SPEED_BOOST_MULTIPLIER = 2;
const FLY_SPEED_MULTIPLIER = 3;
const FLY_DURATION = 3000;
const FLY_COOLDOWN = 10000;
const ATTACK_ANIM_DURATION = 1000;
const PROP_SPAWN_INTERVAL_MIN = 10000;
const PROP_SPAWN_INTERVAL_MAX = 12000;
const PROP_SPAWN_INTERVAL_HEAL = 30000;
const TIP_OBTAIN_DURATION = 7000; // 7 sec in protected zone to become star student
const TIP_QR_COOLDOWN = 5000; // 5 sec before tip QR can regenerate
const EXAM_TIMER_1V3 = 45;
const EXAM_TIMER_2V6 = 60;
const EXAM_VOTING_DURATION = 10000; // 10 seconds
const MYSTERY_BOX_INTERVAL = 30000; // every 60 sec
const MYSTERY_BOX_ACTIVE_MIN = 5000;
const MYSTERY_BOX_ACTIVE_MAX = 8000;
const EVENT_HITBOX_DURATION = 30000; // 30s hitbox challenge
const EVENT_MOCK_DURATION = 30000; // 30s mock exam
const EVENT_CROSSY_DURATION = 30000; // 30s crossy road
const CROSSY_FIELD_WIDTH = 100;
const STAR_STUDENT_GRADE_BONUS = 5;
const REVEAL_DURATION = 7000;
const COUNTDOWN_DURATION = 7;
const CAGE_COOLDOWN = 30000;
const CAGE_LOCK_DURATION = 10000;
const CAGE_POST_INVINCIBLE = 3000;
const REPLAY_COUNTDOWN_DURATION = 3000;
const GAME_END_TRANSITION_DURATION = 15000;
const POSITION_HISTORY_MAX = 300; // ~5s at 60fps
// Sus detection system (4 levels)
const SUS_PLAYER_WARN_DELAY = 3000; // 3s before showing "Are you still there?"
const SUS_PLAYER_DISCONNECT_DELAY = 15000; // 15s total before auto-disconnect
const PING_PONG_CHECK_INTERVAL = 5000; // Check ping every 5s
const PING_PONG_FAIL_THRESHOLD = 2; // 2 consecutive fails triggers warning
const PING_PONG_WARNING_DURATION = 10000; // 10s to respond to ping
const ACTIVITY_CHECK_INTERVAL = 20000; // Check activity every 20s
const ACTIVITY_INACTIVITY_TIMEOUT = 20000; // 20s without movement/props triggers warning
const ACTIVITY_WARNING_DURATION = 20000; // 20s to show activity

// Answer keys
const FINAL_ANSWER_KEY: Record<number, string> = {
  1: "A+",
  2: "4.3",
  3: "FIRE",
  4: "RED",
};
const MOCK_ANSWER_KEY: Record<number, string> = {
  1: "UST",
  2: "11M",
  3: "BIRD",
  4: "HALL",
};

function normalizeMockExamAnswer(answer: string): string {
  return answer.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface BuildingTimer {
  buildingId: number;
  startTime: number;
}

interface EagleZoneState {
  buildingId: number;
  entryHealth: number;
}

interface SusPlayer {
  connId: string;
  status: 'active' | 'sus' | 'checked';
  detectedAt: number;
  promptShownAt: number | null;
  // Level 1: Proper quit
  properQuit: boolean;
  // Level 2: Page reload/close (detected via disconnect)
  disconnectReason: 'proper-quit' | 'page-close' | 'ping-fail' | 'inactive' | null;
  // Level 3: Ping pong tracking
  pingFailCount: number;
  lastPingAt: number;
  pingWarningShownAt: number | null;
  // Level 4: Activity tracking
  lastActivityAt: number;
  lastPosition: { x: number; z: number };
  activityWarningShownAt: number | null;
}

interface UseGameLogicProps {
  players: Map<string, PlayerState>;
  broadcast: (msg: any) => void;
  gameMode: "1v3" | "2v6";
  connectionMode: ConnectionMode;
  replacePlayerWithBot?: (connId: string, botConnId: string, colorIndex: number) => void;
  mapId?: import('@/lib/mapVariants').MapId;
  devMode?: boolean;
}

interface TipShare {
  connId: string;
  tipIndex: 0 | 1;
  code: string;
  cooldownUntil: number;
  expiresAt: number;
}

// Named type for the full game state reference — avoids TypeScript `unknown` inference issues
interface GameStateRef {
  phase: GamePhase;
  stage: GameStage;
  gameTime: number;
  countdownTime: number;
  eagleAwake: boolean;
  playerStates: Map<string, PlayerGameState>;
  frozenAll: boolean;
  frozenAllUntil: number;
  pendingEagleFreezeAfterVideo: boolean;
  pendingExamEndAfterVideo: boolean;
  pendingExamWinner: "eagle" | "chicks" | "draw" | null;
  examTransitionEndsAt: number;
  videoPlaying: OverlayVideo | null;
  propSpawns: PropSpawn[];
  buildings: BuildingState[];
  winner: "eagle" | "chicks" | "draw" | null;
  lastPropSpawnSpeed: number;
  lastPropSpawnHeal: number;
  propIdCounter: number;
  startTime: number;
  stageLabel: string;
  examState: ExamState | null;
  examStarted: boolean;
  mysteryBoxes: MysteryBox[];
  lastMysteryBoxSpawn: number;
  mysteryBoxIdCounter: number;
  tipShareIdCounter: number;
  buildingTimers: Map<string, BuildingTimer>;
  eagleZoneStates: Map<string, EagleZoneState>;
  activeEvent: GameEvent | null;
  eventCountdown: number;
  stageTransitionUntil: number;
  totalPauseMs: number;
  stageTransitionPauseApplied: boolean;
  replayCountdown: ReplayCountdownState | null;
  activeTipShares: Map<string, TipShare>;
  gameResultsFinalized: boolean;
}

// Circular buffer for position recording
interface PositionHistoryBuffer {
  frames: ReplayFrame[];
  writeIndex: number;
  count: number;
}

function isBotConnId(connId: string): boolean {
  return connId.startsWith("bot-");
}

function createSusPlayer(connId: string, now: number, position: { x: number; z: number }): SusPlayer {
  return {
    connId,
    status: 'active',
    detectedAt: 0,
    promptShownAt: null,
    properQuit: false,
    disconnectReason: null,
    pingFailCount: 0,
    lastPingAt: now,
    pingWarningShownAt: null,
    lastActivityAt: now,
    lastPosition: { ...position },
    activityWarningShownAt: null,
  };
}

function clearSusWarning(
  sus: SusPlayer,
  now: number,
  options?: {
    position?: { x: number; z: number };
    resetActivity?: boolean;
  },
) {
  sus.status = 'active';
  sus.detectedAt = 0;
  sus.promptShownAt = null;
  sus.properQuit = false;
  sus.disconnectReason = null;
  sus.pingFailCount = 0;
  sus.pingWarningShownAt = null;
  sus.activityWarningShownAt = null;
  if (options?.resetActivity) {
    sus.lastActivityAt = now;
  }
  if (options?.position) {
    sus.lastPosition = { ...options.position };
  }
}

function addBreakdown(p: PlayerGameState, key: string, label: string, points: number, countDelta: number = 1) {
  if (!p.scoreBreakdown) p.scoreBreakdown = {};
  const entry = p.scoreBreakdown[key];
  if (entry) {
    entry.points += points;
    entry.count += countDelta;
  } else {
    p.scoreBreakdown[key] = { label, points, count: countDelta };
  }
  p.actionScore += points;
}

function finalizeGameResults(gs: GameStateRef) {
  if (gs.gameResultsFinalized) return;

  // Lock transcript scoring before the exam-to-gameover loading screen ends so
  // the last exam snapshot already matches the eventual game-over transcript.
  const nonPausedTime = Math.max(0, gs.gameTime - gs.totalPauseMs / 1000);
  for (const [, p] of gs.playerStates) {
    if (!p.isEagle) {
      const survivalBonus = Math.floor(nonPausedTime / 10);
      if (survivalBonus > 0) {
        addBreakdown(p, 'survival', 'Survival time', survivalBonus, Math.floor(nonPausedTime));
      }
    }
  }

  gs.gameResultsFinalized = true;
}

function setVotingDeadline(gs: GameStateRef, voteUntil: number) {
  for (const [, p] of gs.playerStates) {
    p.voteUntil = voteUntil;
  }
}

function resetSusActivityTimers(gs: GameStateRef, now: number, susPlayers: Map<string, SusPlayer>) {
  for (const [connId, sus] of susPlayers) {
    const player = gs.playerStates.get(connId);
    if (!player || !player.alive || isBotConnId(connId)) continue;
    sus.lastActivityAt = now;
    sus.lastPosition = { ...player.position };
  }
}

function updateHostExamDisplay(gs: GameStateRef) {
  const exam = gs.examState;
  if (!exam) return;

  const layer1 = gs.playerStates.get(exam.layer1ConnId);
  const layer1Alive = !!layer1?.alive;
  const layer1NonBotAlive = layer1Alive && !isBotConnId(exam.layer1ConnId);

  const aliveLayer2Count = exam.layer2ConnIds.filter((id) => gs.playerStates.get(id)?.alive).length;
  const layer2NonBotAlive = exam.layer2ConnIds.some(
    (id) => !isBotConnId(id) && gs.playerStates.get(id)?.alive,
  );

  const soloExam = exam.layer2ConnIds.length === 0;
  if (soloExam) {
    exam.hostDisplayLayer = layer1Alive ? "1" : "none";
    return;
  }

  // Non-bot humans alive: help the missing side on the host TV.
  if (layer1NonBotAlive && !layer2NonBotAlive) {
    exam.hostDisplayLayer = "2";
  } else if (layer2NonBotAlive && !layer1NonBotAlive) {
    exam.hostDisplayLayer = "1";
  } else if (!layer1Alive) {
    exam.hostDisplayLayer = "1";
  } else if (aliveLayer2Count === 0) {
    exam.hostDisplayLayer = "2";
  } else {
    exam.hostDisplayLayer = "none";
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useGameLogic({
  players,
  broadcast,
  gameMode,
  connectionMode,
  replacePlayerWithBot,
  mapId = 1,
  devMode = false,
}: UseGameLogicProps) {
  const devModeRef = useRef(devMode);
  useEffect(() => { devModeRef.current = devMode; }, [devMode]);
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [assignments, setAssignments] = useState<
    Record<string, { colorIndex: number; isEagle: boolean; chickColor: ChickColor }>
  >({});

  const playersRef = useRef<Map<string, PlayerState>>(players);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const broadcastRef = useRef(broadcast);
  useEffect(() => {
    broadcastRef.current = broadcast;
  }, [broadcast]);

  const gameModeRef = useRef(gameMode);
  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  const connectionModeRef = useRef(connectionMode);
  useEffect(() => {
    connectionModeRef.current = connectionMode;
  }, [connectionMode]);
  const replacePlayerWithBotRef = useRef(replacePlayerWithBot);
  useEffect(() => {
    replacePlayerWithBotRef.current = replacePlayerWithBot;
  }, [replacePlayerWithBot]);
  const mapIdRef = useRef(mapId);
  useEffect(() => { mapIdRef.current = mapId; }, [mapId]);

  const lastNetworkStateBroadcastAtRef = useRef(0);

  const gameStateRef = useRef<GameStateRef | null>(null);
  const gamePausedRef = useRef(false);
  const botsPausedRef = useRef(false);
  // Sus players tracking: connId -> { detectedAt, promptShownAt, ...}
  const susPlayersRef = useRef<Map<string, SusPlayer>>(new Map());
  const lastPingCheckRef = useRef(0);

  const [snapshot, setSnapshot] = useState<GameStateSnapshot | null>(null);
  const [videoPlaying, setVideoPlaying] = useState<OverlayVideo | null>(null);
  const frameRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const positionHistoryRef = useRef<PositionHistoryBuffer>({
    frames: new Array(POSITION_HISTORY_MAX),
    writeIndex: 0,
    count: 0,
  });
  const handleClientMessageRef = useRef<((connId: string, msg: any) => void) | null>(null);
  // Used by the host to drag/teleport players by their name tags.
  const hostDragBackupRef = useRef<
    Map<string, { position: { x: number; z: number }; frozen: boolean; frozenUntil: number }>
  >(new Map());

  function replaceSusPlayerWithBot(
    gs: GameStateRef,
    connId: string,
    currentPlayers: Map<string, PlayerState>,
    currentBroadcast: (msg: HostMessage) => void,
  ) {
    const player = gs.playerStates.get(connId);
    if (!player || isBotConnId(connId)) return null;

    const botConnId = `bot-${connId}`;
    if (gs.playerStates.has(botConnId)) return botConnId;

    const botPlayer: PlayerGameState = {
      ...player,
      connId: botConnId,
    };

    gs.playerStates.delete(connId);
    gs.playerStates.set(botConnId, botPlayer);

    if (gs.examState) {
      if (gs.examState.layer1ConnId === connId) {
        gs.examState.layer1ConnId = botConnId;
      }
      gs.examState.layer2ConnIds = gs.examState.layer2ConnIds.map((id) => (id === connId ? botConnId : id));
      if (gs.examState.examWhiteBgConnId === connId) {
        gs.examState.examWhiteBgConnId = null;
      }
      if (gs.examState.examSubmitterId === connId) {
        gs.examState.votingState = undefined;
        gs.examState.finalAnswer = undefined;
        gs.examState.anyAnswerSubmitted = false;
        setVotingDeadline(gs, 0);
        const nextSubmitterId = reassignExamSubmitter(gs, currentPlayers, currentBroadcast);
        currentBroadcast({
          type: "exam-voting-end",
          allowResubmit: Boolean(nextSubmitterId),
          submitterConnId: nextSubmitterId ?? undefined,
        });
      }
    }

    const oldBuildingTimerKey = `${connId}-building`;
    const botBuildingTimerKey = `${botConnId}-building`;
    if (gs.buildingTimers.has(oldBuildingTimerKey)) {
      const timer = gs.buildingTimers.get(oldBuildingTimerKey)!;
      gs.buildingTimers.delete(oldBuildingTimerKey);
      gs.buildingTimers.set(botBuildingTimerKey, timer);
    }

    const eagleZoneState = gs.eagleZoneStates.get(connId);
    if (eagleZoneState) {
      gs.eagleZoneStates.delete(connId);
      gs.eagleZoneStates.set(botConnId, eagleZoneState);
    }

    for (const [key, tipShare] of gs.activeTipShares.entries()) {
      if (tipShare.connId !== connId) continue;
      gs.activeTipShares.delete(key);
      gs.activeTipShares.set(`${botConnId}-${tipShare.tipIndex}`, {
        ...tipShare,
        connId: botConnId,
      });
    }

    const priorTransportPlayer = currentPlayers.get(connId);
    currentPlayers.delete(connId);
    currentPlayers.set(botConnId, {
      joystick: { x: 0, y: 0 },
      colorIndex: player.colorIndex,
      ping: priorTransportPlayer?.ping ?? 0,
      lastPongAt: Date.now(),
      isBot: true,
    });

    replacePlayerWithBotRef.current?.(connId, botConnId, player.colorIndex);
    susPlayersRef.current.delete(connId);
    updateHostExamDisplay(gs);
    doBroadcastState(gs, currentBroadcast);

    return botConnId;
  }

  // ─── Start Game ──────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    // Activate selected map variant for collision/spawn data
    const mv = getMapVariant(mapIdRef.current);
    setActiveMap(mv.buildings, mv.obstacles, mv.spawnPoints, mv.eagleSpawnCandidates);

    const currentPlayers = playersRef.current as Map<string, PlayerState>;
    const playerIds: string[] = Array.from(currentPlayers.keys());
    if (playerIds.length === 0) return;

    const currentMode = gameModeRef.current as "1v3" | "2v6";
    const assigns: Record<string, { colorIndex: number; isEagle: boolean; chickColor: ChickColor }> = {};

    if (currentMode === "1v3") {
      // Randomly assign 1 eagle from 4 players, random eagle color (Black or Gold, no repeat)
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
      const eagleId = shuffled[0];
      const eagleColorIdx = EAGLE_COLOR_INDICES[Math.floor(Math.random() * EAGLE_COLOR_INDICES.length)];
      const usedChickColors = new Set<number>();

      for (const id of playerIds) {
        if (id === eagleId) {
          assigns[id] = {
            colorIndex: eagleColorIdx,
            isEagle: true,
            chickColor: PLAYER_COLORS[eagleColorIdx].chickColor,
          };
        } else {
          const pickedColor = currentPlayers.get(id)?.colorIndex ?? 2;
          let ci = EAGLE_COLOR_INDICES.includes(pickedColor) ? 2 : pickedColor;
          if (usedChickColors.has(ci)) {
            for (let idx = 0; idx < PLAYER_COLORS.length; idx++) {
              if (EAGLE_COLOR_INDICES.includes(idx)) continue;
              if (usedChickColors.has(idx)) continue;
              ci = idx;
              break;
            }
          }
          usedChickColors.add(ci);
          assigns[id] = { colorIndex: ci, isEagle: false, chickColor: PLAYER_COLORS[ci].chickColor };
        }
      }
    } else {
      // 2v6: color already chosen (Black/Gold = eagle)
      for (const id of playerIds) {
        const ci = currentPlayers.get(id)?.colorIndex ?? 2;
        const isEagle = EAGLE_COLOR_INDICES.includes(ci);
        assigns[id] = { colorIndex: ci, isEagle, chickColor: PLAYER_COLORS[ci].chickColor };
      }
    }

    setAssignments(assigns);

    const totalRevealAndCountdown = REVEAL_DURATION + COUNTDOWN_DURATION * 1000;
    const playerStates = new Map<string, PlayerGameState>();
    const eagleSpawn = EAGLE_SPAWN_CANDIDATES[Math.floor(Math.random() * EAGLE_SPAWN_CANDIDATES.length)];
    const chosenSpawnPositions: Array<{ x: number; z: number }> = [];

    const getRandomChickSpawn = (): { x: number; z: number } => {
      // Spawn randomly near any of the 4 buildings.
      // We bias toward the "inner" side of each building (toward map center), then add jitter.
      for (let attempt = 0; attempt < 25; attempt++) {
        const b = BUILDINGS[Math.floor(Math.random() * BUILDINGS.length)];
        const dirX = -Math.sign(b.position.x) || 1;
        const dirZ = -Math.sign(b.position.z) || 1;

        const innerDist = 4 + (Math.random() - 0.5) * 1.8; // around building inner edge
        const jitter = 2.2;
        const x = b.position.x + dirX * innerDist + (Math.random() - 0.5) * jitter;
        const z = b.position.z + dirZ * innerDist + (Math.random() - 0.5) * jitter;

        // Avoid collisions with buildings/obstacles.
        if (checkCollision(x, z, 0.6)) continue;
        // Avoid stacking multiple chicks too tightly.
        if (chosenSpawnPositions.some((p) => checkOverlap(p.x, p.z, x, z, 2.0))) continue;
        return { x, z };
      }

      // Fallback: pick any open-ish position around the first building inner edge.
      const b0 = BUILDINGS[0];
      const dirX = -Math.sign(b0.position.x) || 1;
      const dirZ = -Math.sign(b0.position.z) || 1;
      return { x: b0.position.x + dirX * 4, z: b0.position.z + dirZ * 4 };
    };

    for (const [id, assign] of Object.entries(assigns)) {
      const spawn = assign.isEagle ? eagleSpawn : getRandomChickSpawn();
      chosenSpawnPositions.push(spawn);
      playerStates.set(id, {
        connId: id,
        colorIndex: assign.colorIndex,
        chickColor: assign.chickColor,
        isEagle: assign.isEagle,
        health: STARTING_HEALTH,
        alive: true,
        isStarStudent: false,
        tips: [false, false],
        props: assign.isEagle
          ? [{ type: "fly", count: 3 }, { type: "cage", count: 99 }]
          : [{ type: "speed", count: 2 }, { type: "teleport", count: 1 }],
        position: { ...spawn },
        facingAngle: 0,
        frozen: assign.isEagle,
        frozenUntil: assign.isEagle ? Date.now() + totalRevealAndCountdown + EAGLE_AWAKE_DELAY : 0,
        attackCooldownUntil: 0,
        socialCircleMet: new Set(),
        invincibleUntil: 0,
        actionScore: 0,
        survivalTime: 0,
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
        teleportTarget: { x: spawn.x, z: spawn.z },
        cagedUntil: 0,
        cageCooldownUntil: assign.isEagle ? Date.now() + totalRevealAndCountdown + EAGLE_AWAKE_DELAY + CAGE_COOLDOWN : 0,
        voteUntil: 0,
        scoreBreakdown: {},
        scansPerformed: 0,
        timeInZones: 0,
        tipsShared: 0,
        socialCircleCompleted: false,
      });
    }

    const diagPair = DIAGONAL_PAIRS[Math.floor(Math.random() * DIAGONAL_PAIRS.length)];
    const buildings: BuildingState[] = BUILDINGS.map((b) => ({
      id: b.id,
      position: b.position,
      hasTip: diagPair.includes(b.id),
      tipIndex: b.id === diagPair[0] ? 0 : b.id === diagPair[1] ? 1 : 0,
      glowing: false,
      zoneHealth: 50,
      zoneActive: false,
      tipObtained: false,
      tipObtainedCount: 0,
    }));

    gameStateRef.current = {
      phase: "reveal",
      stage: 0,
      gameTime: 0,
      countdownTime: COUNTDOWN_DURATION,
      eagleAwake: false,
      playerStates,
      frozenAll: false,
      frozenAllUntil: 0,
      pendingEagleFreezeAfterVideo: false,
      pendingExamEndAfterVideo: false,
      pendingExamWinner: null,
      examTransitionEndsAt: 0,
      videoPlaying: null,
      propSpawns: [],
      buildings,
      winner: null,
      lastPropSpawnSpeed: 0,
      lastPropSpawnHeal: 0,
      propIdCounter: 0,
      startTime: 0,
      stageLabel: "Roles assigned! Get ready...",
      examState: null,
      examStarted: false,
      mysteryBoxes: [],
      lastMysteryBoxSpawn: 0,
      mysteryBoxIdCounter: 0,
      tipShareIdCounter: 0,
      activeTipShares: new Map(),
      buildingTimers: new Map(),
      eagleZoneStates: new Map(),
      activeEvent: null,
      eventCountdown: 0,
      stageTransitionUntil: 0,
      totalPauseMs: 0,
      stageTransitionPauseApplied: false,
      replayCountdown: null,
      gameResultsFinalized: false,
    };

    if (devModeRef.current) {
      // Dev mode: skip reveal, go straight to countdown then playing
      gameStateRef.current.phase = "countdown";
      gameStateRef.current.countdownTime = 0;
      gameStateRef.current.startTime = Date.now();
      setPhase("playing");
      gameStateRef.current.phase = "playing";
      broadcastRef.current({ type: "game-start", assignments: assigns });
      (broadcastRef.current as (msg: any) => void)({ type: "phase-change", phase: "countdown" });
      (broadcastRef.current as (msg: any) => void)({ type: "phase-change", phase: "playing" });

      lastTickRef.current = performance.now();
      const tick = (time: number) => {
        const delta = (time - lastTickRef.current) / 1000;
        lastTickRef.current = time;
        updateGameState(delta);
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    } else {
      setPhase("reveal");
      broadcastRef.current({ type: "game-start", assignments: assigns });

      setTimeout(() => {
        const gsInner = gameStateRef.current as GameStateRef | null;
        if (!gsInner) return;
        gsInner.phase = "countdown";
        gsInner.countdownTime = COUNTDOWN_DURATION;
        gsInner.startTime = Date.now();
        setPhase("countdown");
        (broadcastRef.current as (msg: any) => void)({ type: "phase-change", phase: "countdown" });

        lastTickRef.current = performance.now();
        const tick = (time: number) => {
          const delta = (time - lastTickRef.current) / 1000;
          lastTickRef.current = time;
          updateGameState(delta);
          frameRef.current = requestAnimationFrame(tick);
        };
        frameRef.current = requestAnimationFrame(tick);
      }, REVEAL_DURATION);
    }
  }, []);

  // ─── Main Game Loop ───────────────────────────────────────────────────────────
  const updateGameState = useCallback((delta: number) => {
    const gs = gameStateRef.current as GameStateRef | null;
    if (!gs || gs.winner) return;
    if (gamePausedRef.current) {
      // Still broadcast state so clients see the frozen game
      doBroadcastState(gs, broadcastRef.current as (msg: any) => void);
      return;
    }

    const now = Date.now();
    const currentPlayers = playersRef.current as Map<string, PlayerState>;
    const currentBroadcast = broadcastRef.current as (msg: any) => void;
    const currentMode = gameModeRef.current as "1v3" | "2v6";

    if (gs.examTransitionEndsAt > 0) {
      if (now >= gs.examTransitionEndsAt && gs.pendingExamWinner) {
        endGame(gs, gs.pendingExamWinner, currentBroadcast);
        return;
      }
      doBroadcastState(gs, currentBroadcast);
      return;
    }

    // ── Stage transition auto-pause ──
    // During stage transitions, freeze all game logic (like pause) but keep gameTime ticking.
    // Accumulate totalPauseMs so play time can exclude it.
    if (gs.stageTransitionUntil > 0 && now < gs.stageTransitionUntil) {
      // Keep gameTime running (stopwatch doesn't stop)
      if (gs.phase === "playing" || gs.phase === "exam") {
        gs.gameTime += delta;
        gs.totalPauseMs += delta * 1000;
      }
      gs.stageTransitionPauseApplied = false;
      doBroadcastState(gs, currentBroadcast);
      return;
    }
    // When transition just ended, extend all timestamp-based cooldowns
    if (gs.stageTransitionUntil > 0 && now >= gs.stageTransitionUntil && !gs.stageTransitionPauseApplied) {
      gs.stageTransitionPauseApplied = true;
      const pauseDuration = STAGE_TRANSITION_TOTAL_MS; // stage transitions are 15s (12s instruction + 3s ready-up)
      // Extend all player cooldowns & freeze timers
      for (const [, p] of gs.playerStates) {
        if (p.frozenUntil > 0) p.frozenUntil += pauseDuration;
        if (p.attackCooldownUntil > 0) p.attackCooldownUntil += pauseDuration;
        if (p.flyCooldownUntil > 0) p.flyCooldownUntil += pauseDuration;
        if (p.invincibleUntil > 0) p.invincibleUntil += pauseDuration;
        if (p.speedMultiplierUntil > 0) p.speedMultiplierUntil += pauseDuration;
        if (p.tipShareCooldownUntil > 0) p.tipShareCooldownUntil += pauseDuration;
        if (p.cagedUntil > 0) p.cagedUntil += pauseDuration;
        if (p.cageCooldownUntil > 0) p.cageCooldownUntil += pauseDuration;
        if (p.attackAnimUntil > 0) p.attackAnimUntil += pauseDuration;
      }
      // Extend global freeze
      if (gs.frozenAllUntil > 0) gs.frozenAllUntil += pauseDuration;
      // Extend building timers
      for (const [, t] of gs.buildingTimers) {
        t.startTime += pauseDuration; // shift start forward = effectively pause
      }
      // Extend event timings
      if (gs.activeEvent) {
        gs.activeEvent.endAt += pauseDuration;
        gs.activeEvent.startedAt += pauseDuration;
      }
      // Extend prop/mystery spawn timers
      gs.lastPropSpawnSpeed += pauseDuration;
      gs.lastPropSpawnHeal += pauseDuration;
      gs.lastMysteryBoxSpawn += pauseDuration;
      // Extend tip share cooldowns
      for (const [, ts] of gs.activeTipShares) {
        ts.cooldownUntil += pauseDuration;
        ts.expiresAt += pauseDuration;
      }
      gs.stageTransitionUntil = 0; // clear so we don't re-enter
    }

    // ── Countdown ──
    if (gs.phase === "countdown") {
      const elapsed = (now - gs.startTime) / 1000;
      gs.countdownTime = Math.max(0, COUNTDOWN_DURATION - elapsed);
      if (gs.countdownTime <= 0) {
        gs.phase = "playing";
        gs.startTime = now;
        gs.gameTime = 0;
        gs.lastPropSpawnSpeed = now;
        gs.lastPropSpawnHeal = now;
        gs.lastMysteryBoxSpawn = now;
        gs.stageLabel = "Touch every other chick!";
        gs.stageTransitionUntil = devModeRef.current ? 0 : now + STAGE_TRANSITION_TOTAL_MS;
        gs.stageTransitionPauseApplied = false;
        setPhase("playing");
        currentBroadcast({ type: "phase-change", phase: "playing" });
      }
      doBroadcastState(gs, currentBroadcast);
      return;
    }

    if (gs.phase !== "playing" && gs.phase !== "exam") return;

    // ── Sus player detection (4-level system) ──
    const susPlayers = susPlayersRef.current;

    for (const [connId, player] of gs.playerStates) {
      if (!player.alive || isBotConnId(connId)) continue;
      if (!susPlayers.has(connId)) {
        susPlayers.set(connId, createSusPlayer(connId, now, player.position));
      }
    }

    const isMiniGameActive = gs.phase === "playing" && !!gs.activeEvent;
    for (const [connId, sus] of susPlayers) {
      const player = gs.playerStates.get(connId);
      if (!player || !player.alive || isBotConnId(connId)) continue;

      if (sus.properQuit || sus.disconnectReason === "page-close") {
        replaceSusPlayerWithBot(gs, connId, currentPlayers, currentBroadcast);
        continue;
      }

      if (!currentPlayers.has(connId)) {
        sus.disconnectReason = "page-close";
        replaceSusPlayerWithBot(gs, connId, currentPlayers, currentBroadcast);
        continue;
      }

      const movedDistance = Math.hypot(
        player.position.x - sus.lastPosition.x,
        player.position.z - sus.lastPosition.z
      );
      if (movedDistance > 0.1) {
        clearSusWarning(sus, now, {
          position: player.position,
          resetActivity: true,
        });
        sus.lastPingAt = currentPlayers.get(connId)?.lastPongAt ?? sus.lastPingAt;
      }

      if (sus.status === "sus" && sus.promptShownAt) {
        if (isMiniGameActive && sus.disconnectReason === "inactive") {
          continue;
        }
        if (now - sus.promptShownAt >= SUS_PLAYER_DISCONNECT_DELAY) {
          replaceSusPlayerWithBot(gs, connId, currentPlayers, currentBroadcast);
          continue;
        }
      }
    }

    // Track activity (movement + prop usage) for non-bot players
    for (const [connId, player] of gs.playerStates) {
      if (!player.alive || isBotConnId(connId)) continue;
      const sus = susPlayers.get(connId);
      if (!sus) continue;

      const movedDistance = Math.hypot(
        player.position.x - sus.lastPosition.x,
        player.position.z - sus.lastPosition.z
      );

      if (movedDistance > 0.1) {
        sus.lastActivityAt = now;
        sus.lastPosition = { ...player.position };
      }
    }

    if (gs.phase === "playing" && !gs.activeEvent) {
      for (const [connId, sus] of susPlayers) {
        const player = gs.playerStates.get(connId);
        if (!player || !player.alive || isBotConnId(connId)) continue;
        if (sus.status === "sus") continue;
        if (now - sus.lastActivityAt >= ACTIVITY_INACTIVITY_TIMEOUT) {
          sus.status = "sus";
          sus.detectedAt = now;
          sus.promptShownAt = now;
          sus.activityWarningShownAt = now;
          sus.disconnectReason = "inactive";
          currentBroadcast({ type: "player-sus-warning", connId });
        }
      }
    }

    // ── Ping-pong monitoring (check every 5 seconds) ──
    if (now - lastPingCheckRef.current >= PING_PONG_CHECK_INTERVAL) {
      lastPingCheckRef.current = now;
      currentBroadcast({ type: "ping", ts: now });

      for (const [connId, sus] of susPlayers) {
        const player = gs.playerStates.get(connId);
        if (!player || !player.alive || isBotConnId(connId)) continue;
        const transportPlayer = currentPlayers.get(connId);
        const latestPongAt = transportPlayer?.lastPongAt ?? 0;
        if (latestPongAt > sus.lastPingAt) {
          sus.lastPingAt = latestPongAt;
          sus.pingFailCount = 0;
          if (sus.disconnectReason === "ping-fail") {
            clearSusWarning(sus, now, {
              position: player.position,
              resetActivity: false,
            });
          }
          continue;
        }

        sus.pingFailCount += 1;
        if (sus.pingFailCount >= PING_PONG_FAIL_THRESHOLD && sus.status !== "sus") {
          sus.status = "sus";
          sus.detectedAt = now;
          sus.promptShownAt = now;
          sus.pingWarningShownAt = now;
          sus.disconnectReason = "ping-fail";
          currentBroadcast({ type: "player-sus-warning", connId });
        }
      }
    }

    // ── Time ──
    if (!gs.frozenAll) {
      gs.gameTime += delta;
    }

    // ── Unfreeze all ──
    if (gs.frozenAll && now > gs.frozenAllUntil) {
      gs.frozenAll = false;
      gs.videoPlaying = null;
      setVideoPlaying(null);
    }

    // ── Eagle awakening ──
    if (!gs.eagleAwake && gs.gameTime > EAGLE_AWAKE_DELAY / 1000) {
      gs.eagleAwake = true;
      for (const [, p] of gs.playerStates) {
        if (p.isEagle) {
          p.frozen = false;
          p.frozenUntil = 0;
        }
      }
    }

    // ── Player movement ──
    if (!gs.frozenAll) {
      for (const [connId, p] of gs.playerStates) {
        if (!p.alive) continue;
        if (p.frozen && now < p.frozenUntil) continue;
        if (p.frozen && now >= p.frozenUntil) p.frozen = false;

        // Cage unlock check
        if (p.cagedUntil > 0 && now >= p.cagedUntil) {
          p.cagedUntil = 0;
          // Invincible continues for CAGE_POST_INVINCIBLE (already set on cage start)
        }
        // Caged: allow rotation but no movement
        if (p.cagedUntil > 0 && now < p.cagedUntil) {
          const lobbyPlayer = currentPlayers.get(connId);
          if (lobbyPlayer) {
            const jx = lobbyPlayer.joystick.x;
            const jy = -lobbyPlayer.joystick.y;
            const mag = Math.sqrt(jx * jx + jy * jy);
            if (mag > 0.05) p.facingAngle = Math.atan2(-jx, jy);
          }
          p.isMoving = false;
          continue;
        }

        const flyingActive = p.isEagle && p.speedMultiplier >= FLY_SPEED_MULTIPLIER;
        const flyingJustEnded = flyingActive && p.speedMultiplierUntil > 0 && now >= p.speedMultiplierUntil;
        if (flyingJustEnded) {
          // If flight ended while inside obstacles, push eagle out immediately.
          const resolved = pushOutOfWall(p.position.x, p.position.z, 0.5);
          p.position.x = resolved.x;
          p.position.z = resolved.z;
        }
        if (p.speedMultiplier > 1 && now > p.speedMultiplierUntil) p.speedMultiplier = 1;
        if (p.invincibleUntil > 0 && now > p.invincibleUntil) p.invincibleUntil = 0;
        if (p.isAttacking && now > p.attackAnimUntil) p.isAttacking = false;

        // (Fly out-of-wall handled when flight actually ends.)

        const lobbyPlayer = currentPlayers.get(connId);
        if (!lobbyPlayer) continue;

        const isPausedBot = botsPausedRef.current && !!lobbyPlayer.isBot && isBot(connId);
        if (isPausedBot) {
          (lobbyPlayer as any).joystick = { x: 0, y: 0 };
          p.isMoving = false;
          continue;
        }

        const jx = lobbyPlayer.joystick.x;
        const jy = -lobbyPlayer.joystick.y;
        const magnitude = Math.sqrt(jx * jx + jy * jy);
        const isFlyingNow = p.isEagle && p.speedMultiplier >= FLY_SPEED_MULTIPLIER;

        // Teleport targeting mode: joystick moves the target dot, not the player
        if (p.teleportPending && !p.isEagle) {
          p.isMoving = false;
          if (magnitude > 0.05) {
            const moveAngle = Math.atan2(-jx, jy);
            const dotSpeed = SPEED * 4.5 * delta;
            const dx = Math.sin(moveAngle) * dotSpeed * -1;
            const dz = Math.cos(moveAngle) * dotSpeed * -1;
            const newX = p.teleportTarget.x + dx;
            const newZ = p.teleportTarget.z + dz;
            const resolved = resolvePosition(newX, newZ, p.teleportTarget.x, p.teleportTarget.z, 0.5, false);
            p.teleportTarget.x = resolved.x;
            p.teleportTarget.z = resolved.z;
            p.facingAngle = moveAngle;
          }
          continue;
        }

        p.isMoving = magnitude > 0.05 || isFlyingNow;

        if (magnitude > 0.05 || isFlyingNow) {
          // If joystick is idle, flight continues in the last facing direction.
          const moveAngle = magnitude > 0.05 ? Math.atan2(-jx, jy) : p.facingAngle;
          const baseSpeed = p.isEagle ? EAGLE_SPEED : SPEED;
          // Normal movement uses joystick magnitude; flight keeps moving even if joystick is idle.
          const speedFactor = magnitude > 0.05 ? magnitude : isFlyingNow ? 1 : 0;
          const speed = speedFactor * baseSpeed * p.speedMultiplier * delta;

          const dx = Math.sin(moveAngle) * speed * -1;
          const dz = Math.cos(moveAngle) * speed * -1;
          const newX = p.position.x + dx;
          const newZ = p.position.z + dz;

          const isFlying = p.isEagle && p.speedMultiplier >= FLY_SPEED_MULTIPLIER;
          const resolved = resolvePosition(newX, newZ, p.position.x, p.position.z, 0.5, isFlying);
          p.position.x = resolved.x;
          p.position.z = resolved.z;
          p.facingAngle = moveAngle;
          p.survivalTime = gs.gameTime;
        }
      }

      // Track timeInZones for chicks in protected zones
      for (const [, p] of gs.playerStates) {
        if (p.isEagle || !p.alive) continue;
        const inAnyZone = gs.buildings.some(b => b.zoneActive && !b.tipObtained && isInProtectedZone(p.position.x, p.position.z, b.id));
        if (inAnyZone) p.timeInZones += delta;
      }
    }

    // ── Record position history for replay ──
    {
      const buf = positionHistoryRef.current;
      const framePlayers: Record<string, import("@/lib/gameTypes").ReplayFramePlayer> = {};
      for (const [id, p] of gs.playerStates) {
        framePlayers[id] = {
          x: p.position.x,
          z: p.position.z,
          facingAngle: p.facingAngle,
          isMoving: p.isMoving,
          isAttacking: p.isAttacking,
          speedMultiplier: p.speedMultiplier,
          chickColor: p.chickColor,
          colorIndex: p.colorIndex,
          isEagle: p.isEagle,
          alive: p.alive,
        };
      }
      buf.frames[buf.writeIndex] = { time: now, players: framePlayers };
      buf.writeIndex = (buf.writeIndex + 1) % POSITION_HISTORY_MAX;
      if (buf.count < POSITION_HISTORY_MAX) buf.count++;
    }

    // ── Bot AI updates ──
    for (const [connId, p] of gs.playerStates) {
      const lobbyPlayer = currentPlayers.get(connId);
      const activelyBotControlled = !!lobbyPlayer?.isBot;
      if (!activelyBotControlled || !isBot(connId) || !p.alive) continue;
      if (botsPausedRef.current) {
        if (lobbyPlayer) {
          (lobbyPlayer as any).joystick = { x: 0, y: 0 };
        }
        p.isMoving = false;
        continue;
      }
      if (!activelyBotControlled || !isBot(connId) || !p.alive) continue;
      const decision = updateBot(
        p,
        gs.playerStates,
        now,
        gs.stage,
        gs.buildings,
        gs.activeEvent,
        gs.gameTime,
        gs.mysteryBoxes,
        gs.phase === "exam" ? { examMode: true } : undefined,
      );

      // Inject bot joystick into players map so movement code picks it up next frame
      if (lobbyPlayer) {
        // Mutate the map entry joystick (bots don't have real connections)
        (lobbyPlayer as any).joystick = decision.joystick;
      }

      // Process bot messages through handleClientMessage ref
      for (const msg of decision.messages) {
        handleClientMessageRef.current?.(connId, msg);
      }
    }

    // Auto-share tips for nearby chicks — only when at least one party is a bot.
    // Human-to-human tip sharing requires QR scan (scan-result flow).
    if (gs.stage >= 2) {
      const aliveChicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter((p) => !p.isEagle && p.alive);
      for (const sharer of aliveChicks) {
        for (let tipIndex: 0 | 1 = 0; tipIndex <= 1; tipIndex = (tipIndex + 1) as 0 | 1) {
          if (!sharer.tips[tipIndex]) continue;
          if (now < sharer.tipShareCooldownUntil) continue;

          const receiver = aliveChicks.find(
            (c) =>
              c.connId !== sharer.connId &&
              !c.tips[tipIndex] &&
              checkOverlap(sharer.position.x, sharer.position.z, c.position.x, c.position.z, TIP_SHARE_RADIUS),
          );
          if (!receiver) continue;

          // Only auto-share if at least one of sharer/receiver is a bot
          const sharerIsBot = isBotConnId(sharer.connId);
          const receiverIsBot = isBotConnId(receiver.connId);
          if (!sharerIsBot && !receiverIsBot) continue;

          receiver.tips[tipIndex] = true;
          addBreakdown(receiver, 'receive-tip', 'Receive shared tip', 5);
          sharer.tipsShared++;
          sharer.tipShareCooldownUntil = now + TIP_QR_COOLDOWN;
          broadcastRef.current({
            type: "tip-copy-notify",
            connIds: [sharer.connId, receiver.connId],
            tipIndex,
          });
        }
      }
    }

    // ── Stage 0: Social Circle ──
    if (gs.stage === 0) {
      const chicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter((p) => !p.isEagle && p.alive);
      for (let i = 0; i < chicks.length; i++) {
        for (let j = i + 1; j < chicks.length; j++) {
          if (
            checkOverlap(
              chicks[i].position.x,
              chicks[i].position.z,
              chicks[j].position.x,
              chicks[j].position.z,
              SOCIAL_CIRCLE_THRESHOLD,
            )
          ) {
            chicks[i].socialCircleMet.add(chicks[j].connId);
            chicks[j].socialCircleMet.add(chicks[i].connId);
          }
        }
      }
      const requiredMeets = chicks.length - 1;
      for (const c of chicks) {
        if (!c.socialCircleCompleted && c.socialCircleMet.size >= requiredMeets) {
          c.socialCircleCompleted = true;
          addBreakdown(c, 'social-circle', 'Complete social circle', 5);
        }
      }
      if (chicks.length > 0 && chicks.every((c) => c.socialCircleMet.size >= requiredMeets)) {
        gs.stage = 1;
        gs.stageLabel = "Get Exam Tips from glowing buildings!";
        gs.stageTransitionUntil = devModeRef.current ? 0 : now + STAGE_TRANSITION_TOTAL_MS;
        for (const b of gs.buildings) {
          if (b.hasTip) {
            b.glowing = true;
            b.zoneActive = true;
          }
        }
      }
    }

    // ── Stage 1: Exam Tips building timers ──
    if (gs.stage === 1 || gs.stage === 2) {
      const chicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter((p) => !p.isEagle && p.alive);

      // If every chick who held this building's tip is gone, reopen the site for new star students.
      for (const b of gs.buildings) {
        if (!b.hasTip) continue;
        const anyAliveHasTip = chicks.some((c) => c.tips[b.tipIndex]);
        if (anyAliveHasTip) continue;
        if (b.tipObtained || b.tipObtainedCount > 0) {
          b.tipObtained = false;
          b.tipObtainedCount = 0;
          b.zoneActive = true;
          b.zoneHealth = 50;
          b.glowing = true;
        }
      }

      for (const chick of chicks) {
        const mode = gameModeRef.current;
        let inZoneBuilding = -1;
        for (const b of gs.buildings) {
          // Tips persist even after zone break — chick can obtain from any building with hasTip
          if (b.hasTip && isInProtectedZone(chick.position.x, chick.position.z, b.id)) {
            inZoneBuilding = b.id;
            break;
          }
        }

        const timerKey = `${chick.connId}-building`;
        if (inZoneBuilding >= 0) {
          if (!gs.buildingTimers.has(timerKey)) {
            gs.buildingTimers.set(timerKey, { buildingId: inZoneBuilding, startTime: now });
          } else {
            const timer = gs.buildingTimers.get(timerKey)!;
            if (timer.buildingId !== inZoneBuilding) {
              gs.buildingTimers.set(timerKey, { buildingId: inZoneBuilding, startTime: now });
            } else {
              const elapsed = now - timer.startTime;
              const building = gs.buildings[inZoneBuilding];
              if (elapsed >= TIP_OBTAIN_DURATION && building && !chick.tips[building.tipIndex]) {
                const neededCount = mode === "2v6" ? 2 : 1;
                if (building && building.tipObtainedCount < neededCount) {
                  // Become Star Student
                  chick.isStarStudent = true;
                  const tipIdx = building.tipIndex as 0 | 1;
                  chick.tips[tipIdx] = true;
                  chick.health = Math.min(STARTING_HEALTH, addSubGrades(chick.health, STAR_STUDENT_GRADE_BONUS));
                  chick.props.push({ type: "invincible", count: 1 });
                  addBreakdown(chick, 'obtain-tip', 'Obtain a tip', 10);

                  building.tipObtainedCount++;
                  if (building.tipObtainedCount >= neededCount) {
                    building.tipObtained = true;
                    building.glowing = false;
                    building.zoneActive = false;
                  }

                  gs.buildingTimers.delete(timerKey);

                  // Transition to stage 2 label if first tip obtained
                  if (gs.stage === 1) {
                    gs.stage = 2;
                    gs.stageLabel = "Stage 2 & 3: Share Exam Tips with everyone!";
                    gs.stageTransitionUntil = 0;
                  }
                }
              }
            }
          }
        } else {
          gs.buildingTimers.delete(timerKey);
        }
      }

      // Stage 2 → 3: All alive chicks have both tips
      if (gs.stage === 2) {
        const aliveChicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter((p) => !p.isEagle && p.alive);
        if (aliveChicks.length > 0 && aliveChicks.every((c) => c.tips[0] && c.tips[1])) {
          gs.stage = 3;
          gs.stageLabel = "Run to any building to start the Final Exam!";
          gs.stageTransitionUntil = devModeRef.current ? 0 : now + STAGE_TRANSITION_TOTAL_MS;
        }
      }
    }

    // ── Eagle zone tracking (for zone health reset on exit) ──
    if (gs.stage >= 1) {
      for (const [, p] of gs.playerStates) {
        if (!p.isEagle || !p.alive) continue;
        const zoneKey = p.connId;
        let currentZone = -1;
        for (const b of gs.buildings) {
          if (b.zoneActive && !b.tipObtained && isInProtectedZone(p.position.x, p.position.z, b.id)) {
            currentZone = b.id;
            break;
          }
        }
        const prev = gs.eagleZoneStates.get(zoneKey);
        if (currentZone >= 0) {
          if (!prev || prev.buildingId !== currentZone) {
            gs.eagleZoneStates.set(zoneKey, {
              buildingId: currentZone,
              entryHealth: gs.buildings[currentZone].zoneHealth,
            });
          }
        } else if (prev) {
          // Eagle left the zone — reset zone health
          const b = gs.buildings[prev.buildingId];
          if (b && b.zoneActive) b.zoneHealth = 50;
          gs.eagleZoneStates.delete(zoneKey);
        }
      }
    }

    // ── Stage 3: Exam venue entry check ──
    if (gs.stage === 3 && !gs.examStarted && gs.phase === "playing") {
      const aliveChicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter((p) => !p.isEagle && p.alive);
      if (aliveChicks.length > 0 && aliveChicks.every((c) => getAdjacentBuilding(c.position.x, c.position.z) >= 0)) {
        startExam(gs, currentBroadcast, currentMode, currentPlayers);
      }
    }

    // ── Exam timer countdown ──
    if (gs.phase === "exam" && gs.examState && !gs.examState.answered) {
      if (!gs.frozenAll) {
        updateHostExamDisplay(gs);
        gs.examState.timeRemaining -= delta;

        if (gs.examState.timeRemaining <= 0) {
          gs.examState.timeRemaining = 0;
          if (gs.examState.votingState?.isVoting) {
            resolveVoting(gs, currentBroadcast);
          } else {
            finalizeFinalExam(gs, currentBroadcast);
          }
        }
      }
    }

    // ── Voting timeout ──
    if (gs.phase === "exam" && gs.examState?.votingState?.isVoting) {
      const votingState = gs.examState.votingState;
      if (now - votingState.startedAt > EXAM_VOTING_DURATION) {
        // Voting timeout, resolve with current votes
        resolveVoting(gs, currentBroadcast);
      }
    }

    // ── Prop spawning ──
    if (gs.phase === "playing") {
      const activeSpeedCount = gs.propSpawns.filter((p) => p.active && p.type === "speed").length;
      const activeHealCount = gs.propSpawns.filter((p) => p.active && p.type === "heal").length;
      const activeBoxCount = gs.mysteryBoxes.filter((b) => !b.collected && !b.triggered).length;

      const speedInterval =
        PROP_SPAWN_INTERVAL_MIN + Math.random() * (PROP_SPAWN_INTERVAL_MAX - PROP_SPAWN_INTERVAL_MIN);
      if (activeSpeedCount < 5 && now - gs.lastPropSpawnSpeed > speedInterval) {
        gs.lastPropSpawnSpeed = now;
        spawnProp(gs, "speed");
      }
      if (activeHealCount < 5 && now - gs.lastPropSpawnHeal > PROP_SPAWN_INTERVAL_HEAL) {
        gs.lastPropSpawnHeal = now;
        spawnProp(gs, "heal");
      }

      // Prop pickup (proximity-based)
      for (const [, p] of gs.playerStates) {
        if (!p.alive || p.isEagle) continue;
        for (const prop of gs.propSpawns) {
          if (!prop.active) continue;
          if (checkOverlap(p.position.x, p.position.z, prop.position.x, prop.position.z, PROP_PICKUP_RADIUS)) {
            prop.active = false;
            // Restart spawn timer after claim (if we're below cap)
            if (prop.type === "speed") gs.lastPropSpawnSpeed = now;
            if (prop.type === "heal") gs.lastPropSpawnHeal = now;
            const existing = p.props.find((pi) => pi.type === prop.type);
            if (existing) existing.count++;
            else p.props.push({ type: prop.type, count: 1 });
            p.actionScore += 1;
          }
        }
      }
      gs.propSpawns = gs.propSpawns.filter((p) => p.active);

      // Mystery box spawning
      if (activeBoxCount < 1 && now - gs.lastMysteryBoxSpawn > MYSTERY_BOX_INTERVAL) {
        gs.lastMysteryBoxSpawn = now;
        const activeDelay = MYSTERY_BOX_ACTIVE_MIN + Math.random() * (MYSTERY_BOX_ACTIVE_MAX - MYSTERY_BOX_ACTIVE_MIN);
        const pos = findOpenPosition(gs);
        if (pos) {
          gs.mysteryBoxes.push({
            id: `box-${gs.mysteryBoxIdCounter++}`,
            position: pos,
            spawnedAt: now,
            activeAt: now + activeDelay,
            triggered: false,
            collected: false,
          });
        }
      }

      // Mystery box collection / trigger
      for (const box of gs.mysteryBoxes) {
        if (box.collected || box.triggered) continue;
        if (now < box.activeAt) continue; // not active yet
        for (const [, p] of gs.playerStates) {
          if (!p.alive) continue;
          if (checkOverlap(p.position.x, p.position.z, box.position.x, box.position.z, 1.5)) {
            if (!p.isEagle) {
              // Chick gets a random reward from the mystery box
              box.collected = true;
              gs.lastMysteryBoxSpawn = now; // restart after claim
              const roll = Math.random();
              if (roll < 0.125) {
                // 1 invincible to ALL chicks (12.5%)
                for (const [, cp] of gs.playerStates) {
                  if (!cp.isEagle && cp.alive) {
                    const inv = cp.props.find((pi) => pi.type === "invincible");
                    if (inv) inv.count += 1;
                    else cp.props.push({ type: "invincible", count: 1 });
                  }
                }
              } else if (roll < 0.25) {
                // 1 teleport to ALL chicks (12.5%)
                for (const [, cp] of gs.playerStates) {
                  if (!cp.isEagle && cp.alive) {
                    const tel = cp.props.find((pi) => pi.type === "teleport");
                    if (tel) tel.count += 1;
                    else cp.props.push({ type: "teleport", count: 1 });
                  }
                }
              } else if (roll < 0.5) {
                // 2 heal to ALL chicks (25%)
                for (const [, cp] of gs.playerStates) {
                  if (!cp.isEagle && cp.alive) {
                    const heal = cp.props.find((pi) => pi.type === "heal");
                    if (heal) heal.count += 2;
                    else cp.props.push({ type: "heal", count: 2 });
                  }
                }
              } else if (roll < 0.875) {
                // 3 speed to ALL chicks (37.5%)
                for (const [, cp] of gs.playerStates) {
                  if (!cp.isEagle && cp.alive) {
                    const spd = cp.props.find((pi) => pi.type === "speed");
                    if (spd) spd.count += 3;
                    else cp.props.push({ type: "speed", count: 3 });
                  }
                }
              } else {
                // 1 cage to obtainer only — cages the eagle for 5s, no cooldown (12.5%)
                const eagles = Array.from<PlayerGameState>(gs.playerStates.values()).filter(
                  (ep) => ep.isEagle && ep.alive,
                );
                for (const eagle of eagles) {
                  eagle.cagedUntil = now + 5000;
                  eagle.frozen = true;
                  eagle.frozenUntil = now + 5000;
                }
              }
              addBreakdown(p, 'mystery-box', 'Open mystery box', 10);
            } else {
              // Eagle triggers a random event
              box.triggered = true;
              gs.lastMysteryBoxSpawn = now; // restart after claim
              addBreakdown(p, 'mystery-box', 'Open mystery box', 15);
              gs.frozenAll = true;
              gs.frozenAllUntil = now + 60000; // lifted when event ends
              // Stop eagle movement immediately so it doesn't drift after unfreeze
              p.isMoving = false;
              const eagleLobby = currentPlayers.get(p.connId);
              if (eagleLobby) (eagleLobby as any).joystick = { x: 0, y: 0 };
              const rand = Math.random();
              const eventType = rand < 0.4 ? "mock-exam" : rand < 0.7 ? "hitbox" : "crossy-road";
              const questionNum = Math.floor(Math.random() * 4) + 1;
              const eventDuration = eventType === "hitbox" ? EVENT_HITBOX_DURATION : eventType === "mock-exam" ? EVENT_MOCK_DURATION : EVENT_CROSSY_DURATION;

              // Generate crossy lanes if needed
              let crossyLanes: any[] | undefined;
              let crossyPlayerStates: Record<string, any> | undefined;
              if (eventType === "crossy-road") {
                crossyLanes = [];
                for (let li = 0; li < 5; li++) {
                  const dir = li % 2 === 0 ? "left" as const : "right" as const;
                  const speed = 2 + Math.random() * 3; // 2-5 units/s
                  const obstacleCount = 1 + Math.floor(Math.random() * 2); // 1-2 (easier start)
                  const obstacles: { x: number; width: number }[] = [];
                  for (let oi = 0; oi < obstacleCount; oi++) {
                    obstacles.push({
                      x: Math.random() * CROSSY_FIELD_WIDTH,
                      width: 4 + Math.random() * 5, // 4-9 units wide (smaller)
                    });
                  }
                  crossyLanes.push({ id: li + 1, direction: dir, speed, obstacles });
                }
                crossyPlayerStates = {};
                for (const [, p] of gs.playerStates) {
                  if (!p.isEagle && p.alive) {
                    crossyPlayerStates[p.connId] = {
                      laneIndex: 0,
                      xPosition: CROSSY_FIELD_WIDTH / 2,
                      crossings: 0,
                      hitCount: 0,
                    };
                  }
                }
              }

              gs.activeEvent = {
                type: eventType,
                phase: "countdown",
                startedAt: now,
                endAt: now + 3000 + eventDuration,
                questionNum: eventType === "mock-exam" ? questionNum : undefined,
                mockExamSubmitted: eventType === "mock-exam" ? {} : undefined,
                mockExamAnswersByPlayer: eventType === "mock-exam" ? {} : undefined,
                mockExamCorrectByPlayer: eventType === "mock-exam" ? {} : undefined,
                mockExamCorrectCount: eventType === "mock-exam" ? 0 : undefined,
                chickClicks: {},
                eagleClicks: {},
                result: "pending",
                crossyLanes,
                crossyPlayerStates,
                eagleSpeedBoost: eventType === "crossy-road" ? 1.0 : undefined,
              };
              gs.eventCountdown = 3;
              gs.stageLabel = eventType === "mock-exam" ? "🎲 Event: Mock Exam!" : eventType === "hitbox" ? "🎲 Event: Hitbox Challenge!" : "🎲 Event: Crossy Road!";
              
              resetSusActivityTimers(gs, now, susPlayersRef.current);
              
              currentBroadcast({ type: "phase-change", phase: gs.phase });
            }
            break;
          }
        }
      }
      gs.mysteryBoxes = gs.mysteryBoxes.filter((b) => !b.collected && !b.triggered);
    }

    // ── Active event lifecycle ──
    if (gs.activeEvent) {
      const ev = gs.activeEvent as GameEvent;
      const elapsed = now - ev.startedAt;

      if (ev.phase === "countdown" && elapsed >= 3000) {
        ev.phase = "active";
        ev.endAt = now + (ev.type === "hitbox" ? EVENT_HITBOX_DURATION : ev.type === "crossy-road" ? EVENT_CROSSY_DURATION : EVENT_MOCK_DURATION);
      }

      // Crossy Road: simulate lanes each frame during active phase
      if (ev.phase === "active" && ev.type === "crossy-road" && ev.crossyLanes && ev.crossyPlayerStates) {
        const boost = ev.eagleSpeedBoost ?? 1;
        for (const lane of ev.crossyLanes) {
          for (const obs of lane.obstacles) {
            const move = lane.speed * boost * delta * (lane.direction === "left" ? -1 : 1);
            obs.x = ((obs.x + move) % CROSSY_FIELD_WIDTH + CROSSY_FIELD_WIDTH) % CROSSY_FIELD_WIDTH;
          }
        }
        // Collision detection
        for (const [connId, cs] of Object.entries(ev.crossyPlayerStates)) {
          if (cs.laneIndex >= 1 && cs.laneIndex <= 5) {
            const lane = ev.crossyLanes[cs.laneIndex - 1];
            if (lane) {
              for (const obs of lane.obstacles) {
                const obsLeft = obs.x;
                const obsRight = obs.x + obs.width;
                const px = cs.xPosition;
                // Check collision (player is ~3 units wide)
                const playerLeft = px - 1.5;
                const playerRight = px + 1.5;
                if (playerRight > obsLeft && playerLeft < obsRight) {
                  // Hit! Reset to start
                  cs.laneIndex = 0;
                  cs.xPosition = CROSSY_FIELD_WIDTH / 2;
                  cs.hitCount++;
                  break;
                }
              }
            }
          }
        }
      }

      if (ev.phase === "active" && now >= ev.endAt) {
        // Event over — evaluate results
        ev.phase = "result";

        if (ev.type === "hitbox") {
          const chickTotal = (Object.values(ev.chickClicks) as number[]).reduce((a: number, b: number) => a + b, 0);
          const eagleTotal = (Object.values(ev.eagleClicks) as number[]).reduce((a: number, b: number) => a + b, 0);
          const aliveChicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter(
            (p) => !p.isEagle && p.alive,
          );
          const avgChick = aliveChicks.length > 0 ? chickTotal / aliveChicks.length : 0;
          // 1v3: raw eagle sum; 2v6: average of 2 eagles
          const eagles = Array.from<PlayerGameState>(gs.playerStates.values()).filter((p) => p.isEagle && p.alive);
          const eagleCompare = currentMode === "2v6" && eagles.length > 0 ? eagleTotal / eagles.length : eagleTotal;

          if (avgChick >= eagleCompare) {
            ev.result = "chick";
            for (const [, p] of gs.playerStates) {
              if (p.alive) p.health = addSubGrades(p.health, 2);
            }
          } else {
            ev.result = "eagle";
            for (const [, p] of gs.playerStates) {
              if (!p.isEagle && p.alive) p.health = addSubGrades(p.health, -2);
            }
          }
          // F-grade elimination after hitbox
          for (const [, p] of gs.playerStates) {
            if (!p.isEagle && p.alive && isDead(p.health)) {
              p.alive = false;
              p.health = 0;
              currentBroadcast({ type: "you-died", connId: p.connId });
            }
          }
        } else if (ev.type === "mock-exam") {
          // Individual scoring: each alive chick is graded on their own answer.
          let correctCount = 0;
          const questionNum = ev.questionNum ?? 1;
          const expectedAnswer = normalizeMockExamAnswer(MOCK_ANSWER_KEY[questionNum] ?? "");
          ev.mockExamAnswersByPlayer = ev.mockExamAnswersByPlayer ?? {};
          ev.mockExamCorrectByPlayer = ev.mockExamCorrectByPlayer ?? {};

          for (const [, p] of gs.playerStates) {
            if (p.isEagle || !p.alive) continue;

            const submittedAnswer = normalizeMockExamAnswer(ev.mockExamAnswersByPlayer[p.connId] ?? "");
            const isCorrect = submittedAnswer.length > 0 && submittedAnswer === expectedAnswer;
            ev.mockExamCorrectByPlayer[p.connId] = isCorrect;
            ev.chickClicks[p.connId] = isCorrect ? 1 : 0;
            if (isCorrect) {
              correctCount++;
              p.health = addSubGrades(p.health, 1);
              addBreakdown(p, 'mock-exam', 'Mock Exam correct', 3);
            } else {
              // Wrong, missing, and bot answers all count as incorrect.
              p.health = addSubGrades(p.health, -2);
            }
          }

          ev.mockExamCorrectCount = correctCount;
          ev.result = correctCount > 0 ? "chick" : "eagle";

          for (const [, p] of gs.playerStates) {
            if (!p.isEagle && p.alive && isDead(p.health)) {
              p.alive = false;
              p.health = 0;
              if (!isBotConnId(p.connId)) {
                currentBroadcast({ type: "you-died", connId: p.connId });
              }
            }
          }
        } else if (ev.type === "crossy-road" && ev.crossyPlayerStates) {
          // Crossy Road scoring: 3+ crossings = +2, 2 crossings = +1, <2 = -2
          let goodCount = 0;
          let totalChicks = 0;
          for (const [, p] of gs.playerStates) {
            if (p.isEagle || !p.alive) continue;
            totalChicks++;
            const cs = ev.crossyPlayerStates[p.connId];
            const crossings = cs?.crossings ?? 0;
            if (crossings >= 3) {
              p.health = addSubGrades(p.health, 2);
              goodCount++;
              addBreakdown(p, 'crossy-road', 'Crossy Road', crossings * 2, crossings);
            } else if (crossings === 2) {
              p.health = addSubGrades(p.health, 1);
              goodCount++;
              addBreakdown(p, 'crossy-road', 'Crossy Road', crossings * 2, crossings);
            } else {
              p.health = addSubGrades(p.health, -2);
            }
          }
          ev.result = goodCount > totalChicks / 2 ? "chick" : "eagle";
          // F-grade elimination
          for (const [, p] of gs.playerStates) {
            if (!p.isEagle && p.alive && isDead(p.health)) {
              p.alive = false;
              p.health = 0;
              currentBroadcast({ type: "you-died", connId: p.connId });
            }
          }
        }

        // Post-event: freeze all eagles for 5 seconds (buffer for chicks)
        for (const [, p] of gs.playerStates) {
          if (p.isEagle) {
            p.frozen = true;
            p.frozenUntil = now + 5000;
          }
        }

        // Unfreeze all after short result display (3s)
        gs.frozenAllUntil = now + 3000;
        resetSusActivityTimers(gs, now, susPlayersRef.current);

        // Clear event after 3 more seconds
        setTimeout(() => {
          const gsCleanup = gameStateRef.current as GameStateRef | null;
          if (gsCleanup) {
            gsCleanup.frozenAll = false;
            gsCleanup.frozenAllUntil = 0;
            gsCleanup.activeEvent = null;
            gsCleanup.stageLabel = getStageLabel(gsCleanup.stage as number);
            resetSusActivityTimers(gsCleanup, Date.now(), susPlayersRef.current);
          }
        }, 3000);
      }
    }

    // ── Win condition check: only auto-end when ALL chicks dead ──
    const aliveChicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter((p) => !p.isEagle && p.alive);

    if (!gs.winner) {
      if (aliveChicks.length === 0) {
        // Broadcast updated state BEFORE ending game to ensure clients receive health deductions
        doBroadcastState(gs, currentBroadcast);
        endGame(gs, "eagle", currentBroadcast);
        return; // endGame calls doBroadcastState again
      }
      // After exam: check for chicks-win vs draw (handled in endGame after exam completion)
    }

    doBroadcastState(gs, currentBroadcast);
  }, []);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function getStageLabel(stage: number): string {
    switch (stage) {
      case 0:
        return "Touch every other chick!";
      case 1:
        return "Get Exam Tips from glowing buildings!";
      case 2:
        return "Stage 2 & 3: Share Exam Tips with everyone!";
      case 3:
        return "Run to any building to start the Final Exam!";
      default:
        return "";
    }
  }

  function spawnProp(gs: GameStateRef, type: "speed" | "heal") {
    for (let attempt = 0; attempt < 10; attempt++) {
      const pos = {
        x: (Math.random() - 0.5) * (MAP_HALF * 1.6),
        z: (Math.random() - 0.5) * (MAP_HALF * 1.6),
      };
      if (!checkCollision(pos.x, pos.z, 1.5)) {
        gs.propSpawns.push({
          id: `prop-${gs.propIdCounter++}`,
          type,
          position: pos,
          active: true,
        });
        break;
      }
    }
  }

  function findOpenPosition(gs: GameStateRef): { x: number; z: number } | null {
    for (let attempt = 0; attempt < 15; attempt++) {
      const pos = { x: (Math.random() - 0.5) * MAP_HALF * 1.4, z: (Math.random() - 0.5) * MAP_HALF * 1.4 };
      if (!checkCollision(pos.x, pos.z, 1.5)) return pos;
    }
    return null;
  }

  function selectExamSubmitter(
    gs: GameStateRef,
    currentPlayers: Map<string, PlayerState>,
  ): string | null {
    const connectedChicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter(
      (p) => !p.isEagle && p.alive && !isBotConnId(p.connId) && currentPlayers.has(p.connId),
    );
    if (connectedChicks.length > 0) {
      return connectedChicks[Math.floor(Math.random() * connectedChicks.length)].connId;
    }

    const anyHumanChick = Array.from<PlayerGameState>(gs.playerStates.values()).filter(
      (p) => !p.isEagle && p.alive && !isBotConnId(p.connId),
    );
    if (anyHumanChick.length > 0) {
      return anyHumanChick[Math.floor(Math.random() * anyHumanChick.length)].connId;
    }

    return null;
  }

  function reassignExamSubmitter(
    gs: GameStateRef,
    currentPlayers: Map<string, PlayerState>,
    bcast: (msg: HostMessage) => void,
  ): string | null {
    if (!gs.examState) return null;
    const nextSubmitterId = selectExamSubmitter(gs, currentPlayers);
    gs.examState.examSubmitterId = nextSubmitterId ?? undefined;
    if (nextSubmitterId) {
      bcast({ type: "exam-submitter-changed", newSubmitterId: nextSubmitterId });
    }
    return nextSubmitterId;
  }

  function applyFinalExamPenalty(gs: GameStateRef, bcast: (msg: HostMessage) => void) {
    for (const [, p] of gs.playerStates) {
      if (!p.alive || p.isEagle) continue;
      p.health = addSubGrades(p.health, -2);
      if (isDead(p.health)) {
        p.alive = false;
        p.health = 0;
        bcast({ type: "you-died", connId: p.connId });
        if (gs.examState?.layer1ConnId === p.connId && !gs.examState.layer1Dead) {
          gs.examState.layer1Dead = true;
        }
      }
    }
    updateHostExamDisplay(gs);
  }

  function finalizeFinalExam(gs: GameStateRef, bcast: (msg: HostMessage) => void) {
    if (!gs.examState || gs.examState.answered) return;

    gs.examState.answered = true;
    gs.examState.timeRemaining = 0;
    gs.examState.votingState = undefined;
    setVotingDeadline(gs, 0);

    const finalAnswer = (gs.examState.finalAnswer ?? "").trim().toUpperCase();
    const correctAnswer = FINAL_ANSWER_KEY[gs.examState.questionNum] ?? "";
    const isCorrect = finalAnswer.length > 0 && finalAnswer === correctAnswer;

    if (isCorrect && gs.examState.examSubmitterId) {
      const submitter = gs.playerStates.get(gs.examState.examSubmitterId);
      if (submitter) {
        addBreakdown(submitter, "final-exam", "Final Exam correct", 10);
      }
    } else {
      applyFinalExamPenalty(gs, bcast);
    }

    startExamGameOverTransition(gs, gameModeRef.current as "1v3" | "2v6");
  }

  function startExam(
    gs: GameStateRef,
    bcast: (msg: HostMessage) => void,
    mode: "1v3" | "2v6",
    currentPlayers: Map<string, PlayerState>,
  ) {
    gs.examStarted = true;
    gs.phase = "exam";
    setPhase("exam");
    
    // Update last activity for all players when entering exam phase
    const now = Date.now();
    const susPlayers = susPlayersRef.current;
    for (const [connId, sus] of susPlayers) {
      const player = gs.playerStates.get(connId);
      if (player && player.alive && !isBotConnId(connId)) {
        sus.lastActivityAt = now;
      }
    }

    const aliveChicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter((p) => !p.isEagle && p.alive);
    const questionNum = Math.floor(Math.random() * 4) + 1;
    const timer = mode === "1v3" ? EXAM_TIMER_1V3 : EXAM_TIMER_2V6;

    // If only 1 chick left, they get both layers — layer1 shown on host automatically
    const shuffled = [...aliveChicks].sort(() => Math.random() - 0.5);
    const layer1Player = shuffled[0];
    const layer2Players = shuffled.slice(1);

    const soloExam = aliveChicks.length === 1;

    const nonBotChicks = aliveChicks.filter((c) => !isBotConnId(c.connId));
    const examWhiteBgConnId =
      nonBotChicks.length > 0
        ? nonBotChicks[Math.floor(Math.random() * nonBotChicks.length)].connId
        : null;
    
    const examSubmitterId = selectExamSubmitter(gs, currentPlayers);
    const answerLength = (FINAL_ANSWER_KEY[questionNum] ?? "").length || 3;

    gs.examState = {
      questionNum,
      category: "Final",
      timeRemaining: timer,
      timeLimit: timer,
      layer1ConnId: layer1Player.connId,
      layer2ConnIds: layer2Players.map((p) => p.connId),
      answered: false,
      layer1Dead: false,
      anyAnswerSubmitted: false,
      hostDisplayLayer: soloExam ? "1" : "none",
      examWhiteBgConnId,
      examSubmitterId: examSubmitterId ?? undefined,
      answerLength,
    };
    setVotingDeadline(gs, 0);
    gs.stageLabel = "FINAL EXAM — Solve together!";
    updateHostExamDisplay(gs);

    // Build per-client assignments
    const examAssigns: Record<string, { layer: "1" | "2"; questionNum: number; category: "Final" }> = {};
    if (soloExam) {
      // Solo player gets layer 2 on their device, layer 1 on host screen
      examAssigns[layer1Player.connId] = { layer: "2", questionNum, category: "Final" };
    } else {
      examAssigns[layer1Player.connId] = { layer: "1", questionNum, category: "Final" };
      for (const p of layer2Players) {
        examAssigns[p.connId] = { layer: "2", questionNum, category: "Final" };
      }
    }
    // Eagles don't get a layer
    for (const [, p] of gs.playerStates) {
      if (p.isEagle) examAssigns[p.connId] = { layer: "2", questionNum: 0, category: "Final" };
    }

    bcast({ type: "phase-change", phase: "exam" });
    bcast({ type: "exam-start", assignments: examAssigns, examWhiteBgConnId, examSubmitterId, answerLength });
  }

  function endGame(gs: GameStateRef, winner: "eagle" | "chicks" | "draw", bcast: (msg: any) => void) {
    finalizeGameResults(gs);
    gs.winner = winner;
    gs.pendingExamWinner = null;
    gs.examTransitionEndsAt = 0;
    gs.phase = "gameover";
    setPhase("gameover");
    cancelAnimationFrame(frameRef.current);
    bcast({ type: "game-over", winner });
    doBroadcastState(gs, bcast);
  }

  function getExamWinner(gs: GameStateRef, mode: "1v3" | "2v6"): "eagle" | "chicks" | "draw" {
    const aliveChicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter((p) => !p.isEagle && p.alive);
    const C = aliveChicks.length;

    if (C === 0) {
      return "eagle";
    } else if (mode === "1v3") {
      // 1v3: 2+ chicks = win, 1 = draw
      return C >= 2 ? "chicks" : "draw";
    } else {
      // 2v6: 3+ chicks = win, 2 = draw, <2 = eagle
      return C >= 3 ? "chicks" : C === 2 ? "draw" : "eagle";
    }
  }

  function startExamGameOverTransition(gs: GameStateRef, mode: "1v3" | "2v6") {
    finalizeGameResults(gs);
    gs.pendingExamWinner = getExamWinner(gs, mode);
    gs.examTransitionEndsAt = Date.now() + GAME_END_TRANSITION_DURATION;
    gs.frozenAll = true;
    gs.frozenAllUntil = gs.examTransitionEndsAt;
    setVotingDeadline(gs, 0);
  }

  // ─── Broadcast state ────────────────────────────────────────────────────────
  const doBroadcastState = useCallback((gs: GameStateRef, bcast: (msg: any) => void) => {
    const now = Date.now();
    const playersObj: Record<string, PlayerGameStateSerializable> = {};
    for (const [id, p] of gs.playerStates) {
      playersObj[id] = serializePlayerState(p, now);
    }
    const tipObtainTimers: Record<string, { buildingId: number; remainingMs: number }> = {};
    for (const [timerKey, t] of gs.buildingTimers.entries()) {
      const connId = timerKey.replace("-building", "");
      tipObtainTimers[connId] = {
        buildingId: t.buildingId,
        remainingMs: Math.max(0, TIP_OBTAIN_DURATION - (now - t.startTime)),
      };
    }

    let activeEvent: GameEvent | null = null;
    if (gs.activeEvent) {
      const countdownRemainingMs =
        gs.activeEvent.phase === "countdown"
          ? Math.max(0, 3000 - (now - gs.activeEvent.startedAt))
          : 0;
      activeEvent = {
        ...gs.activeEvent,
        remainingMs: Math.max(0, gs.activeEvent.endAt - now),
        countdownRemainingMs,
      };
    }
    const stageTransitionRemainingMs =
      gs.stageTransitionUntil > 0 ? Math.max(0, gs.stageTransitionUntil - now) : 0;

    const hostSnap: GameStateSnapshot = {
      phase: gs.phase,
      stage: gs.stage,
      gameTime: gs.gameTime,
      countdownTime: gs.countdownTime,
      eagleAwake: gs.eagleAwake,
      players: playersObj,
      frozenAll: gs.frozenAll,
      frozenAllUntil: gs.frozenAllUntil,
      videoPlaying: gs.videoPlaying,
      propSpawns: gs.propSpawns,
      buildings: gs.buildings,
      winner: gs.winner,
      stageLabel: gs.stageLabel,
      examState: gs.examState,
      mysteryBoxes: gs.mysteryBoxes,
      activeEvent,
      tipObtainTimers,
      stageTransitionUntil: gs.stageTransitionUntil ?? 0,
      stageTransitionRemainingMs,
      activeTipShareConnIds: [],
      totalPauseMs: gs.totalPauseMs ?? 0,
      replayCountdown: (gs as any).replayCountdown ?? null,
      examTransitionEndsAt: gs.examTransitionEndsAt,
    };

    setSnapshot(hostSnap);

    // Keep client payload lightweight during replay: replay frames are only needed on host.
    const networkReplay = hostSnap.replayCountdown
      ? {
          ...hostSnap.replayCountdown,
          replayData: {
            ...hostSnap.replayCountdown.replayData,
            frames: [],
          },
        }
      : null;
    const networkSnap: GameStateSnapshot = {
      ...hostSnap,
      replayCountdown: networkReplay,
    };

    const nowMs = Date.now();
    const inReplayWindow = Boolean(hostSnap.videoPlaying || hostSnap.replayCountdown);
    const isSupabase = connectionModeRef.current === "supabase";
    // Throttle network broadcasts for both transport modes to reduce TURN / signaling load.
    const baseIntervalMs = isSupabase ? 66 : 50;
    const minIntervalMs = inReplayWindow ? 66 : baseIntervalMs;
    if (nowMs - lastNetworkStateBroadcastAtRef.current >= minIntervalMs) {
      lastNetworkStateBroadcastAtRef.current = nowMs;
      bcast({ type: "game-state", state: networkSnap });
    }
  }, []);

  // ─── Host Drag Helpers (teleport during gameplay) ──────────────────────
  const hostDragBegin = useCallback((connId: string) => {
    const gs = gameStateRef.current as GameStateRef | null;
    if (!gs) return;
    const p = gs.playerStates.get(connId);
    if (!p || !p.alive) return;

    if (hostDragBackupRef.current.has(connId)) return;

    hostDragBackupRef.current.set(connId, {
      position: { ...p.position },
      frozen: p.frozen,
      frozenUntil: p.frozenUntil,
    });

    // Prevent client joystick updates from overriding the host drag.
    p.frozen = true;
    p.frozenUntil = Number.MAX_SAFE_INTEGER;
    p.isMoving = false;
    p.isAttacking = false;
  }, []);

  const hostDragUpdate = useCallback((connId: string, x: number, z: number) => {
    const gs = gameStateRef.current as GameStateRef | null;
    if (!gs) return;
    const p = gs.playerStates.get(connId);
    if (!p || !p.alive) return;

    const resolved = resolvePosition(x, z, p.position.x, p.position.z, 0.5, false);
    p.position.x = resolved.x;
    p.position.z = resolved.z;
  }, []);

  const hostDragEnd = useCallback((connId: string, valid: boolean) => {
    const gs = gameStateRef.current as GameStateRef | null;
    if (!gs) return;
    const p = gs.playerStates.get(connId);
    const backup = hostDragBackupRef.current.get(connId);
    if (!p || !backup) return;

    if (!valid) {
      p.position.x = backup.position.x;
      p.position.z = backup.position.z;
    }

    p.frozen = backup.frozen;
    p.frozenUntil = backup.frozenUntil;

    hostDragBackupRef.current.delete(connId);
  }, []);

  // ─── Voting resolution helper ────────────────────────────────────────────────
  const resolveVoting = useCallback((gs: GameStateRef, currentBroadcast: (msg: HostMessage) => void) => {
    if (!gs.examState?.votingState?.isVoting) return;

    const votingState = gs.examState.votingState;
    votingState.isVoting = false;
    const submitterConnId = gs.examState.examSubmitterId;
    const livePlayers = playersRef.current;
    const eligibleVoterIds = Array.from<PlayerGameState>(gs.playerStates.values())
      .filter(
        (p) =>
          !p.isEagle &&
          p.alive &&
          !isBotConnId(p.connId) &&
          p.connId !== submitterConnId &&
          livePlayers.has(p.connId),
      )
      .map((p) => p.connId);

    const votes = votingState.submittedVotes ?? {};
    const passVotes = eligibleVoterIds.filter((connId) => votes[connId] === "pass").length;
    const failVotes = eligibleVoterIds.filter((connId) => votes[connId] === "fail").length;
    const majorityPass = eligibleVoterIds.length === 0 || passVotes >= failVotes;

    if (majorityPass) {
      finalizeFinalExam(gs, currentBroadcast);
      return;
    }

    gs.examState.votingState = undefined;
    setVotingDeadline(gs, 0);
    currentBroadcast({
      type: "exam-voting-end",
      allowResubmit: true,
      submitterConnId: gs.examState.examSubmitterId,
    });
  }, []);

  // ─── Handle Client Messages ───────────────────────────────────────────────────
  const handleClientMessage = useCallback(async (connId: string, msg: ClientMessage) => {
    const gs = gameStateRef.current as GameStateRef | null;
    if (!gs) return;
    const now = Date.now();
    const player = gs.playerStates.get(connId) as PlayerGameState | undefined;
    if (!player || !player.alive) return;
    const eventInputTypes = new Set([
      "event-hitbox-click",
      "event-hitbox-batch",
      "crossy-hop",
      "crossy-eagle-action",
      "event-answer",
    ]);
    const isEventInput =
      typeof (msg as any)?.type === "string" &&
      eventInputTypes.has((msg as any).type);
    const isEventInputAllowed =
      isEventInput &&
      !!gs.activeEvent &&
      gs.activeEvent.phase === "active" &&
      !gs.pendingEagleFreezeAfterVideo &&
      !gs.pendingExamEndAfterVideo &&
      !gs.videoPlaying &&
      !gs.replayCountdown;
    if (
      (gs.frozenAll || gs.pendingEagleFreezeAfterVideo || gs.pendingExamEndAfterVideo || !!gs.videoPlaying || !!gs.replayCountdown) &&
      !isEventInputAllowed
    ) {
      return;
    }

    const getHistoricalPosition = (targetConnId: string, targetTimeMs: number): { x: number; z: number } | null => {
      const buf = positionHistoryRef.current;
      // Scan backward from newest to oldest, pick first frame at/before target time.
      for (let i = 0; i < buf.count; i++) {
        const idx = (buf.writeIndex - 1 - i + POSITION_HISTORY_MAX) % POSITION_HISTORY_MAX;
        const f = buf.frames[idx];
        if (!f) continue;
        if (f.time > targetTimeMs) continue;
        const fp = f.players?.[targetConnId];
        if (!fp) return null;
        return { x: fp.x, z: fp.z };
      }
      return null;
    };

    switch (msg.type) {
      // ── Attack ──
      case "attack-press": {
        if (!player.isEagle) return;
        if (gs.phase === "exam") return;
        if (gs.frozenAll) return;
        if (now < player.attackCooldownUntil) return;
        if (player.frozen) return;

        player.attackCooldownUntil = now + ATTACK_COOLDOWN;
        player.isAttacking = true;
        player.attackAnimUntil = now + ATTACK_ANIM_DURATION;

        const hitChicks: PlayerGameState[] = [];
        const victimLookbackMs = 200;
        const targetTime = now - victimLookbackMs;
        for (const [, p] of gs.playerStates) {
          if (p.isEagle || !p.alive) continue;
          if (p.invincibleUntil > now) continue;

          const effectivePos = getHistoricalPosition(p.connId, targetTime) ?? p.position;

          // Check if chick is fully inside a protected zone
          const inZone = gs.buildings.some(
            (b) => b.zoneActive && !b.tipObtained && isInProtectedZone(effectivePos.x, effectivePos.z, b.id),
          );
          if (inZone) continue;

          if (
            checkOverlap(
              player.position.x,
              player.position.z,
              effectivePos.x,
              effectivePos.z,
              ATTACK_OVERLAP_THRESHOLD,
            )
          ) {
            hitChicks.push(p);
          }
        }

        if (hitChicks.length > 0) {
          let mostSerious: "hurt" | "dead" = "hurt";
          const invincUntil = now + POST_HIT_IMMEDIATE_CHICK_INVINC_MS;
          for (const chick of hitChicks) {
            const newHealth = applyDamage(chick.health);
            const dmg = chick.health - newHealth;
            chick.damageTaken += dmg;
            player.damageDealt += dmg;
            addBreakdown(player, 'deal-damage', 'Deal damage', 15);
            chick.health = newHealth;
            if (chick.alive) {
              chick.invincibleUntil = Math.max(chick.invincibleUntil, invincUntil);
            }

            if (isDead(chick.health)) {
              chick.alive = false;
              chick.health = 0;
              mostSerious = "dead";

              // Handle layer-1 death during exam
              if (gs.examState && gs.examState.layer1ConnId === chick.connId && !gs.examState.layer1Dead) {
                gs.examState.layer1Dead = true;
                for (const [, pp] of gs.playerStates) {
                  if (pp.alive) pp.health = addSubGrades(pp.health, -1);
                }
              }
              updateHostExamDisplay(gs);

              broadcastRef.current({ type: "you-died", connId: chick.connId });
            }
          }
          updateHostExamDisplay(gs);

          // Snapshot replay data immediately (last 1.5s before attack)
          const eagleFacing = player.facingAngle;
          {
            const buf = positionHistoryRef.current;
            const cutoff = now - 1500;
            const replayFrames: ReplayFrame[] = [];
            for (let i = 0; i < buf.count; i++) {
              const idx = (buf.writeIndex - buf.count + i + POSITION_HISTORY_MAX) % POSITION_HISTORY_MAX;
              const f = buf.frames[idx];
              if (f && f.time >= cutoff) replayFrames.push(f);
            }
            (gs as any)._pendingReplayData = {
              frames: replayFrames,
              attackerConnId: connId,
              victimConnIds: hitChicks.map(c => c.connId),
              attackTime: now,
              attackerFacingAngle: eagleFacing,
            } as ReplayData;
          }

          // Delay freeze + video by 0.2s so attack motion is captured
          gs.pendingEagleFreezeAfterVideo = true;
          const videoType = mostSerious;
          setTimeout(() => {
            const gsInner = gameStateRef.current as GameStateRef | null;
            if (!gsInner) return;
            gsInner.frozenAll = true;
            gsInner.frozenAllUntil = Date.now() + 60000;
            gsInner.videoPlaying = videoType;
            setVideoPlaying(videoType);
          }, 200);
        }
        break;
      }

      // ── Prop use ──
      case "prop-use": {
        // Props can be used while moving — no frozen check
        if (gs.phase === "exam" && player.isEagle && msg.propType === "cage") return;
        const propItem = player.props.find((p) => p.type === msg.propType && p.count > 0);
        if (!propItem) return;
        const sus = susPlayersRef.current.get(connId);
        if (sus) {
          sus.lastActivityAt = now;
          sus.status = "active";
          sus.disconnectReason = null;
          sus.promptShownAt = null;
          sus.activityWarningShownAt = null;
          sus.detectedAt = 0;
        }
        propItem.count--;
        // scoring handled per-prop below

        switch (msg.propType as PropType) {
          case "speed":
            player.speedMultiplier = SPEED_BOOST_MULTIPLIER;
            player.speedMultiplierUntil = now + SPEED_BOOST_DURATION;
            if (!player.isEagle) addBreakdown(player, 'use-prop', 'Use a prop', 3);
            break;
          case "heal":
            if (player.health < STARTING_HEALTH) player.health = applyHeal(player.health);
            if (!player.isEagle) addBreakdown(player, 'use-prop', 'Use a prop', 3);
            break;
          case "fly":
            if (player.isEagle) {
              propItem.count++; // undo the decrement above — unlimited
              if (now < player.flyCooldownUntil) return; // on cooldown
              if (now < player.attackCooldownUntil) return; // blocked during post-attack freeze
              if (now < player.speedMultiplierUntil && player.speedMultiplier >= FLY_SPEED_MULTIPLIER) return; // still flying
              player.isAttacking = true;
              player.attackAnimUntil = now + FLY_DURATION + 200;
              player.speedMultiplier = FLY_SPEED_MULTIPLIER;
              player.speedMultiplierUntil = now + FLY_DURATION;
              player.flyCooldownUntil = now + FLY_COOLDOWN;
              addBreakdown(player, 'use-prop', 'Use prop (fly)', 3);
            }
            break;
          case "invincible":
            player.invincibleUntil = now + 3000;
            if (!player.isEagle) addBreakdown(player, 'use-prop', 'Use a prop', 3);
            break;
          case "teleport":
            if (player.isEagle) return;
            if (!player.teleportPending) {
              // Phase 1: enter targeting mode
              player.teleportPending = true;
              player.teleportTarget = { x: player.position.x, z: player.position.z };
              propItem.count++; // don't consume yet
            } else {
              // Phase 2: execute teleport
              player.position.x = player.teleportTarget.x;
              player.position.z = player.teleportTarget.z;
              player.invincibleUntil = now + 500;
              player.teleportPending = false;
              // propItem already decremented above
              addBreakdown(player, 'use-prop', 'Use a prop', 3);
            }
            break;
          case "cage":
            if (!player.isEagle) return;
            propItem.count++; // unlimited — undo decrement
            if (now < player.cageCooldownUntil) return;
            // Pick random alive chick
            {
              const aliveChicksCage = Array.from<PlayerGameState>(gs.playerStates.values()).filter(
                (cp) => !cp.isEagle && cp.alive && cp.cagedUntil <= 0,
              );
              if (aliveChicksCage.length === 0) return;
              const target = aliveChicksCage[Math.floor(Math.random() * aliveChicksCage.length)];
              target.cagedUntil = now + CAGE_LOCK_DURATION;
              target.frozen = true;
              target.frozenUntil = now + CAGE_LOCK_DURATION;
              target.invincibleUntil = now + CAGE_LOCK_DURATION + CAGE_POST_INVINCIBLE;
              player.cageCooldownUntil = now + CAGE_COOLDOWN;
              addBreakdown(player, 'cage', 'Cage a chick', 3);
            }
            break;
        }
        break;
      }
      case "teleport-set": {
        if (player.isEagle || !player.teleportPending) return;
        const resolved = resolvePosition(
          msg.x,
          msg.z,
          player.teleportTarget.x,
          player.teleportTarget.z,
          0.5,
          false,
        );
        player.teleportTarget.x = resolved.x;
        player.teleportTarget.z = resolved.z;
        break;
      }
      case "teleport-confirm": {
        if (player.isEagle || !player.teleportPending) return;
        const teleProp = player.props.find((p) => p.type === "teleport" && p.count > 0);
        if (teleProp) teleProp.count--;
        player.position.x = player.teleportTarget.x;
        player.position.z = player.teleportTarget.z;
        player.invincibleUntil = now + 500;
        player.teleportPending = false;
        break;
      }

      // ── Hitbox click (eagle attacking building zone) ──
      case "hitbox-click": {
        if (!player.isEagle) return;
        if (gs.phase === "exam") return;
        for (const b of gs.buildings) {
          if (!b.zoneActive || b.tipObtained) continue;
          if (isInProtectedZone(player.position.x, player.position.z, b.id)) {
            b.zoneHealth = Math.max(0, b.zoneHealth - 1);
            addBreakdown(player, 'building-hp', 'Destroy building HP', 0.5);
            if (b.zoneHealth <= 0) {
              // Zone broken: tips remain obtainable, just unprotected (building stays gold via hasTip && !tipObtained)
              b.zoneActive = false;
              // Don't set hasTip=false or tipObtained=true — tips persist
              gs.eagleZoneStates.delete(player.connId);
            }
            break;
          }
        }
        break;
      }

      // ── Scan result (props and tips) ──
      case "scan-result": {
        if (player.isEagle) return;
        const data = msg.data;

        // Check if it's a tip share code (starts with FIRETIP-)
        if (data.startsWith('FIRETIP-')) {
          try {
            const res = await fetch('/api/tip-claim', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: data, scannerConnId: connId }),
            });
            const claimData = await res.json();

            if (!res.ok) {
              // Code already used or expired
              return;
            }

            const { sharerConnId, tipIndex } = claimData;

            // Proximity check
            const sharer = gs.playerStates.get(sharerConnId);
            if (sharer && !checkOverlap(player.position.x, player.position.z, sharer.position.x, sharer.position.z, TIP_SHARE_RADIUS)) {
              return; // too far
            }

            // Transfer tip
            player.tips[tipIndex] = true;
            addBreakdown(player, 'receive-tip', 'Receive shared tip', 5);
            player.scansPerformed++;
            const sharerPlayer = gs.playerStates.get(sharerConnId);
            if (sharerPlayer) sharerPlayer.tipsShared++;

            // Notify both players
            broadcastRef.current({
              type: "tip-copy-notify",
              connIds: [connId, sharerConnId],
              tipIndex,
            });

            // Check stage progression
            if (gs.stage === 2) {
              const aliveChicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter((p) => !p.isEagle && p.alive);
              if (aliveChicks.length > 0 && aliveChicks.every((c) => c.tips[0] && c.tips[1])) {
                gs.stage = 3;
                gs.stageLabel = "Run to any building to start the Final Exam!";
              }
            }
          } catch (error) {
            console.error('Tip claim error:', error);
          }
          break;
        }

        // Check if it's a prop ID
        const prop = gs.propSpawns.find((p) => p.id === data && p.active);
        if (prop) {
          // Validate proximity
          if (
            checkOverlap(player.position.x, player.position.z, prop.position.x, prop.position.z, PROP_PICKUP_RADIUS * 2)
          ) {
            prop.active = false;
            const existing = player.props.find((pi) => pi.type === prop.type);
            if (existing) existing.count++;
            else player.props.push({ type: prop.type, count: 1 });
            addBreakdown(player, 'collect-prop', 'Collect prop spawn', 2);
          }
          break;
        }
        break;
      }

      // ── Tip request (star student generating QR) ──
      case "tip-request": {
        if (player.isEagle) return;
        const tipIndex = msg.tipIndex as 0 | 1;
        if (!player.tips[tipIndex]) return;
        if (now < player.tipShareCooldownUntil) return;
      
        // Proximity check: must be near at least one other alive chick
        const otherChicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter(
          (p) => !p.isEagle && p.alive && p.connId !== connId,
        );
        const nearbyChick = otherChicks.some((c) =>
          checkOverlap(player.position.x, player.position.z, c.position.x, c.position.z, TIP_SHARE_RADIUS),
        );
        if (!nearbyChick) {
          broadcastRef.current({ type: "tip-reject", forConnId: connId, reason: "too-far" });
          return;
        }
      
        player.tipShareCooldownUntil = now + TIP_QR_COOLDOWN;
      
        // Call Neon API to create tip record
        try {
          const res = await fetch('/api/tip-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sharerConnId: connId, tipIndex }),
          });
          const data = await res.json();
      
          if (!res.ok) {
            console.error('Tip request failed:', data.error);
            return;
          }
      
          // Store the tip info for polling (client will poll)
          // We still need to tell the client about the QR code
          broadcastRef.current({ type: "tip-qr", forConnId: connId, code: data.code, tipIndex });
        } catch (error) {
          console.error('Tip request error:', error);
        }
        break;
      }

      // ── Event hitbox click ──
      case "event-hitbox-click": {
        if (!gs.activeEvent || gs.activeEvent.type !== "hitbox" || gs.activeEvent.phase !== "active") return;
        if (player.isEagle) {
          gs.activeEvent.eagleClicks[connId] = (gs.activeEvent.eagleClicks[connId] ?? 0) + 1;
        } else {
          gs.activeEvent.chickClicks[connId] = (gs.activeEvent.chickClicks[connId] ?? 0) + 1;
        }
        addBreakdown(player, 'hitbox', 'Hitbox tap', 0.01);
        break;
      }

      case "event-hitbox-batch": {
        if (!gs.activeEvent || gs.activeEvent.type !== "hitbox" || gs.activeEvent.phase !== "active") return;
        const taps = (msg as any).taps as number;
        if (!taps) return;
        console.log("[Host] received hitbox batch, taps:", taps, "from:", connId);
        gameLogger.event("host", "hitbox-batch-received", { taps, from: connId }, gs.phase);
        
        if (player.isEagle) {
          gs.activeEvent.eagleClicks[connId] = (gs.activeEvent.eagleClicks[connId] ?? 0) + taps;
        } else {
          gs.activeEvent.chickClicks[connId] = (gs.activeEvent.chickClicks[connId] ?? 0) + taps;
        }
        addBreakdown(player, 'hitbox', 'Hitbox tap', 0.1 * taps, taps);
        const sus = susPlayersRef.current.get(connId);
        if (sus) {
          sus.lastActivityAt = now;
          sus.lastPosition = player.position;
        }
        break;
      }

      // ── Event mock exam answer ──
      case "event-answer": {
        if (!gs.activeEvent || gs.activeEvent.type !== "mock-exam" || gs.activeEvent.phase !== "active") return;
        if (player.isEagle || isBotConnId(connId)) return;
        gs.activeEvent.mockExamSubmitted = gs.activeEvent.mockExamSubmitted ?? {};
        gs.activeEvent.mockExamAnswersByPlayer = gs.activeEvent.mockExamAnswersByPlayer ?? {};
        gs.activeEvent.mockExamCorrectByPlayer = gs.activeEvent.mockExamCorrectByPlayer ?? {};
        if (gs.activeEvent.mockExamSubmitted[connId]) return;
        gs.activeEvent.mockExamSubmitted[connId] = true;
        const questionNum = gs.activeEvent.questionNum ?? 1;
        const correct = normalizeMockExamAnswer(MOCK_ANSWER_KEY[questionNum] ?? "");
        const submittedAnswer = normalizeMockExamAnswer(msg.answer);
        const isCorrect = submittedAnswer.length > 0 && submittedAnswer === correct;
        gs.activeEvent.mockExamAnswersByPlayer[connId] = submittedAnswer;
        gs.activeEvent.mockExamCorrectByPlayer[connId] = isCorrect;
        gs.activeEvent.chickClicks[connId] = isCorrect ? 1 : 0;
        if (isCorrect) {
          gs.activeEvent.mockExamCorrectCount = Math.max(
            gs.activeEvent.mockExamCorrectCount ?? 0,
            Object.values(gs.activeEvent.mockExamCorrectByPlayer).filter(Boolean).length,
          );
          gs.activeEvent.result = "chick";
        }
        break;
      }

      case "crossy-crossing": {
        if (!gs.activeEvent || gs.activeEvent.type !== "crossy-road" || gs.activeEvent.phase !== "active") return;
        if (player.isEagle) return;
        
        const crossings = (msg as any).crossings as number;
        if (!gs.activeEvent.crossyPlayerStates) gs.activeEvent.crossyPlayerStates = {};
        if (!gs.activeEvent.crossyPlayerStates[connId]) {
          gs.activeEvent.crossyPlayerStates[connId] = { laneIndex: 0, xPosition: 200, crossings: 0, hitCount: 0 };
        }
        gs.activeEvent.crossyPlayerStates[connId].crossings = crossings;
        break;
      }

      // ── Crossy Road: chick hop ──
      case "crossy-hop": {
        if (!gs.activeEvent || gs.activeEvent.type !== "crossy-road" || gs.activeEvent.phase !== "active") return;
        if (player.isEagle) return;
        const csHop = gs.activeEvent.crossyPlayerStates?.[connId];
        if (!csHop) return;
        if (msg.direction === "up") {
          csHop.laneIndex = Math.min(csHop.laneIndex + 1, 6); // 6 = past finish
          if (csHop.laneIndex >= 6) {
            csHop.crossings++;
            csHop.laneIndex = 0;
            csHop.xPosition = CROSSY_FIELD_WIDTH / 2;
          }
        } else {
          csHop.laneIndex = Math.max(csHop.laneIndex - 1, 0);
        }
        const sus = susPlayersRef.current.get(connId);
        if (sus) {
          sus.lastActivityAt = now;
          sus.lastPosition = player.position;
        }
        // crossy hop scoring is handled at event end via crossings count
        break;
      }

      // ── Crossy Road: eagle action ──
      case "crossy-eagle-action": {
        if (!gs.activeEvent || gs.activeEvent.type !== "crossy-road" || gs.activeEvent.phase !== "active") return;
        if (!player.isEagle) return;
        if (msg.action === "speed-up") {
          gs.activeEvent.eagleSpeedBoost = Math.min((gs.activeEvent.eagleSpeedBoost ?? 1) + 0.2, 2.0);
        } else if (msg.action === "add-obstacle") {
          if (gs.activeEvent.crossyLanes && gs.activeEvent.crossyLanes.length > 0) {
            const randomLane = gs.activeEvent.crossyLanes[Math.floor(Math.random() * gs.activeEvent.crossyLanes.length)];
            randomLane.obstacles.push({
              x: Math.random() * CROSSY_FIELD_WIDTH,
              width: 5 + Math.random() * 5,
            });
          }
        }
        const sus = susPlayersRef.current.get(connId);
        if (sus) {
          sus.lastActivityAt = now;
          sus.lastPosition = player.position;
        }
        addBreakdown(player, 'crossy-road', 'Crossy Road', 2);
        break;
      }

      // ── Legacy final-exam submit path (disabled in favor of voting flow) ──
      case "answer-submit": {
        break;
      }

      // ── Player responded to "Are you still there?" prompt ──
      case "player-still-here": {
        const susPlayers = susPlayersRef.current;
        if (susPlayers.has(connId)) {
          const sus = susPlayers.get(connId)!;
          clearSusWarning(sus, now, {
            position: player.position,
            resetActivity: true,
          });
          sus.status = "checked";
          sus.lastPingAt = now;
        }
        break;
      }

      // ── Exam answer submission (voting system) ──
      case "exam-answer-submit": {
        if (player.isEagle) return;
        if (!gs.examState || gs.phase !== "exam") return;
        if (gs.examState.votingState) return;
        if (gs.examState.examSubmitterId !== connId) return;

        const maxAnswerLength = gs.examState.answerLength ?? 4;
        const submittedAnswer = msg.answer.toUpperCase().trim().slice(0, maxAnswerLength);
        if (!submittedAnswer) return;

        gs.examState.finalAnswer = submittedAnswer;
        gs.examState.anyAnswerSubmitted = true;
        setVotingDeadline(gs, now + EXAM_VOTING_DURATION);

        gs.examState.votingState = {
          startedAt: now,
          isVoting: true,
          submittedVotes: {},
        };

        broadcastRef.current({
          type: "exam-voting-start",
          submitterConnId: connId,
          displayAnswer: submittedAnswer,
          startedAt: now,
        });
        break;
      }

      // ── Exam vote submission ──
      case "exam-vote": {
        if (!gs.examState || !gs.examState.votingState) return;
        if (player.isEagle || isBotConnId(connId)) return;
        if (connId === gs.examState.examSubmitterId) return;
        if (!playersRef.current.has(connId)) return;

        if (!gs.examState.votingState.submittedVotes) {
          gs.examState.votingState.submittedVotes = {};
        }
        gs.examState.votingState.submittedVotes[connId] = msg.vote;

        // Broadcast that this player voted
        broadcastRef.current({
          type: "exam-vote-submitted",
          connId,
          vote: msg.vote,
        });

        const eligibleVoterIds = Array.from<PlayerGameState>(gs.playerStates.values())
          .filter(
            (p) =>
              !p.isEagle &&
              p.alive &&
              !isBotConnId(p.connId) &&
              p.connId !== gs.examState?.examSubmitterId &&
              playersRef.current.has(p.connId),
          )
          .map((p) => p.connId);
        const votes = gs.examState.votingState.submittedVotes;
        const allVoted = eligibleVoterIds.every((id) => votes[id] !== undefined);

        if (allVoted) {
          resolveVoting(gs, broadcastRef.current);
        }
        break;
      }

      // ── Player Leave (proper quit via X button) ──
      case "player-leave": {
        const susPlayers = susPlayersRef.current;
        const sus = susPlayers.get(connId) ?? createSusPlayer(connId, now, player.position);
        sus.status = "sus";
        sus.detectedAt = now;
        sus.promptShownAt = now;
        sus.properQuit = true;
        sus.disconnectReason = "proper-quit";
        susPlayers.set(connId, sus);
        replaceSusPlayerWithBot(gs, connId, playersRef.current, broadcastRef.current);
        break;
      }

      // ── Pong Response (client ping keepalive) ──
      case "pong": {
        const susPlayers = susPlayersRef.current;
        const player = gs.playerStates.get(connId);
        if (!player) break;

        if (!susPlayers.has(connId)) {
          susPlayers.set(connId, createSusPlayer(connId, now, player.position));
        } else {
          const sus = susPlayers.get(connId)!;
          sus.lastPingAt = now;
          sus.pingFailCount = 0;
          if (sus.disconnectReason === "ping-fail" || sus.status === "checked") {
            sus.status = "active";
            sus.detectedAt = 0;
            sus.promptShownAt = null;
            sus.disconnectReason = null;
            sus.pingWarningShownAt = null;
          }
        }
        break;
      }

      default:
        break;
    }
  }, []);

  // Keep ref in sync for bot AI access
  handleClientMessageRef.current = handleClientMessage;


  const onVideoComplete = useCallback(() => {
    const gs = gameStateRef.current as GameStateRef | null;
    if (!gs) return;

    gs.videoPlaying = null;
    setVideoPlaying(null);

    // Exam timeout video completed — resolve winner now (no replay)
    if (gs.pendingExamEndAfterVideo) {
      gs.pendingExamEndAfterVideo = false;
      gs.frozenAll = false;
      gs.frozenAllUntil = 0;
      startExamGameOverTransition(gs, gameModeRef.current as "1v3" | "2v6");
      return;
    }

    // Eagle hit video → start replay countdown (game stays frozen)
    if (gs.pendingEagleFreezeAfterVideo && (gs as any)._pendingReplayData) {
      const replayData = (gs as any)._pendingReplayData as ReplayData;
      delete (gs as any)._pendingReplayData;
      gs.replayCountdown = {
        secondsLeft: 3,
        replayData,
      };
      // Keep frozenAll = true, start countdown timer
      const startTime = Date.now();
      const countdownInterval = setInterval(() => {
        const gsInner = gameStateRef.current as GameStateRef | null;
        if (!gsInner || !gsInner.replayCountdown) {
          clearInterval(countdownInterval);
          return;
        }
        const elapsed = Date.now() - startTime;
        gsInner.replayCountdown.secondsLeft = Math.max(0, 3 - elapsed / 1000);
        if (elapsed >= REPLAY_COUNTDOWN_DURATION) {
          clearInterval(countdownInterval);
          onReplayCountdownComplete();
        }
      }, 50);
      return;
    }

    // Fallback (no replay data) — just unfreeze
    gs.frozenAll = false;
    gs.frozenAllUntil = 0;
    gs.pendingEagleFreezeAfterVideo = false;
  }, []);

  const onReplayCountdownComplete = useCallback(() => {
    const gs = gameStateRef.current as GameStateRef | null;
    if (!gs) return;
    const now = Date.now();

    gs.replayCountdown = null;
    gs.frozenAll = false;
    gs.frozenAllUntil = 0;

    if (gs.pendingEagleFreezeAfterVideo) {
      gs.pendingEagleFreezeAfterVideo = false;
      for (const [, p] of gs.playerStates) {
        if (p.isEagle) {
          p.frozen = true;
          p.frozenUntil = now + FREEZE_DURATION;
          p.attackCooldownUntil = now + FREEZE_DURATION + ATTACK_COOLDOWN;
          p.flyCooldownUntil = Math.max(p.flyCooldownUntil, now + FREEZE_DURATION + ATTACK_COOLDOWN);
        }
      }
    }

    // Post-video chick invincibility
    const until = now + POST_HIT_VIDEO_CHICK_INVINC_MS;
    for (const [, p] of gs.playerStates) {
      if (!p.isEagle && p.alive) {
        p.invincibleUntil = Math.max(p.invincibleUntil, until);
      }
    }

    // Check win condition
    const aliveChicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter((p) => !p.isEagle && p.alive);
    if (aliveChicks.length === 0) {
      endGame(gs, "eagle", broadcastRef.current);
    }
  }, []);

  /** Host-only: end final exam immediately; uses mode-based alive-count win condition. */
  const hostSkipExam = useCallback(() => {
    const gs = gameStateRef.current as GameStateRef | null;
    if (!gs || gs.phase !== "exam" || !gs.examState || gs.examState.answered) return;
    gs.examState.answered = true;
    broadcastRef.current({ type: "exam-skipped" });
    startExamGameOverTransition(gs, gameModeRef.current as "1v3" | "2v6");
  }, []);

  /** Host-only: end an active mystery-box event immediately (minigames). */
  const hostSkipActiveEvent = useCallback(() => {
    const gs = gameStateRef.current as GameStateRef | null;
    if (!gs || !gs.activeEvent) return;
    const now = Date.now();
    const ev = gs.activeEvent;
    if (ev.phase === "result") return;

    // Force the event into "active" and immediately expire it so the normal lifecycle resolves results.
    ev.phase = "active";
    ev.startedAt = Math.min(ev.startedAt, now - 3000);
    ev.endAt = now;
    gs.eventCountdown = 0;
    broadcastRef.current({ type: "event-skipped", eventType: ev.type });
    // Compute event result immediately so host/client transition is deterministic.
    updateGameState(0);
  }, []);

  // ─── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const togglePause = useCallback(() => {
    gamePausedRef.current = !gamePausedRef.current;
    return gamePausedRef.current;
  }, []);

  const toggleBotsPause = useCallback(() => {
    botsPausedRef.current = !botsPausedRef.current;
    return botsPausedRef.current;
  }, []);

  // ─── Public API ───────────────────────────────────────────────────────────────
  return {
    phase,
    snapshot,
    videoPlaying,
    assignments,
    startGame,
    handleClientMessage,
    onVideoComplete,
    hostDragBegin,
    hostDragUpdate,
    hostDragEnd,
    hostSkipExam,
    hostSkipActiveEvent,
    togglePause,
    toggleBotsPause,
    susPlayersRef,
  };
}
