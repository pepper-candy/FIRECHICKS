/**
 * Bot AI System — intermediate-skill bots for Eagle and Chick roles.
 * Called from useGameLogic game loop. Produces synthetic joystick + action messages.
 */

import type { PlayerGameState, ClientMessage, GameEvent, MysteryBox } from '@/lib/gameTypes';
import type { BuildingState } from '@/lib/gameTypes';
import {
  BUILDINGS,
  ATTACK_OVERLAP_THRESHOLD,
  SOCIAL_CIRCLE_THRESHOLD,
  checkCollision,
  getAdjacentBuilding,
  isInProtectedZone,
  MAP_HALF,
  TIP_SHARE_RADIUS,
  ZONE_RADIUS,
} from '@/lib/gameplayMapData';

// ─── Constants ──────────────────────────────────────────────
const BOT_REACTION_DELAY = 200; // ms between decisions
const EAGLE_SPEED_FACTOR = 0.9; // 90% speed nerf
const FLEE_RADIUS = 12;
const DANGER_RADIUS = 7;
const JUKE_RADIUS = 6;
const JUKE_INTERVAL_MIN = 300;
const JUKE_INTERVAL_MAX = 700;
const PROP_USE_DELAY = 1000; // wait 1s before using newly available prop
const TELEPORT_MARGIN = 2;
const BUILDING_APPROACH_OFFSET = 3.8;
/** Throttle for eagle `hitbox-click` on building shields (independent of movement reaction delay). */
const EAGLE_ZONE_HITBOX_INTERVAL_MS = 143;

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
  lastZoneHitboxClickAt: number;
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
      lastZoneHitboxClickAt: 0,
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

const CHICK_BODY_RADIUS = 0.6;
const CHICK_RAY_STEP = 0.7;
const CHICK_RAY_MAX = 5.5;
/** Distance from map edge at which chick bots bias back toward center. */
const CHICK_EDGE_SOFT = 8;

function clearanceAlongRay(
  fromX: number,
  fromZ: number,
  dirX: number,
  dirZ: number,
  maxDist: number,
): number {
  let d = CHICK_RAY_STEP;
  while (d <= maxDist) {
    const x = fromX + dirX * d;
    const z = fromZ + dirZ * d;
    if (checkCollision(x, z, CHICK_BODY_RADIUS)) return Math.max(0, d - CHICK_RAY_STEP);
    d += CHICK_RAY_STEP;
  }
  return maxDist;
}

function boundaryRepulsionJoy(x: number, z: number): { x: number; y: number } {
  const lim = MAP_HALF - CHICK_BODY_RADIUS - 0.5;
  let fx = 0;
  let fz = 0;
  if (x > lim - CHICK_EDGE_SOFT) fx -= (x - (lim - CHICK_EDGE_SOFT)) / CHICK_EDGE_SOFT;
  if (x < -lim + CHICK_EDGE_SOFT) fx -= (x - (-lim + CHICK_EDGE_SOFT)) / CHICK_EDGE_SOFT;
  if (z > lim - CHICK_EDGE_SOFT) fz -= (z - (lim - CHICK_EDGE_SOFT)) / CHICK_EDGE_SOFT;
  if (z < -lim + CHICK_EDGE_SOFT) fz -= (z - (-lim + CHICK_EDGE_SOFT)) / CHICK_EDGE_SOFT;
  const len = Math.hypot(fx, fz);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: fx / len, y: fz / len };
}

function rayScanChickSteer(
  from: { x: number; z: number },
  desiredJoy: { x: number; y: number },
  magnitude: number,
): { x: number; y: number } {
  const len0 = Math.hypot(desiredJoy.x, desiredJoy.y);
  if (len0 < 0.05) return desiredJoy;
  const wx0 = desiredJoy.x / len0;
  const wz0 = desiredJoy.y / len0;
  const baseAngle = Math.atan2(wx0, wz0);
  const offsets = [0, -0.45, 0.45, -0.9, 0.9, -1.35, 1.35, Math.PI];
  let bestJoy = desiredJoy;
  let bestScore = -1;
  for (const off of offsets) {
    const a = baseAngle + off;
    const wx = Math.sin(a);
    const wz = Math.cos(a);
    const clear = clearanceAlongRay(from.x, from.z, wx, wz, CHICK_RAY_MAX);
    if (clear > bestScore) {
      bestScore = clear;
      bestJoy = { x: wx * magnitude, y: wz * magnitude };
    }
  }
  return bestJoy;
}

/** Ray-scan + edge/corner escape, then one-step obstacle slide (chick bots only). */
function chickSteer(
  from: { x: number; z: number },
  desiredJoy: { x: number; y: number },
  moveMag: number,
): { x: number; y: number } {
  const edge = boundaryRepulsionJoy(from.x, from.z);
  const edgeLen = Math.hypot(edge.x, edge.y);
  let blended = desiredJoy;
  if (edgeLen > 0.05) {
    blended = {
      x: desiredJoy.x * 0.55 + edge.x * moveMag * 0.45,
      y: desiredJoy.y * 0.55 + edge.y * moveMag * 0.45,
    };
  }
  const cornerDist = Math.min(MAP_HALF - Math.abs(from.x), MAP_HALF - Math.abs(from.z));
  if (cornerDist < 5) {
    const cx = -from.x;
    const cz = -from.z;
    const cLen = Math.hypot(cx, cz);
    if (cLen > 0.1) {
      blended = {
        x: blended.x * 0.35 + (cx / cLen) * moveMag * 0.65,
        y: blended.y * 0.35 + (cz / cLen) * moveMag * 0.65,
      };
    }
  }
  const probed = rayScanChickSteer(from, blended, moveMag);
  return avoidObstacles(from, probed);
}

/** Chick is inside a shielded exam-tip bubble (eagle can't score hits there). */
function inActiveTipZone(x: number, z: number, buildings: BuildingState[]): boolean {
  return buildings.some(
    (b) => b.zoneActive && !b.tipObtained && isInProtectedZone(x, z, b.id),
  );
}

/** Invincible, caged, or inside an active protected zone — chick is not a valid melee target. */
function isChickSafeFromEagle(c: PlayerGameState, now: number, buildings: BuildingState[]): boolean {
  if (c.invincibleUntil > now) return true;
  if (c.cagedUntil > now) return true;
  return buildings.some(
    (b) => b.zoneActive && !b.tipObtained && isInProtectedZone(c.position.x, c.position.z, b.id),
  );
}

/**
 * Point inside the shield disk for eagle navigation + hitbox.
 * Must satisfy dist(center, p) < ZONE_RADIUS (isInProtectedZone uses strict <).
 * Per-axis offset of ~0.85*R on a corner diagonal was ~7.2 from center — outside the disk.
 */
function zoneEagleAttackPoint(buildingPosition: { x: number; z: number }): { x: number; z: number } {
  const base = buildingApproachPoint(buildingPosition);
  const vx = base.x - buildingPosition.x;
  const vz = base.z - buildingPosition.z;
  const d = Math.hypot(vx, vz);
  if (d < 1e-4) return base;
  const maxD = ZONE_RADIUS - 0.45;
  const scale = Math.min(maxD / d, 1.12);
  return {
    x: buildingPosition.x + vx * scale,
    z: buildingPosition.z + vz * scale,
  };
}

const EAGLE_NAV_RADIUS = 0.5;

function clearanceAlongRayEagle(
  fromX: number,
  fromZ: number,
  dirX: number,
  dirZ: number,
  maxDist: number,
): number {
  let d = 0.85;
  while (d <= maxDist) {
    const x = fromX + dirX * d;
    const z = fromZ + dirZ * d;
    if (checkCollision(x, z, EAGLE_NAV_RADIUS)) return Math.max(0, d - 0.85);
    d += 0.85;
  }
  return maxDist;
}

/** Pick clearest direction toward zone when walls block the direct path. */
function eagleRaySteer(
  from: { x: number; z: number },
  desiredJoy: { x: number; y: number },
  magnitude: number,
): { x: number; y: number } {
  const len0 = Math.hypot(desiredJoy.x, desiredJoy.y);
  if (len0 < 0.05) return desiredJoy;
  const wx0 = desiredJoy.x / len0;
  const wz0 = desiredJoy.y / len0;
  const baseAngle = Math.atan2(wx0, wz0);
  const offsets = [0, -0.5, 0.5, -1.0, 1.0, -1.5, 1.5, Math.PI];
  let bestJoy = desiredJoy;
  let bestScore = -1;
  for (const off of offsets) {
    const a = baseAngle + off;
    const wx = Math.sin(a);
    const wz = Math.cos(a);
    const clear = clearanceAlongRayEagle(from.x, from.z, wx, wz, 6);
    if (clear > bestScore) {
      bestScore = clear;
      bestJoy = { x: wx * magnitude, y: wz * magnitude };
    }
  }
  return bestJoy;
}

function eagleSteerToZone(
  from: { x: number; z: number },
  approach: { x: number; z: number },
  zoneDist: number,
): { x: number; y: number } {
  const mag = Math.min(1, Math.max(0.65, zoneDist / 18));
  const raw = joystickToTarget(from, approach, mag);
  const probed = eagleRaySteer(from, raw, mag);
  return avoidObstacles(from, probed);
}

/** Stay inside shield disk — leaving resets zone health on the server. */
function eagleHoldInsideZone(bot: PlayerGameState, zone: BuildingState): { x: number; y: number } {
  const bx = zone.position.x;
  const bz = zone.position.z;
  const dx = bot.position.x - bx;
  const dz = bot.position.z - bz;
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) return { x: 0, y: 0 };
  const edgeBuffer = 1.1;
  const safeRadius = ZONE_RADIUS - edgeBuffer;
  if (d <= safeRadius) {
    return { x: 0, y: 0 };
  }
  return joystickToTarget(bot.position, { x: bx, z: bz }, 0.3);
}

/** Stage 1–2 exam tips: prioritize breaking shields when every chick is safe (in zone / invincible / caged). */
function canEaglePrioritizeZoneAttack(
  stage: number,
  allPlayers: Map<string, PlayerGameState>,
  now: number,
  buildings: BuildingState[],
): { ok: boolean; destructibleZones: BuildingState[] } {
  if (stage !== 1 && stage !== 2) return { ok: false, destructibleZones: [] };
  const chicks = Array.from(allPlayers.values()).filter((p) => !p.isEagle && p.alive);
  const allSafe =
    chicks.length > 0 && chicks.every((c) => isChickSafeFromEagle(c, now, buildings));
  const destructibleZones = buildings.filter((b) => b.zoneActive && !b.tipObtained);
  return { ok: allSafe && destructibleZones.length > 0, destructibleZones };
}

function emitEagleZoneHitboxIfInZone(
  bot: PlayerGameState,
  s: BotState,
  now: number,
  buildings: BuildingState[],
  messages: ClientMessage[],
): void {
  for (const b of buildings) {
    if (b.zoneActive && !b.tipObtained && isInProtectedZone(bot.position.x, bot.position.z, b.id)) {
      if (now - s.lastZoneHitboxClickAt >= EAGLE_ZONE_HITBOX_INTERVAL_MS) {
        messages.push({ type: 'hitbox-click' });
        s.lastZoneHitboxClickAt = now;
      }
      break;
    }
  }
}

// Final exam: chicks panic-flee from eagles (attacks are disabled server-side).
function updateChickExamFlee(
  bot: PlayerGameState,
  allPlayers: Map<string, PlayerGameState>,
  now: number,
  s: BotState,
): BotDecision {
  const messages: ClientMessage[] = [];
  if (now - s.lastDecisionTime < BOT_REACTION_DELAY) {
    return { joystick: smoothJoystick(s), messages };
  }
  s.lastDecisionTime = now;

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

  if (nearestEagle && now - s.lastPropUseTime > PROP_USE_DELAY) {
    if (eagleDist < 8) {
      const speedProp = bot.props.find((p) => p.type === 'speed' && p.count > 0);
      if (speedProp) {
        messages.push({ type: 'prop-use', propType: 'speed' });
        s.lastPropUseTime = now;
      }
    }
    if (eagleDist < 5 && !bot.teleportPending) {
      const teleProp = bot.props.find((p) => p.type === 'teleport' && p.count > 0);
      if (teleProp) {
        messages.push({ type: 'prop-use', propType: 'teleport' });
        const minAbs = 10;
        const maxAbs = MAP_HALF - TELEPORT_MARGIN;
        const targetX = -Math.sign(bot.position.x || 1) * (minAbs + Math.random() * Math.max(0, maxAbs - minAbs));
        const targetZ = -Math.sign(bot.position.z || 1) * (minAbs + Math.random() * Math.max(0, maxAbs - minAbs));
        messages.push({ type: 'teleport-set', x: targetX, z: targetZ });
        messages.push({ type: 'teleport-confirm' });
        s.lastPropUseTime = now;
      }
    }
    if (eagleDist < 4) {
      const invProp = bot.props.find((p) => p.type === 'invincible' && p.count > 0);
      if (invProp) {
        messages.push({ type: 'prop-use', propType: 'invincible' });
        s.lastPropUseTime = now;
      }
    }
  }

  if (!nearestEagle) {
    s.targetJoystick = { x: 0, y: 0 };
    return { joystick: smoothJoystick(s), messages };
  }

  const fleeJoy = joystickToTarget(nearestEagle.position, bot.position, 1);
  s.targetJoystick = chickSteer(bot.position, fleeJoy, 1);
  return { joystick: smoothJoystick(s), messages };
}

// ─── Eagle Bot ──────────────────────────────────────────────
function updateEagleBot(
  bot: PlayerGameState,
  allPlayers: Map<string, PlayerGameState>,
  now: number,
  stage: number,
  buildings: BuildingState[],
  activeEvent: GameEvent | null,
  mysteryBoxes: MysteryBox[],
  examSafeMode: boolean,
): BotDecision {
  const s = getOrCreateState(bot.connId);
  const messages: ClientMessage[] = [];

  // During events — only when the minigame is active: freeze main-map movement; countdown/result allow normal AI.
  if (activeEvent?.phase === 'active') {
    if (activeEvent.type === 'hitbox') {
      if (now - s.lastDecisionTime > 125) {
        messages.push({ type: 'event-hitbox-click' });
      }
    } else if (activeEvent.type === 'crossy-road') {
      if (now - s.lastPropUseTime > 3000) {
        s.lastPropUseTime = now;
        messages.push({
          type: 'crossy-eagle-action',
          action: Math.random() > 0.5 ? 'speed-up' : 'add-obstacle',
        });
      }
    }
    return { joystick: { x: 0, y: 0 }, messages };
  }

  if (bot.frozen || bot.cagedUntil > now) {
    return { joystick: { x: 0, y: 0 }, messages };
  }

  // Final exam: move for spectacle only — no attacks, cage, or zone damage (server-enforced).
  if (examSafeMode) {
    if (now - s.lastDecisionTime < BOT_REACTION_DELAY) {
      return { joystick: smoothJoystick(s), messages };
    }
    s.lastDecisionTime = now;

    const chicks = Array.from(allPlayers.values()).filter((p) => !p.isEagle && p.alive);
    if (chicks.length === 0) {
      const patrolAngle = (now / 3000) * Math.PI * 2;
      const px = Math.cos(patrolAngle) * 8;
      const pz = Math.sin(patrolAngle) * 8;
      const joy = joystickToTarget(bot.position, { x: px, z: pz }, EAGLE_SPEED_FACTOR);
      s.targetJoystick = avoidObstacles(bot.position, joy);
      return { joystick: smoothJoystick(s), messages };
    }
    chicks.sort((a, b) => dist(bot.position, a.position) - dist(bot.position, b.position));
    const target = chicks[0];
    const d = dist(bot.position, target.position);
    if (d > 15 && now >= bot.flyCooldownUntil && now >= bot.attackCooldownUntil) {
      const flyProp = bot.props.find((p) => p.type === 'fly' && p.count > 0);
      if (flyProp) {
        messages.push({ type: 'prop-use', propType: 'fly' });
      }
    }
    const chaseJoy = joystickToTarget(bot.position, target.position, EAGLE_SPEED_FACTOR);
    s.targetJoystick = avoidObstacles(bot.position, chaseJoy);
    return { joystick: smoothJoystick(s), messages };
  }

  // Stage 1–2 zone hitbox: fire on throttle even when movement is behind BOT_REACTION_DELAY.
  const tipZoneAttack = canEaglePrioritizeZoneAttack(stage, allPlayers, now, buildings);
  let eagleHoldingInTipZone = false;
  if (tipZoneAttack.ok) {
    emitEagleZoneHitboxIfInZone(bot, s, now, buildings, messages);
    const dz = [...tipZoneAttack.destructibleZones].sort(
      (a, b) => dist(bot.position, a.position) - dist(bot.position, b.position),
    );
    const insideNow = dz.find((b) => isInProtectedZone(bot.position.x, bot.position.z, b.id));
    if (insideNow) {
      s.targetJoystick = eagleHoldInsideZone(bot, insideNow);
      eagleHoldingInTipZone = true;
    }
  }

  // Reaction delay check
  if (now - s.lastDecisionTime < BOT_REACTION_DELAY) {
    return {
      joystick: smoothJoystick(s, eagleHoldingInTipZone ? 0.62 : 0.3),
      messages,
    };
  }
  s.lastDecisionTime = now;

  // Stage 1–2: when every alive chick is safe, destroy nearest shield before mystery boxes.
  if (tipZoneAttack.ok) {
    const destructibleZones = tipZoneAttack.destructibleZones;
    destructibleZones.sort(
      (a, b) => dist(bot.position, a.position) - dist(bot.position, b.position),
    );
    const zoneWeAreIn = destructibleZones.find((b) =>
      isInProtectedZone(bot.position.x, bot.position.z, b.id),
    );

    if (zoneWeAreIn) {
      // Do not path toward "nearest" while inside another disk — stay put / nudge inward so
      // leaving the zone does not reset zoneHealth (useGameLogic eagle zone tracking).
      s.targetJoystick = eagleHoldInsideZone(bot, zoneWeAreIn);
    } else {
      const targetZone = destructibleZones[0];
      const approach = zoneEagleAttackPoint(targetZone.position);
      const zoneDist = dist(bot.position, approach);
      s.targetJoystick = eagleSteerToZone(bot.position, approach, zoneDist);

      if (zoneDist > 15 && now >= bot.flyCooldownUntil && now >= bot.attackCooldownUntil) {
        const flyProp = bot.props.find((p) => p.type === 'fly' && p.count > 0);
        if (flyProp) {
          messages.push({ type: 'prop-use', propType: 'fly' });
        }
      }
    }

    return { joystick: smoothJoystick(s, zoneWeAreIn ? 0.62 : 0.3), messages };
  }

  // Prioritize armed mystery boxes, then stake out boxes that are not yet active, then chicks.
  const activeBoxes = mysteryBoxes.filter((b) => !b.collected && !b.triggered && now >= b.activeAt);
  if (activeBoxes.length > 0) {
    activeBoxes.sort((a, b) => dist(bot.position, a.position) - dist(bot.position, b.position));
    const targetBox = activeBoxes[0];
    const boxDist = dist(bot.position, targetBox.position);
    const boxJoy = joystickToTarget(bot.position, targetBox.position, Math.min(1, Math.max(0.55, boxDist / 20)));
    s.targetJoystick = avoidObstacles(bot.position, boxJoy);
    return { joystick: smoothJoystick(s), messages };
  }

  // NOTE: Do NOT chase pending (inactive) mystery boxes — eagles were getting stuck waiting at them.

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

  // Hitbox clicking (main-game building shield — not the random hitbox event)
  if (stage >= 1) {
    emitEagleZoneHitboxIfInZone(bot, s, now, buildings, messages);
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
  examMode: boolean,
): BotDecision {
  const s = getOrCreateState(bot.connId);
  const messages: ClientMessage[] = [];

  if (activeEvent?.phase === 'active') {
    if (activeEvent.type === 'hitbox') {
      if (now - s.lastDecisionTime > 167) {
        messages.push({ type: 'event-hitbox-click' });
      }
    } else if (activeEvent.type === 'crossy-road') {
      if (now - s.lastPropUseTime > 1500) {
        s.lastPropUseTime = now;
        messages.push({ type: 'crossy-hop', direction: 'up' });
      }
    }
    return { joystick: { x: 0, y: 0 }, messages };
  }

  if (bot.frozen || bot.cagedUntil > now) {
    return { joystick: { x: 0, y: 0 }, messages };
  }

  if (examMode) {
    return updateChickExamFlee(bot, allPlayers, now, s);
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
  const safeInTipZone = inActiveTipZone(bot.position.x, bot.position.z, buildings);

  // ── Prop usage (threat-based) ──
  if (!safeInTipZone && nearestEagle && now - s.lastPropUseTime > PROP_USE_DELAY) {
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
  if (!safeInTipZone && isFleeing && nearestEagle && eagleDist < DANGER_RADIUS) {
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
    s.targetJoystick = chickSteer(bot.position, jukeJoy, 1);
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
        s.targetJoystick = chickSteer(bot.position, joy, 0.7);
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

    // Find building to go to (yellow site = tips still available from this building)
    const targetBuilding = buildings
      .filter((b) => b.hasTip && !b.tipObtained && !bot.tips[b.tipIndex])
      .sort((a, b) => dist(bot.position, a.position) - dist(bot.position, b.position))[0];

    if (targetBuilding) {
      const approach = buildingApproachPoint(targetBuilding.position);
      const inDisk = isInProtectedZone(bot.position.x, bot.position.z, targetBuilding.id);
      const d = dist(bot.position, approach);
      if (inDisk || d < 0.75) {
        s.targetJoystick = { x: 0, y: 0 };
      } else {
        const targetJoy = joystickToTarget(bot.position, approach, 0.8);
        const fleeWeight =
          !safeInTipZone && nearestEagle && eagleDist < FLEE_RADIUS
            ? Math.max(0, Math.min(0.35, ((FLEE_RADIUS - eagleDist) / FLEE_RADIUS) * 0.35))
            : 0;
        const fleeJoy = nearestEagle ? joystickToTarget(nearestEagle.position, bot.position, 0.8) : targetJoy;
        const mixedJoy = {
          x: targetJoy.x * (1 - fleeWeight) + fleeJoy.x * fleeWeight,
          y: targetJoy.y * (1 - fleeWeight) + fleeJoy.y * fleeWeight,
        };
        s.targetJoystick = chickSteer(bot.position, mixedJoy, 0.8);
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
        s.targetJoystick = chickSteer(bot.position, joy, 0.7);
      } else {
        // Wander
        const wanderAngle = (now / 5000) * Math.PI;
        const wx = Math.cos(wanderAngle) * 10;
        const wz = Math.sin(wanderAngle) * 10;
        const joy = joystickToTarget(bot.position, { x: wx, z: wz }, 0.5);
        s.targetJoystick = chickSteer(bot.position, joy, 0.5);
      }
    }
    return { joystick: smoothJoystick(s), messages };
  }

  // Stage 3: Move toward nearest building (exam entry)
  if (stage === 3) {
    // Only stop once truly inside exam entry radius.
    if (getAdjacentBuilding(bot.position.x, bot.position.z) >= 0) {
      s.targetJoystick = { x: 0, y: 0 };
      return { joystick: smoothJoystick(s), messages };
    }
    const nearest = [...BUILDINGS].sort(
      (a, b) => dist(bot.position, a.position) - dist(bot.position, b.position),
    )[0];
    if (nearest) {
      const joy = joystickToTarget(bot.position, nearest.position, 0.9);
      s.targetJoystick = chickSteer(bot.position, joy, 0.9);
    }
    return { joystick: smoothJoystick(s), messages };
  }

  // Default: idle
  s.targetJoystick = { x: 0, y: 0 };
  return { joystick: smoothJoystick(s), messages };
}

// ─── Smooth joystick interpolation ──────────────────────────
function smoothJoystick(s: BotState, lerp: number = 0.3): { x: number; y: number } {
  s.currentJoystick.x += (s.targetJoystick.x - s.currentJoystick.x) * lerp;
  s.currentJoystick.y += (s.targetJoystick.y - s.currentJoystick.y) * lerp;
  return { ...s.currentJoystick };
}

// ─── Public API ─────────────────────────────────────────────
export interface UpdateBotOptions {
  examMode?: boolean;
}

export function updateBot(
  bot: PlayerGameState,
  allPlayers: Map<string, PlayerGameState>,
  now: number,
  stage: number,
  buildings: BuildingState[],
  activeEvent: GameEvent | null,
  gameTime: number,
  mysteryBoxes: MysteryBox[],
  options?: UpdateBotOptions,
): BotDecision {
  const exam = !!options?.examMode;
  if (bot.isEagle) {
    return updateEagleBot(bot, allPlayers, now, stage, buildings, activeEvent, mysteryBoxes, exam);
  }
  return updateChickBot(bot, allPlayers, now, stage, buildings, activeEvent, gameTime, exam);
}

export function isBot(connId: string): boolean {
  return connId.startsWith('bot-');
}

export function cleanupBotState(connId: string) {
  botStates.delete(connId);
}
