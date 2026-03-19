import { useRef, useCallback, useEffect, useState } from 'react';
import type {
  GamePhase, GameStage, GameStateSnapshot,
  PlayerGameState, PlayerGameStateSerializable, PropSpawn, BuildingState,
  ClientMessage, PropType,
} from '@/lib/gameTypes';
import { serializePlayerState } from '@/lib/gameTypes';
import { PLAYER_COLORS, EAGLE_COLOR_INDICES } from '@/lib/playerColors';
import { STARTING_HEALTH, applyDamage, applyHeal, isDead, addSubGrades } from '@/lib/gradeSystem';
import {
  BUILDINGS, SPAWN_POINTS, EAGLE_SPAWN, DIAGONAL_PAIRS,
  checkCollision, checkOverlap, MAP_HALF,
} from '@/lib/gameplayMapData';
import type { PlayerState } from '@/hooks/useGameRoom';
import type { ChickColor } from '@/components/CharacterViewer';

const SPEED = 5;
const EAGLE_SPEED = 5;
const ATTACK_COOLDOWN = 5000;
const FREEZE_DURATION = 5000;
const EAGLE_AWAKE_DELAY = 5000;
const SPEED_BOOST_DURATION = 500;
const SPEED_BOOST_MULTIPLIER = 2;
const FLY_SPEED_MULTIPLIER = 3;
const PROP_SPAWN_INTERVAL_SPEED = [10000, 12000];
const PROP_SPAWN_INTERVAL_HEAL = 30000;
const SOCIAL_CIRCLE_THRESHOLD = 1.5;
const TIP_OBTAIN_DURATION = 7000;

const REVEAL_DURATION = 5000; // 5 sec reveal
const COUNTDOWN_DURATION = 3; // 3 sec countdown

interface UseGameLogicProps {
  players: Map<string, PlayerState>;
  broadcast: (msg: any) => void;
  gameMode: '1v3' | '2v6';
}

export function useGameLogic({ players, broadcast, gameMode }: UseGameLogicProps) {
  const [phase, setPhase] = useState<GamePhase>('lobby');
  const [assignments, setAssignments] = useState<Record<string, { colorIndex: number; isEagle: boolean; chickColor: ChickColor }>>({});

  // CRITICAL: Use a ref to always access the latest players Map
  // so the animation loop doesn't capture a stale reference
  const playersRef = useRef<Map<string, PlayerState>>(players);
  useEffect(() => { playersRef.current = players; }, [players]);

  const broadcastRef = useRef(broadcast);
  useEffect(() => { broadcastRef.current = broadcast; }, [broadcast]);

  const gameModeRef = useRef(gameMode);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);

  const gameStateRef = useRef<{
    phase: GamePhase;
    stage: GameStage;
    gameTime: number;
    countdownTime: number;
    eagleAwake: boolean;
    playerStates: Map<string, PlayerGameState>;
    frozenAll: boolean;
    frozenAllUntil: number;
    videoPlaying: 'hurt' | 'dead' | null;
    propSpawns: PropSpawn[];
    buildings: BuildingState[];
    winner: 'eagle' | 'chicks' | null;
    lastPropSpawnSpeed: number;
    lastPropSpawnHeal: number;
    propIdCounter: number;
    startTime: number;
    stageLabel: string;
  } | null>(null);

  const [snapshot, setSnapshot] = useState<GameStateSnapshot | null>(null);
  const [videoPlaying, setVideoPlaying] = useState<'hurt' | 'dead' | null>(null);
  const frameRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);

  // Start game
  const startGame = useCallback(() => {
    const currentPlayers = playersRef.current;
    const playerIds = Array.from(currentPlayers.keys());
    if (playerIds.length === 0) return;

    const currentMode = gameModeRef.current;

    // Role assignment differs by mode
    const assigns: Record<string, { colorIndex: number; isEagle: boolean; chickColor: ChickColor }> = {};

    if (currentMode === '1v3') {
      // 1v3: All players have good colors. Randomly pick 1 to become eagle.
      const eagleCount = 1;
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
      const eagleIds = new Set(shuffled.slice(0, eagleCount));

      // Pick a random eagle color (Black=0 or Gold=1) for the eagle
      const eagleColorIdx = EAGLE_COLOR_INDICES[Math.floor(Math.random() * EAGLE_COLOR_INDICES.length)];

      for (const id of playerIds) {
        if (eagleIds.has(id)) {
          assigns[id] = {
            colorIndex: eagleColorIdx,
            isEagle: true,
            chickColor: PLAYER_COLORS[eagleColorIdx].chickColor,
          };
        } else {
          const currentPlayer = currentPlayers.get(id);
          const ci = currentPlayer?.colorIndex ?? 2;
          assigns[id] = {
            colorIndex: ci,
            isEagle: false,
            chickColor: PLAYER_COLORS[ci].chickColor,
          };
        }
      }
    } else {
      // 2v6: Players already chose their colors (including Black/Gold as eagles)
      // No random assignment. Eagle = whoever has Black(0) or Gold(1)
      for (const id of playerIds) {
        const currentPlayer = currentPlayers.get(id);
        const ci = currentPlayer?.colorIndex ?? 2;
        const isEagle = EAGLE_COLOR_INDICES.includes(ci);
        assigns[id] = {
          colorIndex: ci,
          isEagle,
          chickColor: PLAYER_COLORS[ci].chickColor,
        };
      }
    }

    setAssignments(assigns);

    // Initialize game state
    const playerStates = new Map<string, PlayerGameState>();
    let spawnIdx = 0;
    const totalRevealAndCountdown = REVEAL_DURATION + COUNTDOWN_DURATION * 1000;

    for (const [id, assign] of Object.entries(assigns)) {
      const spawn = assign.isEagle ? EAGLE_SPAWN : SPAWN_POINTS[spawnIdx++ % SPAWN_POINTS.length];
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
          ? [{ type: 'fly', count: 3 }]
          : [{ type: 'speed', count: 0 }, { type: 'heal', count: 0 }],
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
      });
    }

    // Choose diagonal buildings for tips
    const diagPair = DIAGONAL_PAIRS[Math.floor(Math.random() * DIAGONAL_PAIRS.length)];
    const buildings: BuildingState[] = BUILDINGS.map((b) => ({
      id: b.id,
      position: b.position,
      hasTip: diagPair.includes(b.id),
      tipIndex: b.id === diagPair[0] ? 0 : 1,
      glowing: false,
      zoneHealth: 50,
      zoneActive: false,
      tipObtained: false,
      tipObtainedCount: 0,
    }));

    gameStateRef.current = {
      phase: 'reveal',
      stage: 0,
      gameTime: 0,
      countdownTime: COUNTDOWN_DURATION,
      eagleAwake: false,
      playerStates,
      frozenAll: false,
      frozenAllUntil: 0,
      videoPlaying: null,
      propSpawns: [],
      buildings,
      winner: null,
      lastPropSpawnSpeed: 0,
      lastPropSpawnHeal: 0,
      propIdCounter: 0,
      startTime: 0,
      stageLabel: 'Reveal...',
    };

    setPhase('reveal');

    // Send individual assignments to each client via broadcast
    broadcastRef.current({ type: 'game-start', assignments: assigns });

    // After 5 seconds, transition to countdown (3 sec)
    setTimeout(() => {
      if (!gameStateRef.current) return;
      gameStateRef.current.phase = 'countdown';
      gameStateRef.current.countdownTime = COUNTDOWN_DURATION;
      gameStateRef.current.startTime = Date.now();
      setPhase('countdown');
      broadcastRef.current({ type: 'phase-change', phase: 'countdown' });

      // Start game loop
      lastTickRef.current = performance.now();
      const tick = (time: number) => {
        const delta = (time - lastTickRef.current) / 1000;
        lastTickRef.current = time;
        updateGameState(delta);
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    }, REVEAL_DURATION);
  }, []); // No deps needed - we use refs

  // Main game loop update - uses refs so it never goes stale
  const updateGameState = useCallback((delta: number) => {
    const gs = gameStateRef.current;
    if (!gs || gs.winner) return;

    const now = Date.now();
    const currentPlayers = playersRef.current;
    const currentBroadcast = broadcastRef.current;
    const currentMode = gameModeRef.current;

    // Countdown phase
    if (gs.phase === 'countdown') {
      const elapsed = (now - gs.startTime) / 1000;
      gs.countdownTime = Math.max(0, COUNTDOWN_DURATION - elapsed);
      if (gs.countdownTime <= 0) {
        gs.phase = 'playing';
        gs.startTime = now;
        gs.gameTime = 0;
        gs.stageLabel = 'Touch every other chick!';
        setPhase('playing');
        currentBroadcast({ type: 'phase-change', phase: 'playing' });
      }
      doBroadcastState(gs, currentBroadcast);
      return;
    }

    if (gs.phase !== 'playing' && gs.phase !== 'exam') return;

    // Update game time
    if (!gs.frozenAll) {
      gs.gameTime += delta;
    }

    // Unfreeze checks
    if (gs.frozenAll && now > gs.frozenAllUntil) {
      gs.frozenAll = false;
      gs.videoPlaying = null;
      setVideoPlaying(null);
    }

    // Eagle awake check
    if (!gs.eagleAwake && gs.gameTime > 5) {
      gs.eagleAwake = true;
      for (const [, p] of gs.playerStates) {
        if (p.isEagle) {
          p.frozen = false;
          p.frozenUntil = 0;
        }
      }
    }

    // Update player positions from joystick input
    if (!gs.frozenAll) {
      for (const [connId, p] of gs.playerStates) {
        if (!p.alive) continue;
        if (p.frozen && now < p.frozenUntil) continue;
        if (p.frozen && now >= p.frozenUntil) {
          p.frozen = false;
        }

        // Speed multiplier expiry
        if (p.speedMultiplier > 1 && now > p.speedMultiplierUntil) {
          p.speedMultiplier = 1;
        }

        // Invincibility expiry
        if (p.invincibleUntil > 0 && now > p.invincibleUntil) {
          p.invincibleUntil = 0;
        }

        // READ FROM REF - this is the fix for stale joystick data
        const lobbyPlayer = currentPlayers.get(connId);
        if (!lobbyPlayer) continue;

        const jx = lobbyPlayer.joystick.x;
        const jy = -lobbyPlayer.joystick.y;
        const magnitude = Math.sqrt(jx * jx + jy * jy);

        if (magnitude > 0.05) {
          const moveAngle = Math.atan2(-jx, jy);
          const baseSpeed = p.isEagle ? EAGLE_SPEED : SPEED;
          const speed = magnitude * baseSpeed * p.speedMultiplier * delta;

          const newX = p.position.x + Math.sin(moveAngle) * speed * -1;
          const newZ = p.position.z + Math.cos(moveAngle) * speed * -1;

          const isFlying = p.isEagle && p.speedMultiplier >= FLY_SPEED_MULTIPLIER;
          if (isFlying || !checkCollision(newX, newZ, 0.5)) {
            p.position.x = Math.max(-MAP_HALF + 0.5, Math.min(MAP_HALF - 0.5, newX));
            p.position.z = Math.max(-MAP_HALF + 0.5, Math.min(MAP_HALF - 0.5, newZ));
          }

          p.facingAngle = moveAngle;
          p.survivalTime = gs.gameTime;
        }
      }
    }

    // Stage 1: Social Circle check
    if (gs.stage === 0) {
      const chicks = Array.from(gs.playerStates.values()).filter((p) => !p.isEagle && p.alive);
      for (let i = 0; i < chicks.length; i++) {
        for (let j = i + 1; j < chicks.length; j++) {
          if (checkOverlap(
            chicks[i].position.x, chicks[i].position.z,
            chicks[j].position.x, chicks[j].position.z,
            SOCIAL_CIRCLE_THRESHOLD
          )) {
            chicks[i].socialCircleMet.add(chicks[j].connId);
            chicks[j].socialCircleMet.add(chicks[i].connId);
          }
        }
      }

      const requiredMeets = chicks.length - 1;
      const allMet = chicks.every((c) => c.socialCircleMet.size >= requiredMeets);
      if (allMet && chicks.length > 0) {
        gs.stage = 1;
        gs.stageLabel = 'Go to glowing buildings to get Exam Tips!';
        for (const b of gs.buildings) {
          if (b.hasTip) {
            b.glowing = true;
            b.zoneActive = true;
          }
        }
      }
    }

    // Prop spawning
    if (gs.phase === 'playing') {
      const speedInterval = PROP_SPAWN_INTERVAL_SPEED[0] +
        Math.random() * (PROP_SPAWN_INTERVAL_SPEED[1] - PROP_SPAWN_INTERVAL_SPEED[0]);
      if (now - gs.lastPropSpawnSpeed > speedInterval) {
        gs.lastPropSpawnSpeed = now;
        const pos = {
          x: (Math.random() - 0.5) * (MAP_HALF * 1.5),
          z: (Math.random() - 0.5) * (MAP_HALF * 1.5),
        };
        if (!checkCollision(pos.x, pos.z, 1)) {
          gs.propSpawns.push({
            id: `prop-${gs.propIdCounter++}`,
            type: 'speed',
            position: pos,
            active: true,
          });
        }
      }

      if (now - gs.lastPropSpawnHeal > PROP_SPAWN_INTERVAL_HEAL) {
        gs.lastPropSpawnHeal = now;
        const pos = {
          x: (Math.random() - 0.5) * (MAP_HALF * 1.5),
          z: (Math.random() - 0.5) * (MAP_HALF * 1.5),
        };
        if (!checkCollision(pos.x, pos.z, 1)) {
          gs.propSpawns.push({
            id: `prop-${gs.propIdCounter++}`,
            type: 'heal',
            position: pos,
            active: true,
          });
        }
      }

      // Check prop pickups (chicks only)
      for (const [, p] of gs.playerStates) {
        if (!p.alive || p.isEagle) continue;
        for (const prop of gs.propSpawns) {
          if (!prop.active) continue;
          if (checkOverlap(p.position.x, p.position.z, prop.position.x, prop.position.z, 1.5)) {
            prop.active = false;
            const existing = p.props.find((pi) => pi.type === prop.type);
            if (existing) existing.count++;
            else p.props.push({ type: prop.type, count: 1 });
            p.actionScore += 1;
          }
        }
      }

      // Clean up inactive props
      gs.propSpawns = gs.propSpawns.filter((p) => p.active);
    }

    // Win condition check
    const aliveChicks = Array.from(gs.playerStates.values()).filter((p) => !p.isEagle && p.alive);
    const totalChicks = Array.from(gs.playerStates.values()).filter((p) => !p.isEagle).length;
    const eliminated = totalChicks - aliveChicks.length;

    if (currentMode === '1v3' && eliminated >= 3) {
      gs.winner = 'eagle';
      gs.phase = 'gameover';
      setPhase('gameover');
      currentBroadcast({ type: 'game-over', winner: 'eagle' });
    }

    doBroadcastState(gs, currentBroadcast);
  }, []); // No deps - uses refs

  const doBroadcastState = useCallback((gs: NonNullable<typeof gameStateRef.current>, bcast: (msg: any) => void) => {
    const playersObj: Record<string, PlayerGameStateSerializable> = {};
    for (const [id, p] of gs.playerStates) {
      playersObj[id] = serializePlayerState(p);
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
    };

    setSnapshot(snap);
    bcast({ type: 'game-state', state: snap });
  }, []);

  // Handle client messages
  const handleClientMessage = useCallback((connId: string, msg: ClientMessage) => {
    const gs = gameStateRef.current;
    if (!gs) return;
    const now = Date.now();
    const player = gs.playerStates.get(connId);
    if (!player || !player.alive) return;

    switch (msg.type) {
      case 'attack-press': {
        if (!player.isEagle) return;
        if (now < player.attackCooldownUntil) return;
        if (player.frozen) return;

        player.attackCooldownUntil = now + ATTACK_COOLDOWN;

        const hitChicks: PlayerGameState[] = [];
        for (const [, p] of gs.playerStates) {
          if (p.isEagle || !p.alive) continue;
          if (p.invincibleUntil > now) continue;

          let inProtectedZone = false;
          for (const b of gs.buildings) {
            if (b.zoneActive && !b.tipObtained) {
              const dx = p.position.x - b.position.x;
              const dz = p.position.z - b.position.z;
              if (Math.sqrt(dx * dx + dz * dz) < 2.5) {
                inProtectedZone = true;
                break;
              }
            }
          }
          if (inProtectedZone) continue;

          if (checkOverlap(player.position.x, player.position.z, p.position.x, p.position.z, 1.5)) {
            hitChicks.push(p);
          }
        }

        if (hitChicks.length > 0) {
          let mostSerious: 'hurt' | 'dead' = 'hurt';
          for (const chick of hitChicks) {
            const newHealth = applyDamage(chick.health);
            chick.damageTaken += chick.health - newHealth;
            chick.health = newHealth;
            player.damageDealt += chick.health;
            player.actionScore += 5;

            if (isDead(chick.health)) {
              chick.alive = false;
              chick.health = 0;
              mostSerious = 'dead';
              broadcastRef.current({ type: 'you-died' });
            }
          }

          gs.frozenAll = true;
          gs.frozenAllUntil = now + 3000;
          gs.videoPlaying = mostSerious;
          setVideoPlaying(mostSerious);

          player.frozen = true;
          player.frozenUntil = now + 3000 + FREEZE_DURATION;
          player.attackCooldownUntil = now + 3000 + FREEZE_DURATION + ATTACK_COOLDOWN;
        }
        break;
      }

      case 'prop-use': {
        const propItem = player.props.find((p) => p.type === msg.propType && p.count > 0);
        if (!propItem) return;
        propItem.count--;
        player.actionScore += 2;

        switch (msg.propType) {
          case 'speed':
            player.speedMultiplier = SPEED_BOOST_MULTIPLIER;
            player.speedMultiplierUntil = now + SPEED_BOOST_DURATION;
            break;
          case 'heal':
            if (player.health < STARTING_HEALTH) {
              player.health = applyHeal(player.health);
            }
            break;
          case 'fly':
            if (player.isEagle) {
              player.speedMultiplier = FLY_SPEED_MULTIPLIER;
              player.speedMultiplierUntil = now + SPEED_BOOST_DURATION;
            }
            break;
          case 'invincible':
            player.invincibleUntil = now + 3000;
            break;
        }
        break;
      }

      case 'hitbox-click': {
        if (!player.isEagle) return;
        for (const b of gs.buildings) {
          if (!b.zoneActive || b.tipObtained) continue;
          const dx = player.position.x - b.position.x;
          const dz = player.position.z - b.position.z;
          if (Math.sqrt(dx * dx + dz * dz) < 2.5) {
            b.zoneHealth = Math.max(0, b.zoneHealth - 1);
            player.actionScore += 0.5;
            if (b.zoneHealth <= 0) {
              b.zoneActive = false;
              b.glowing = false;
            }
          }
        }
        break;
      }

      case 'color-swap': {
        break;
      }

      default:
        break;
    }
  }, []);

  const onVideoComplete = useCallback(() => {
    setVideoPlaying(null);
    if (gameStateRef.current) {
      gameStateRef.current.videoPlaying = null;
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return {
    phase,
    snapshot,
    videoPlaying,
    assignments,
    startGame,
    handleClientMessage,
    onVideoComplete,
  };
}
