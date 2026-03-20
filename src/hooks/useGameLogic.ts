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
  PropType,
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
} from "@/lib/gameplayMapData";
import type { PlayerState } from "@/hooks/useGameRoom";
import type { ChickColor } from "@/components/CharacterViewer";

// ─── Constants ────────────────────────────────────────────────────────────────
const SPEED = 10;
const EAGLE_SPEED = 10;
const ATTACK_COOLDOWN = 5000;
const FREEZE_DURATION = 5000;
const EAGLE_AWAKE_DELAY = 5000;
const SPEED_BOOST_DURATION = 5000;
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
const MYSTERY_BOX_INTERVAL = 60000; // every 60 sec
const MYSTERY_BOX_ACTIVE_MIN = 10000;
const MYSTERY_BOX_ACTIVE_MAX = 15000;
const EVENT_HITBOX_DURATION = 10000; // 10s hitbox challenge
const EVENT_MOCK_DURATION = 30000; // 30s mock exam
const STAR_STUDENT_GRADE_BONUS = 5;
const REVEAL_DURATION = 7000;
const COUNTDOWN_DURATION = 3;

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

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface TipShare {
  connId: string;
  tipIndex: 0 | 1;
  code: string;
  cooldownUntil: number;
}

interface BuildingTimer {
  buildingId: number;
  startTime: number;
}

interface EagleZoneState {
  buildingId: number;
  entryHealth: number;
}

interface UseGameLogicProps {
  players: Map<string, PlayerState>;
  broadcast: (msg: any) => void;
  gameMode: "1v3" | "2v6";
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
  videoPlaying: "hurt" | "dead" | null;
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
  activeTipShares: Map<string, TipShare>;
  tipShareIdCounter: number;
  buildingTimers: Map<string, BuildingTimer>;
  eagleZoneStates: Map<string, EagleZoneState>;
  activeEvent: GameEvent | null;
  eventCountdown: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useGameLogic({ players, broadcast, gameMode }: UseGameLogicProps) {
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

  const gameStateRef = useRef<GameStateRef | null>(null);

  const [snapshot, setSnapshot] = useState<GameStateSnapshot | null>(null);
  const [videoPlaying, setVideoPlaying] = useState<"hurt" | "dead" | null>(null);
  const frameRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  // Used by the host to drag/teleport players by their name tags.
  const hostDragBackupRef = useRef<
    Map<string, { position: { x: number; z: number }; frozen: boolean; frozenUntil: number }>
  >(new Map());

  // ─── Start Game ──────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
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

      for (const id of playerIds) {
        if (id === eagleId) {
          assigns[id] = {
            colorIndex: eagleColorIdx,
            isEagle: true,
            chickColor: PLAYER_COLORS[eagleColorIdx].chickColor,
          };
        } else {
          const ci = currentPlayers.get(id)?.colorIndex ?? 2;
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
        props: assign.isEagle ? [{ type: "fly", count: 3 }] : [],
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
      activeTipShares: new Map(),
      tipShareIdCounter: 0,
      buildingTimers: new Map(),
      eagleZoneStates: new Map(),
      activeEvent: null,
      eventCountdown: 0,
    };

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
  }, []);

  // ─── Main Game Loop ───────────────────────────────────────────────────────────
  const updateGameState = useCallback((delta: number) => {
    const gs = gameStateRef.current as GameStateRef | null;
    if (!gs || gs.winner) return;

    const now = Date.now();
    const currentPlayers = playersRef.current as Map<string, PlayerState>;
    const currentBroadcast = broadcastRef.current as (msg: any) => void;
    const currentMode = gameModeRef.current as "1v3" | "2v6";

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
        setPhase("playing");
        currentBroadcast({ type: "phase-change", phase: "playing" });
      }
      doBroadcastState(gs, currentBroadcast);
      return;
    }

    if (gs.phase !== "playing" && gs.phase !== "exam") return;

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

        const jx = lobbyPlayer.joystick.x;
        const jy = -lobbyPlayer.joystick.y;
        const magnitude = Math.sqrt(jx * jx + jy * jy);
        const isFlyingNow = p.isEagle && p.speedMultiplier >= FLY_SPEED_MULTIPLIER;
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
      if (chicks.length > 0 && chicks.every((c) => c.socialCircleMet.size >= requiredMeets)) {
        gs.stage = 1;
        gs.stageLabel = "Get Exam Tips from glowing buildings!";
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
                  chick.actionScore += 10;

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
        startExam(gs, currentBroadcast, currentMode);
      }
    }

    // ── Exam timer countdown ──
    if (gs.phase === "exam" && gs.examState && !gs.examState.answered) {
      if (!gs.frozenAll) {
        gs.examState.timeRemaining -= delta;
        if (gs.examState.timeRemaining <= 0) {
          gs.examState.timeRemaining = 0;
          // Time's up — check alive chick count for result
          const aliveChicksExam = Array.from<PlayerGameState>(gs.playerStates.values()).filter((p) => !p.isEagle && p.alive);
          if (currentMode === "1v3") {
            if (aliveChicksExam.length >= 2) endGame(gs, "chicks", currentBroadcast);
            else if (aliveChicksExam.length === 1) endGame(gs, "draw", currentBroadcast);
            else endGame(gs, "eagle", currentBroadcast);
          } else {
            if (aliveChicksExam.length >= 3) endGame(gs, "chicks", currentBroadcast);
            else if (aliveChicksExam.length >= 1) endGame(gs, "draw", currentBroadcast);
            else endGame(gs, "eagle", currentBroadcast);
          }
        }
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
              // Chick gets 3 speed props
              box.collected = true;
              gs.lastMysteryBoxSpawn = now; // restart after claim
              const existing = p.props.find((pi) => pi.type === "speed");
              if (existing) existing.count += 3;
              else p.props.push({ type: "speed", count: 3 });
              p.actionScore += 3;
            } else {
              // Eagle triggers a random event
              box.triggered = true;
              gs.lastMysteryBoxSpawn = now; // restart after claim
              gs.frozenAll = true;
              gs.frozenAllUntil = now + 60000; // lifted when event ends
              const eventType = Math.random() < 0.5 ? "mock-exam" : "hitbox";
              const questionNum = Math.floor(Math.random() * 4) + 1;
              const eventDuration = eventType === "hitbox" ? EVENT_HITBOX_DURATION : EVENT_MOCK_DURATION;
              gs.activeEvent = {
                type: eventType,
                phase: "countdown",
                startedAt: now,
                endAt: now + 3000 + eventDuration,
                questionNum: eventType === "mock-exam" ? questionNum : undefined,
                chickClicks: {},
                eagleClicks: {},
                result: "pending",
              };
              gs.eventCountdown = 3;
              gs.stageLabel = eventType === "mock-exam" ? "🎲 Event: Mock Exam!" : "🎲 Event: Hitbox Challenge!";
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
        ev.endAt = now + (ev.type === "hitbox" ? EVENT_HITBOX_DURATION : EVENT_MOCK_DURATION);
      } else if (ev.phase === "active" && now >= ev.endAt) {
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
          const anyCorrect = (Object.values(ev.chickClicks) as number[]).some((v: number) => v > 0);
          if (!anyCorrect) {
            ev.result = "eagle";
            for (const [, p] of gs.playerStates) {
              if (!p.isEagle && p.alive) {
                p.health = addSubGrades(p.health, -2);
                // F-grade elimination
                if (isDead(p.health)) {
                  p.alive = false;
                  p.health = 0;
                  currentBroadcast({ type: "you-died", connId: p.connId });
                }
              }
            }
          } else {
            ev.result = "chick";
            // F-grade elimination after mock exam chick-win too
            for (const [, p] of gs.playerStates) {
              if (!p.isEagle && p.alive && isDead(p.health)) {
                p.alive = false;
                p.health = 0;
                currentBroadcast({ type: "you-died", connId: p.connId });
              }
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

        // Clear event after 3 more seconds
        setTimeout(() => {
          const gsCleanup = gameStateRef.current as GameStateRef | null;
          if (gsCleanup) {
            gsCleanup.frozenAll = false;
            gsCleanup.frozenAllUntil = 0;
            gsCleanup.activeEvent = null;
            gsCleanup.stageLabel = getStageLabel(gsCleanup.stage as number);
          }
        }, 3000);
      }
    }

    // ── Win condition check: only auto-end when ALL chicks dead ──
    const aliveChicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter((p) => !p.isEagle && p.alive);

    if (!gs.winner) {
      if (aliveChicks.length === 0) {
        endGame(gs, "eagle", currentBroadcast);
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

  function startExam(gs: GameStateRef, bcast: (msg: any) => void, mode: "1v3" | "2v6") {
    gs.examStarted = true;
    gs.phase = "exam";
    setPhase("exam");

    const aliveChicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter((p) => !p.isEagle && p.alive);
    const questionNum = Math.floor(Math.random() * 4) + 1;
    const timer = mode === "1v3" ? EXAM_TIMER_1V3 : EXAM_TIMER_2V6;

    // Pick 1 random layer-1 holder
    const shuffled = [...aliveChicks].sort(() => Math.random() - 0.5);
    const layer1Player = shuffled[0];
    const layer2Players = shuffled.slice(1);

    gs.examState = {
      questionNum,
      category: "Final",
      timeRemaining: timer,
      layer1ConnId: layer1Player.connId,
      layer2ConnIds: layer2Players.map((p) => p.connId),
      answered: false,
      layer1Dead: false,
    };
    gs.stageLabel = "FINAL EXAM — Solve together!";

    // Build per-client assignments
    const examAssigns: Record<string, { layer: "1" | "2"; questionNum: number; category: "Final" }> = {};
    examAssigns[layer1Player.connId] = { layer: "1", questionNum, category: "Final" };
    for (const p of layer2Players) {
      examAssigns[p.connId] = { layer: "2", questionNum, category: "Final" };
    }
    // Eagles don't get a layer
    for (const [, p] of gs.playerStates) {
      if (p.isEagle) examAssigns[p.connId] = { layer: "2", questionNum: 0, category: "Final" };
    }

    bcast({ type: "phase-change", phase: "exam" });
    bcast({ type: "exam-start", assignments: examAssigns });
  }

  function endGame(gs: GameStateRef, winner: "eagle" | "chicks" | "draw", bcast: (msg: any) => void) {
    gs.winner = winner;
    gs.phase = "gameover";
    setPhase("gameover");
    cancelAnimationFrame(frameRef.current);
    bcast({ type: "game-over", winner });
  }

  // ─── Broadcast state ────────────────────────────────────────────────────────
  const doBroadcastState = useCallback((gs: GameStateRef, bcast: (msg: any) => void) => {
    const now = Date.now();
    const playersObj: Record<string, PlayerGameStateSerializable> = {};
    for (const [id, p] of gs.playerStates) {
      playersObj[id] = serializePlayerState(p);
    }
    const tipObtainTimers: Record<string, { buildingId: number; remainingMs: number }> = {};
    for (const [timerKey, t] of gs.buildingTimers.entries()) {
      const connId = timerKey.replace("-building", "");
      tipObtainTimers[connId] = {
        buildingId: t.buildingId,
        remainingMs: Math.max(0, TIP_OBTAIN_DURATION - (now - t.startTime)),
      };
    }

    const snap: GameStateSnapshot = {
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
      activeEvent: gs.activeEvent,
      tipObtainTimers,
    };

    setSnapshot(snap);
    bcast({ type: "game-state", state: snap });
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

  // ─── Handle Client Messages ───────────────────────────────────────────────────
  const handleClientMessage = useCallback((connId: string, msg: ClientMessage) => {
    const gs = gameStateRef.current as GameStateRef | null;
    if (!gs) return;
    const now = Date.now();
    const player = gs.playerStates.get(connId) as PlayerGameState | undefined;
    if (!player || !player.alive) return;

    switch (msg.type) {
      // ── Attack ──
      case "attack-press": {
        if (!player.isEagle) return;
        if (now < player.attackCooldownUntil) return;
        if (player.frozen) return;

        player.attackCooldownUntil = now + ATTACK_COOLDOWN;
        player.isAttacking = true;
        player.attackAnimUntil = now + ATTACK_ANIM_DURATION;

        const hitChicks: PlayerGameState[] = [];
        for (const [, p] of gs.playerStates) {
          if (p.isEagle || !p.alive) continue;
          if (p.invincibleUntil > now) continue;

          // Check if chick is fully inside a protected zone
          const inZone = gs.buildings.some(
            (b) => b.zoneActive && !b.tipObtained && isInProtectedZone(p.position.x, p.position.z, b.id),
          );
          if (inZone) continue;

          if (
            checkOverlap(player.position.x, player.position.z, p.position.x, p.position.z, ATTACK_OVERLAP_THRESHOLD)
          ) {
            hitChicks.push(p);
          }
        }

        if (hitChicks.length > 0) {
          let mostSerious: "hurt" | "dead" = "hurt";
          for (const chick of hitChicks) {
            const newHealth = applyDamage(chick.health);
            const dmg = chick.health - newHealth;
            chick.damageTaken += dmg;
            player.damageDealt += dmg;
            player.actionScore += 5;
            chick.health = newHealth;

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

              broadcastRef.current({ type: "you-died", connId: chick.connId });
            }
          }

          gs.frozenAll = true;
          gs.frozenAllUntil = now + 60000; // lifted by video completion
          gs.videoPlaying = mostSerious;
          gs.pendingEagleFreezeAfterVideo = true;
          setVideoPlaying(mostSerious);
        }
        break;
      }

      // ── Prop use ──
      case "prop-use": {
        // Props can be used while moving — no frozen check
        const propItem = player.props.find((p) => p.type === msg.propType && p.count > 0);
        if (!propItem) return;
        propItem.count--;
        player.actionScore += 2;

        switch (msg.propType as PropType) {
          case "speed":
            player.speedMultiplier = SPEED_BOOST_MULTIPLIER;
            player.speedMultiplierUntil = now + SPEED_BOOST_DURATION;
            break;
          case "heal":
            if (player.health < STARTING_HEALTH) player.health = applyHeal(player.health);
            break;
          case "fly":
            if (player.isEagle) {
              propItem.count++; // undo the decrement above — unlimited
              if (now < player.flyCooldownUntil) return; // on cooldown
              if (now < player.speedMultiplierUntil && player.speedMultiplier >= FLY_SPEED_MULTIPLIER) return; // still flying
              player.isAttacking = true;
              player.attackAnimUntil = now + FLY_DURATION + 200;
              player.speedMultiplier = FLY_SPEED_MULTIPLIER;
              player.speedMultiplierUntil = now + FLY_DURATION;
              player.flyCooldownUntil = now + FLY_COOLDOWN;
            }
            break;
          case "invincible":
            player.invincibleUntil = now + 3000;
            break;
        }
        break;
      }

      // ── Hitbox click (eagle attacking building zone) ──
      case "hitbox-click": {
        if (!player.isEagle) return;
        for (const b of gs.buildings) {
          if (!b.zoneActive || b.tipObtained) continue;
          if (isInProtectedZone(player.position.x, player.position.z, b.id)) {
            b.zoneHealth = Math.max(0, b.zoneHealth - 1);
            player.actionScore += 0.5;
            if (b.zoneHealth <= 0) {
              // Zone broken: tips remain obtainable, just unprotected
              b.zoneActive = false;
              b.glowing = false;
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

        // Check if it's a tip share code
        const tipShare = Array.from<TipShare>(gs.activeTipShares.values()).find((ts: TipShare) => ts.code === data);
        if (tipShare) {
          if (tipShare.connId === connId) return; // can't scan own tip
          if (player.tips[tipShare.tipIndex]) return; // already have it
          if (now < tipShare.cooldownUntil) return; // on cooldown

          player.tips[tipShare.tipIndex] = true;
          player.actionScore += 5;
          tipShare.cooldownUntil = now + TIP_QR_COOLDOWN;

          // Check if all alive chicks now have both tips
          if (gs.stage === 2) {
            const aliveChicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter(
              (p) => !p.isEagle && p.alive,
            );
            if (aliveChicks.length > 0 && aliveChicks.every((c) => c.tips[0] && c.tips[1])) {
              gs.stage = 3;
              gs.stageLabel = "Run to any building to start the Final Exam!";
            }
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
            player.actionScore += 1;
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

        // Generate a unique tip share code
        const code = `FIRETIP-${tipIndex}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const tipKey = `${connId}-${tipIndex}`;
        gs.activeTipShares.set(tipKey, {
          connId,
          tipIndex,
          code,
          cooldownUntil: 0,
        });

        player.tipShareCooldownUntil = now + TIP_QR_COOLDOWN;
        broadcastRef.current({ type: "tip-qr", forConnId: connId, code, tipIndex });
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
        player.actionScore += 0.1;
        break;
      }

      // ── Event mock exam answer ──
      case "event-answer": {
        if (!gs.activeEvent || gs.activeEvent.type !== "mock-exam" || gs.activeEvent.phase !== "active") return;
        if (player.isEagle) return;
        const questionNum = gs.activeEvent.questionNum ?? 1;
        const correct = MOCK_ANSWER_KEY[questionNum];
        if (msg.answer.toUpperCase().trim() === correct) {
          // First correct answer = +1 sub-grade for this player
          if (!gs.activeEvent.chickClicks[connId]) {
            gs.activeEvent.chickClicks[connId] = 1;
            player.health = addSubGrades(player.health, 1);
            player.actionScore += 5;
          }
        }
        break;
      }

      // ── Answer submit (exam) ──
      case "answer-submit": {
        if (player.isEagle) return;
        if (!gs.examState || gs.examState.answered) return;
        if (gs.phase !== "exam") return;

        const correct = FINAL_ANSWER_KEY[gs.examState.questionNum];
        if (msg.answer.toUpperCase().trim() === correct) {
          gs.examState.answered = true;
          player.actionScore += 20;
          endGame(gs, "chicks", broadcastRef.current);
        } else {
          // Wrong: -1 grade to all alive players
          for (const [, p] of gs.playerStates) {
            if (p.alive) {
              p.health = addSubGrades(p.health, -1);
              if (isDead(p.health)) {
                p.alive = false;
                p.health = 0;
                broadcastRef.current({ type: "you-died", connId: p.connId });
              }
            }
          }
        }
        break;
      }

      default:
        break;
    }
  }, []);

  // ─── Video complete → post-video eagle freeze ──────────────────────────────
  const onVideoComplete = useCallback(() => {
    const gs = gameStateRef.current as GameStateRef | null;
    if (!gs) return;
    const now = Date.now();

    gs.frozenAll = false;
    gs.frozenAllUntil = 0;
    gs.videoPlaying = null;
    setVideoPlaying(null);

    if (gs.pendingEagleFreezeAfterVideo) {
      gs.pendingEagleFreezeAfterVideo = false;
      for (const [, p] of gs.playerStates) {
        if (p.isEagle) {
          p.frozen = true;
          p.frozenUntil = now + FREEZE_DURATION;
          p.attackCooldownUntil = now + FREEZE_DURATION + ATTACK_COOLDOWN;
        }
      }
    }

    // Check win condition: only auto-end when ALL chicks dead
    const aliveChicks = Array.from<PlayerGameState>(gs.playerStates.values()).filter((p) => !p.isEagle && p.alive);
    if (aliveChicks.length === 0) {
      endGame(gs, "eagle", broadcastRef.current);
    }
  }, []);

  // ─── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
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
  };
}
