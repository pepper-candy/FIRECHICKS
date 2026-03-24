/**
 * Bot AI System — intermediate-skill bots for Eagle and Chick roles.
 * Called from useGameLogic game loop. Produces synthetic joystick + action messages.
 */

import type { PlayerGameState, ClientMessage, GameEvent } from '@/lib/gameTypes';
import type { BuildingState } from '@/lib/gameTypes';
import {
  BUILDINGS,
  ATTACK_OVERLAP_THRESHOLD,
  SOCIAL_CIRCLE_THRESHOLD,
  checkCollision,
  resolvePosition,
  isInProtectedZone,
  MAP_HALF,
  TIP_SHARE_RADIUS,
} from '@/lib/gameplayMapData';

// ─── Constants ──────────────────────────────────────────────
const BOT_REACTION_DELAY = 200; // ms between decisions
const EAGLE_SPEED_FACTOR = 0.9; // 90% speed nerf
const CHASE_TIMEOUT = 5000; // switch target after 5s
const CHASE_COOLDOWN = 3000; // avoid target for 3s after timeout
const FLEE_RADIUS = 12;
const JUKE_RADIUS = 6;
const JUKE_INTERVAL_MIN = 300;
const JUKE_INTERVAL_MAX = 700;
const PROP_USE_DELAY = 1000; // wait 1s before using newly available prop

export interface BotDecision {
  joystick: { x: number; y: number };
  messages: ClientMessage[];
}

interface BotState {
  lastDecisionTime: number;
  currentJoystick: { x: number; y: number };
  targetJoystick: { x: number; y: number };
  // Eagle-specific
  chaseTargetId: string | null;
  chaseStartTime: number;
  avoidTargetId: string | null;
  avoidUntil: number;
  // Chick-specific
  jukeAngle: number;
  lastJukeTime: number;
  nextJukeInterval: number;
  // Shared
  lastPropUseTime: number;
  socialPauseUntil: number;
}

const botStates = new Map<string, BotState>();

function getOrCreateState(connId: string): BotState {
  let s = botStates.get(connId);
  if (!s) {
    s = {
      lastDecisionTime: 0,
      currentJoystick: { x: 0, y: 0 },
      targetJoystick: { x: 0, y: 0 },
      chaseTargetId: null,
      chaseStartTime: 0,
      avoidTargetId: null,
      avoidUntil: 0,
      jukeAngle: 0,
      lastJukeTime: 0,
      nextJukeInterval: 500,
      lastPropUseTime: 0,
      socialPauseUntil: 0,
    };
    botStates.set(connId, s);
  }
  return s;
}

function dist(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function angleToTarget(from: { x: number; z: number }, to: { x: number; z: number }): number {
  return Math.atan2(to.x - from.x, -(to.z - from.z));
}

function joystickFromAngle(angle: number, magnitude: number = 1): { x: number; y: number } {
  return {
    x: -Math.sin(angle) * magnitude,
    y: Math.cos(angle) * magnitude,
  };
}

// Simple obstacle avoidance: if direct path is blocked, steer perpendicular
function avoidObstacles(
  from: { x: number; z: number },
  targetAngle: number,
  stepSize: number = 2,
): number {
  const testX = from.x + Math.sin(targetAngle) * -stepSize;
  const testZ = from.z + Math.cos(targetAngle) * -stepSize;
  if (!checkCollision(testX, testZ, 0.6)) return targetAngle;

  // Try +90° and -90°
  const left = targetAngle + Math.PI / 2;
  const lx = from.x + Math.sin(left) * -stepSize;
  const lz = from.z + Math.cos(left) * -stepSize;
  if (!checkCollision(lx, lz, 0.6)) return left;

  const right = targetAngle - Math.PI / 2;
  const rx = from.x + Math.sin(right) * -stepSize;
  const rz = from.z + Math.cos(right) * -stepSize;
  if (!checkCollision(rx, rz, 0.6)) return right;

  return targetAngle + Math.PI; // reverse
}

// ─── Eagle Bot ──────────────────────────────────────────────
function updateEagleBot(
  bot: PlayerGameState,
  allPlayers: Map<string, PlayerGameState>,
  now: number,
  stage: number,
  buildings: BuildingState[],
  activeEvent: GameEvent | null,
): BotDecision {
  const s = getOrCreateState(bot.connId);
  const messages: ClientMessage[] = [];

  // During events
  if (activeEvent) {
    if (activeEvent.phase === 'active') {
      if (activeEvent.type === 'hitbox') {
        // Click at ~8/s
        if (now - s.lastDecisionTime > 125) {
          messages.push({ type: 'event-hitbox-click' });
        }
      } else if (activeEvent.type === 'crossy-road') {
        // Use eagle actions on cooldown
        if (now - s.lastPropUseTime > 3000) {
          s.lastPropUseTime = now;
          messages.push({
            type: 'crossy-eagle-action',
            action: Math.random() > 0.5 ? 'speed-up' : 'add-obstacle',
          });
        }
      }
    }
    return { joystick: { x: 0, y: 0 }, messages };
  }

  if (bot.frozen || bot.cagedUntil > now) {
    return { joystick: { x: 0, y: 0 }, messages };
  }

  // Reaction delay check
  if (now - s.lastDecisionTime < BOT_REACTION_DELAY) {
    return { joystick: smoothJoystick(s), messages };
  }
  s.lastDecisionTime = now;

  // Find valid targets
  const chicks = Array.from(allPlayers.values()).filter(
    (p) => !p.isEagle && p.alive,
  );

  const validTargets = chicks.filter((c) => {
    if (c.invincibleUntil > now) return false;
    if (c.cagedUntil > now) return false;
    // Check if in protected zone
    const inZone = buildings.some(
      (b) => b.zoneActive && !b.tipObtained && isInProtectedZone(c.position.x, c.position.z, b.id),
    );
    if (inZone) return false;
    if (s.avoidTargetId === c.connId && now < s.avoidUntil) return false;
    return true;
  });

  if (validTargets.length === 0) {
    // Patrol center area
    const patrolAngle = (now / 3000) * Math.PI * 2;
    const px = Math.cos(patrolAngle) * 8;
    const pz = Math.sin(patrolAngle) * 8;
    const angle = avoidObstacles(bot.position, angleToTarget(bot.position, { x: px, z: pz }));
    s.targetJoystick = joystickFromAngle(angle, EAGLE_SPEED_FACTOR);
    return { joystick: smoothJoystick(s), messages };
  }

  // Pick target — nearest, with chase timeout
  validTargets.sort((a, b) => dist(bot.position, a.position) - dist(bot.position, b.position));
  let target = validTargets[0];

  // Chase timeout: if chasing same target > 5s, switch
  if (s.chaseTargetId === target.connId) {
    if (now - s.chaseStartTime > CHASE_TIMEOUT) {
      s.avoidTargetId = target.connId;
      s.avoidUntil = now + CHASE_COOLDOWN;
      s.chaseTargetId = null;
      if (validTargets.length > 1) target = validTargets[1];
    }
  } else {
    s.chaseTargetId = target.connId;
    s.chaseStartTime = now;
  }

  const d = dist(bot.position, target.position);

  // Attack when close
  if (d < ATTACK_OVERLAP_THRESHOLD && now >= bot.attackCooldownUntil) {
    messages.push({ type: 'attack-press' });
  }

  // Fly when far and off cooldown
  if (d > 15 && now >= bot.flyCooldownUntil && now >= bot.attackCooldownUntil) {
    const flyProp = bot.props.find((p) => p.type === 'fly' && p.count > 0);
    if (flyProp) {
      messages.push({ type: 'prop-use', propType: 'fly' });
    }
  }

  // Cage when off cooldown and > 2 alive chicks
  if (chicks.length >= 2 && now >= bot.cageCooldownUntil) {
    const cageProp = bot.props.find((p) => p.type === 'cage' && p.count > 0);
    if (cageProp && now - s.lastPropUseTime > PROP_USE_DELAY) {
      messages.push({ type: 'prop-use', propType: 'cage' });
      s.lastPropUseTime = now;
    }
  }

  // Interception: lead by velocity estimate (0.5s ahead)
  // We don't have velocity, so just move to current position
  const angle = avoidObstacles(
    bot.position,
    angleToTarget(bot.position, target.position),
  );
  s.targetJoystick = joystickFromAngle(angle, EAGLE_SPEED_FACTOR);

  // Hitbox clicking (zone building)
  if (stage >= 1) {
    for (const b of buildings) {
      if (b.zoneActive && !b.tipObtained && isInProtectedZone(bot.position.x, bot.position.z, b.id)) {
        if (now - s.lastPropUseTime > 200) {
          messages.push({ type: 'event-hitbox-click' });
          s.lastPropUseTime = now;
        }
      }
    }
  }

  return { joystick: smoothJoystick(s), messages };
}

// ─── Chick Bot ──────────────────────────────────────────────
function updateChickBot(
  bot: PlayerGameState,
  allPlayers: Map<string, PlayerGameState>,
  now: number,
  stage: number,
  buildings: BuildingState[],
  activeEvent: GameEvent | null,
  gameTime: number,
): BotDecision {
  const s = getOrCreateState(bot.connId);
  const messages: ClientMessage[] = [];

  // During events
  if (activeEvent) {
    if (activeEvent.phase === 'active') {
      if (activeEvent.type === 'hitbox') {
        if (now - s.lastDecisionTime > 167) { // ~6/s
          messages.push({ type: 'event-hitbox-click' });
        }
      } else if (activeEvent.type === 'crossy-road') {
        // Hop forward every ~1.5s
        if (now - s.lastPropUseTime > 1500) {
          s.lastPropUseTime = now;
          messages.push({ type: 'crossy-hop', direction: 'up' });
        }
      }
      // Skip mock exam
    }
    return { joystick: { x: 0, y: 0 }, messages };
  }

  if (bot.frozen || bot.cagedUntil > now) {
    return { joystick: { x: 0, y: 0 }, messages };
  }

  // Reaction delay
  if (now - s.lastDecisionTime < BOT_REACTION_DELAY) {
    return { joystick: smoothJoystick(s), messages };
  }
  s.lastDecisionTime = now;

  // Find nearest eagle
  const eagles = Array.from(allPlayers.values()).filter((p) => p.isEagle && p.alive);
  let nearestEagle: PlayerGameState | null = null;
  let eagleDist = Infinity;
  for (const e of eagles) {
    const d = dist(bot.position, e.position);
    if (d < eagleDist) {
      eagleDist = d;
      nearestEagle = e;
    }
  }

  const isFleeing = nearestEagle && eagleDist < FLEE_RADIUS;

  // ── Prop usage (threat-based) ──
  if (nearestEagle && now - s.lastPropUseTime > PROP_USE_DELAY) {
    // Speed when fleeing and eagle < 8
    if (eagleDist < 8) {
      const speedProp = bot.props.find((p) => p.type === 'speed' && p.count > 0);
      if (speedProp) {
        messages.push({ type: 'prop-use', propType: 'speed' });
        s.lastPropUseTime = now;
      }
    }
    // Teleport when eagle < 5
    if (eagleDist < 5 && !bot.teleportPending) {
      const teleProp = bot.props.find((p) => p.type === 'teleport' && p.count > 0);
      if (teleProp) {
        messages.push({ type: 'prop-use', propType: 'teleport' });
        // Immediately set target to opposite quadrant and confirm
        const targetX = -Math.sign(bot.position.x || 1) * (10 + Math.random() * 10);
        const targetZ = -Math.sign(bot.position.z || 1) * (10 + Math.random() * 10);
        messages.push({ type: 'teleport-set', x: targetX, z: targetZ });
        messages.push({ type: 'teleport-confirm' });
        s.lastPropUseTime = now;
      }
    }
    // Invincible when eagle < 4
    if (eagleDist < 4) {
      const invProp = bot.props.find((p) => p.type === 'invincible' && p.count > 0);
      if (invProp) {
        messages.push({ type: 'prop-use', propType: 'invincible' });
        s.lastPropUseTime = now;
      }
    }
    // Heal when health < 2.7
    if (bot.health < 2.7) {
      const healProp = bot.props.find((p) => p.type === 'heal' && p.count > 0);
      if (healProp) {
        messages.push({ type: 'prop-use', propType: 'heal' });
        s.lastPropUseTime = now;
      }
    }
  }

  // ── Flee mode ──
  if (isFleeing && nearestEagle) {
    const fleeAngle = angleToTarget(nearestEagle.position, bot.position);

    // Juke when very close
    if (eagleDist < JUKE_RADIUS && now - s.lastJukeTime > s.nextJukeInterval) {
      s.jukeAngle = (Math.random() - 0.5) * (Math.PI * 2 / 3); // ±60°
      s.lastJukeTime = now;
      s.nextJukeInterval = JUKE_INTERVAL_MIN + Math.random() * (JUKE_INTERVAL_MAX - JUKE_INTERVAL_MIN);
    }

    const finalAngle = avoidObstacles(bot.position, fleeAngle + s.jukeAngle);
    s.targetJoystick = joystickFromAngle(finalAngle, 1);
    return { joystick: smoothJoystick(s), messages };
  }

  // ── Stage-based behavior ──

  // Stage 0: Social Circle — move toward nearest un-met chick
  if (stage === 0) {
    const otherChicks = Array.from(allPlayers.values()).filter(
      (p) => !p.isEagle && p.alive && p.connId !== bot.connId && !bot.socialCircleMet.has(p.connId),
    );
    if (otherChicks.length > 0) {
      // Social pause: pause 0.5s on contact
      if (now < s.socialPauseUntil) {
        s.targetJoystick = { x: 0, y: 0 };
        return { joystick: smoothJoystick(s), messages };
      }
      otherChicks.sort((a, b) => dist(bot.position, a.position) - dist(bot.position, b.position));
      const target = otherChicks[0];
      const d = dist(bot.position, target.position);
      if (d < SOCIAL_CIRCLE_THRESHOLD) {
        s.socialPauseUntil = now + 500;
        s.targetJoystick = { x: 0, y: 0 };
      } else {
        const angle = avoidObstacles(bot.position, angleToTarget(bot.position, target.position));
        s.targetJoystick = joystickFromAngle(angle, 0.7);
      }
    } else {
      s.targetJoystick = { x: 0, y: 0 };
    }
    return { joystick: smoothJoystick(s), messages };
  }

  // Stage 1-2: Move toward nearest glowing building with tip bot doesn't have
  if (stage === 1 || stage === 2) {
    // Check for tip sharing opportunity (bot-to-bot)
    if (stage === 2 && (bot.tips[0] || bot.tips[1])) {
      const nearbyChicks = Array.from(allPlayers.values()).filter(
        (p) =>
          !p.isEagle &&
          p.alive &&
          p.connId !== bot.connId &&
          p.connId.startsWith('bot-') &&
          dist(bot.position, p.position) < TIP_SHARE_RADIUS,
      );
      for (const nc of nearbyChicks) {
        for (let ti = 0; ti < 2; ti++) {
          if (bot.tips[ti as 0 | 1] && !nc.tips[ti as 0 | 1]) {
            // Virtual tip share: directly set (handled in game loop)
            nc.tips[ti as 0 | 1] = true;
            nc.actionScore += 5;
          }
        }
      }
    }

    // Find building to go to
    const targetBuilding = buildings
      .filter((b) => b.hasTip && b.glowing && !bot.tips[b.tipIndex])
      .sort((a, b) => dist(bot.position, a.position) - dist(bot.position, b.position))[0];

    if (targetBuilding) {
      const d = dist(bot.position, targetBuilding.position);
      if (d < 4) {
        // Stay in zone (patience)
        s.targetJoystick = { x: 0, y: 0 };
      } else {
        const angle = avoidObstacles(bot.position, angleToTarget(bot.position, targetBuilding.position));
        s.targetJoystick = joystickFromAngle(angle, 0.8);
      }
    } else {
      // If bot has tips, move toward other chicks for sharing
      const needyChick = Array.from(allPlayers.values()).find(
        (p) =>
          !p.isEagle &&
          p.alive &&
          p.connId !== bot.connId &&
          (!p.tips[0] || !p.tips[1]),
      );
      if (needyChick && (bot.tips[0] || bot.tips[1])) {
        const angle = avoidObstacles(bot.position, angleToTarget(bot.position, needyChick.position));
        s.targetJoystick = joystickFromAngle(angle, 0.7);
      } else {
        // Wander
        const wanderAngle = (now / 5000) * Math.PI;
        const wx = Math.cos(wanderAngle) * 10;
        const wz = Math.sin(wanderAngle) * 10;
        const angle = avoidObstacles(bot.position, angleToTarget(bot.position, { x: wx, z: wz }));
        s.targetJoystick = joystickFromAngle(angle, 0.5);
      }
    }
    return { joystick: smoothJoystick(s), messages };
  }

  // Stage 3: Move toward nearest building (exam entry)
  if (stage === 3) {
    const nearest = [...BUILDINGS].sort(
      (a, b) => dist(bot.position, a.position) - dist(bot.position, b.position),
    )[0];
    if (nearest) {
      const d = dist(bot.position, nearest.position);
      if (d < 4) {
        s.targetJoystick = { x: 0, y: 0 };
      } else {
        const angle = avoidObstacles(bot.position, angleToTarget(bot.position, nearest.position));
        s.targetJoystick = joystickFromAngle(angle, 0.9);
      }
    }
    return { joystick: smoothJoystick(s), messages };
  }

  // Default: idle
  s.targetJoystick = { x: 0, y: 0 };
  return { joystick: smoothJoystick(s), messages };
}

// ─── Smooth joystick interpolation ──────────────────────────
function smoothJoystick(s: BotState): { x: number; y: number } {
  const lerp = 0.3;
  s.currentJoystick.x += (s.targetJoystick.x - s.currentJoystick.x) * lerp;
  s.currentJoystick.y += (s.targetJoystick.y - s.currentJoystick.y) * lerp;
  return { ...s.currentJoystick };
}

// ─── Public API ─────────────────────────────────────────────
export function updateBot(
  bot: PlayerGameState,
  allPlayers: Map<string, PlayerGameState>,
  now: number,
  stage: number,
  buildings: BuildingState[],
  activeEvent: GameEvent | null,
  gameTime: number,
): BotDecision {
  if (bot.isEagle) {
    return updateEagleBot(bot, allPlayers, now, stage, buildings, activeEvent);
  }
  return updateChickBot(bot, allPlayers, now, stage, buildings, activeEvent, gameTime);
}

export function isBot(connId: string): boolean {
  return connId.startsWith('bot-');
}

export function cleanupBotState(connId: string) {
  botStates.delete(connId);
}
