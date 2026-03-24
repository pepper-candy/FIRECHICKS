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
const DANGER_RADIUS = 7;
const JUKE_RADIUS = 6;
const JUKE_INTERVAL_MIN = 300;
const JUKE_INTERVAL_MAX = 700;
const PROP_USE_DELAY = 1000; // wait 1s before using newly available prop
const TELEPORT_MARGIN = 2;
const BUILDING_APPROACH_OFFSET = 3.8;

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

function joystickToTarget(
  from: { x: number; z: number },
  to: { x: number; z: number },
  magnitude: number = 1,
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.001) return { x: 0, y: 0 };
  // Movement model in useGameLogic:
  //   jy = -joystick.y
  //   angle = atan2(-jx, jy)
  //   world dx = -sin(angle), world dz = -cos(angle)
  // This resolves to: joystick.x should follow +dx, joystick.y should follow +dz.
  return {
    x: (dx / len) * magnitude,
    y: (dz / len) * magnitude,
  };
}

function buildingApproachPoint(position: { x: number; z: number }): { x: number; z: number } {
  const toCenterX = -Math.sign(position.x || 1);
  const toCenterZ = -Math.sign(position.z || 1);
  return {
    x: position.x + toCenterX * BUILDING_APPROACH_OFFSET,
    z: position.z + toCenterZ * BUILDING_APPROACH_OFFSET,
  };
}

// Simple obstacle avoidance in joystick space.
function avoidObstacles(
  from: { x: number; z: number },
  targetJoy: { x: number; y: number },
  stepSize: number = 2,
): { x: number; y: number } {
  const len = Math.hypot(targetJoy.x, targetJoy.y);
  if (len < 0.001) return targetJoy;
  const nx = targetJoy.x / len;
  const ny = targetJoy.y / len;

  const testX = from.x + nx * stepSize;
  const testZ = from.z + (-ny) * stepSize;
  if (!checkCollision(testX, testZ, 0.6)) return targetJoy;

  // Try rotating joystick vector ±90°.
  const left = { x: -ny * len, y: nx * len };
  const lx = from.x + (left.x / len) * stepSize;
  const lz = from.z + (-(left.y / len)) * stepSize;
  if (!checkCollision(lx, lz, 0.6)) return left;

  const right = { x: ny * len, y: -nx * len };
  const rx = from.x + (right.x / len) * stepSize;
  const rz = from.z + (-(right.y / len)) * stepSize;
  if (!checkCollision(rx, rz, 0.6)) return right;

  // Let core movement resolver handle sliding instead of hard-reversing/jittering.
  return targetJoy;
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
    return true;
  });

  if (validTargets.length === 0) {
    // Patrol center area
    const patrolAngle = (now / 3000) * Math.PI * 2;
    const px = Math.cos(patrolAngle) * 8;
    const pz = Math.sin(patrolAngle) * 8;
    const joy = joystickToTarget(bot.position, { x: px, z: pz }, EAGLE_SPEED_FACTOR);
    s.targetJoystick = avoidObstacles(bot.position, joy);
    return { joystick: smoothJoystick(s), messages };
  }

  // Pick target — always nearest (no chase-timeout retargeting)
  validTargets.sort((a, b) => dist(bot.position, a.position) - dist(bot.position, b.position));
  const target = validTargets[0];

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

  // Move toward nearest valid chick directly.
  const chaseJoy = joystickToTarget(bot.position, target.position, EAGLE_SPEED_FACTOR);
  s.targetJoystick = avoidObstacles(bot.position, chaseJoy);

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
        // Immediately set target to opposite quadrant and confirm.
        const minAbs = 10;
        const maxAbs = MAP_HALF - TELEPORT_MARGIN;
        const targetX = -Math.sign(bot.position.x || 1) * (minAbs + Math.random() * Math.max(0, maxAbs - minAbs));
        const targetZ = -Math.sign(bot.position.z || 1) * (minAbs + Math.random() * Math.max(0, maxAbs - minAbs));
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
  if (isFleeing && nearestEagle && eagleDist < DANGER_RADIUS) {
    const fleeJoy = joystickToTarget(nearestEagle.position, bot.position, 1);

    // Juke when very close
    if (eagleDist < JUKE_RADIUS && now - s.lastJukeTime > s.nextJukeInterval) {
      s.jukeAngle = (Math.random() - 0.5) * (Math.PI * 2 / 3); // ±60°
      s.lastJukeTime = now;
      s.nextJukeInterval = JUKE_INTERVAL_MIN + Math.random() * (JUKE_INTERVAL_MAX - JUKE_INTERVAL_MIN);
    }

    const jukeJoy = {
      x: fleeJoy.x * Math.cos(s.jukeAngle) - fleeJoy.y * Math.sin(s.jukeAngle),
      y: fleeJoy.x * Math.sin(s.jukeAngle) + fleeJoy.y * Math.cos(s.jukeAngle),
    };
    s.targetJoystick = avoidObstacles(bot.position, jukeJoy);
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
        const joy = joystickToTarget(bot.position, target.position, 0.7);
        s.targetJoystick = avoidObstacles(bot.position, joy);
      }
    } else {
      s.targetJoystick = { x: 0, y: 0 };
    }
    return { joystick: smoothJoystick(s), messages };
  }

  // Stage 1-2: Move toward nearest glowing building with tip bot doesn't have
  if (stage === 1 || stage === 2) {
    // Trigger normal tip-share flow to avoid mutating player state directly.
    if (stage === 2 && (bot.tips[0] || bot.tips[1]) && now >= bot.tipShareCooldownUntil) {
      const nearbyNeedy = Array.from(allPlayers.values()).some(
        (p) =>
          !p.isEagle &&
          p.alive &&
          p.connId !== bot.connId &&
          (!p.tips[0] || !p.tips[1]) &&
          dist(bot.position, p.position) < TIP_SHARE_RADIUS,
      );
      if (nearbyNeedy) {
        if (bot.tips[0]) messages.push({ type: 'tip-request', tipIndex: 0 });
        if (bot.tips[1]) messages.push({ type: 'tip-request', tipIndex: 1 });
      }
    }

    // Find building to go to
    const targetBuilding = buildings
      .filter((b) => b.hasTip && b.glowing && !bot.tips[b.tipIndex])
      .sort((a, b) => dist(bot.position, a.position) - dist(bot.position, b.position))[0];

    if (targetBuilding) {
      const approach = buildingApproachPoint(targetBuilding.position);
      const d = dist(bot.position, approach);
      if (d < 4) {
        // Stay in zone (patience)
        s.targetJoystick = { x: 0, y: 0 };
      } else {
        const targetJoy = joystickToTarget(bot.position, approach, 0.8);
        const fleeWeight = nearestEagle && eagleDist < FLEE_RADIUS ? Math.max(0, Math.min(0.35, (FLEE_RADIUS - eagleDist) / FLEE_RADIUS * 0.35)) : 0;
        const fleeJoy = nearestEagle ? joystickToTarget(nearestEagle.position, bot.position, 0.8) : targetJoy;
        const mixedJoy = {
          x: targetJoy.x * (1 - fleeWeight) + fleeJoy.x * fleeWeight,
          y: targetJoy.y * (1 - fleeWeight) + fleeJoy.y * fleeWeight,
        };
        s.targetJoystick = avoidObstacles(bot.position, mixedJoy);
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
        const joy = joystickToTarget(bot.position, needyChick.position, 0.7);
        s.targetJoystick = avoidObstacles(bot.position, joy);
      } else {
        // Wander
        const wanderAngle = (now / 5000) * Math.PI;
        const wx = Math.cos(wanderAngle) * 10;
        const wz = Math.sin(wanderAngle) * 10;
        const joy = joystickToTarget(bot.position, { x: wx, z: wz }, 0.5);
        s.targetJoystick = avoidObstacles(bot.position, joy);
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
      const approach = buildingApproachPoint(nearest.position);
      const d = dist(bot.position, approach);
      if (d < 4) {
        s.targetJoystick = { x: 0, y: 0 };
      } else {
        const joy = joystickToTarget(bot.position, approach, 0.9);
        s.targetJoystick = avoidObstacles(bot.position, joy);
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
