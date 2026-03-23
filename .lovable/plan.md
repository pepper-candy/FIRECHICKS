# New Props & Mechanics Plan

## Overview

Four changes: (1) proximity-based tip sharing with visible radius, (2) chick starting props (2 speed + 1 teleport), (3) eagle Sabotage/Cage prop, (4) bigger spreading invincible ripple.

## 1. Proximity-Based Tip Sharing (3-block radius)

**Threshold**: `TIP_SHARE_RADIUS = 6` (3 blocks × 2 units per block = 6 units). Two chicks must stay within this radius for the entire QR display + scan + copy process.

**Game logic `useGameLogic.ts`)**:

- In the `tip-request` handler: check that at least one other alive chick is within `TIP_SHARE_RADIUS` of the requesting player. If not, reject the request (don't generate QR).

- In the `scan-result` handler (tip share path): check proximity between scanner and sharer. If distance > `TIP_SHARE_RADIUS`, reject the scan.

- During game loop: if a tip QR is active and the sharer moves out of range from all other chicks, expire the QR early.

**Visual `GameplayMap.tsx`)**:

- When a player has an active tip share (from `activeTipShares` or a new field in serialized state), render a translucent circle of radius 6 around them on the map (green ring, similar to protected zone but green).

- Add `activeTipShareConnIds: string[]` to `GameStateSnapshot` so the map knows which players are sharing.

**Client `Client.tsx`)**:

- Show warning text "Move closer to share tips!" if tip request is rejected.

## 2. Chick Starting Props: 2 Speed + 1 Teleport

`**gameTypes.ts**`:

- Add `'teleport'` to `PropType` union: `'speed' | 'heal' | 'fly' | 'invincible' | 'teleport'`

`**useGameLogic.ts**` (startGame, line 269):

- Change chick initial props from `[]` to `[{ type: 'speed', count: 2 }, { type: 'teleport', count: 1 }]`

**Teleport Mechanic** — Two-phase activation:

- Phase 1 (click teleport prop): Set player state `teleportPending = true`, `teleportTarget = player.position`. Client switches thumbstick to move a colored dot instead of the character. Prop icon changes to ✕.

- Phase 2 (click teleport prop again): Teleport player instantly to `teleportTarget`. Set `invincibleUntil = now + 500` (brief invincibility during teleport). Consume the prop. Set `teleportPending = false`.

**New fields on `PlayerGameState` / `PlayerGameStateSerializable**`:

- `teleportPending: boolean`

- `teleportTarget: { x: number; z: number }`

**Client message**: Add `| { type: 'teleport-set'; x: number; z: number }` — sent continuously while in teleport-targeting mode (throttled to ~10fps). The host updates `teleportTarget`.

Add `| { type: 'teleport-confirm' }` — sent when player clicks teleport again.

**Client UI**:

- When `teleportPending` is true, thumbstick controls the dot position instead of player movement.

- Dot rendered on the map `GameplayMap.tsx`) as a pulsing circle matching the player's color.

- Teleport prop button shows ✕ icon instead of the normal icon, switch back when `teleportPending` is done.

## 3. Eagle Sabotage Prop: The Cage

**Constants**: `CAGE_COOLDOWN = 60000`, `CAGE_LOCK_DURATION = 20000`, `CAGE_POST_INVINCIBLE = 5000`

`**gameTypes.ts**`:

- Add `'cage'` to `PropType` union.

- Add to `PlayerGameState`: `cagedUntil: number` (0 = not caged), `cagePostInvincibleUntil: number`

- Add to `ClientMessage`: `| { type: 'cage-use' }`

`**useGameLogic.ts**`:

- Eagle starts with `[{ type: 'fly', count: 3 }, { type: 'cage', count: 99 }]`. Cage has a cooldown tracked via a new field `cageCooldownUntil: number` on eagle's state (starts at game start time, so first use available at ~60s into game).

- On `cage-use` message: if `now < player.cageCooldownUntil`, reject. Otherwise, pick a random alive chick, set `chick.cagedUntil = now + CAGE_LOCK_DURATION`, `chick.frozen = true`, `chick.frozenUntil = now + CAGE_LOCK_DURATION`, `chick.invincibleUntil = now + CAGE_LOCK_DURATION + CAGE_POST_INVINCIBLE`. Set `player.cageCooldownUntil = now + CAGE_COOLDOWN`.

- In game loop: when `cagedUntil > 0 && now >= cagedUntil`, set `cagedUntil = 0` (cage lifts, invincible continues for 5s).

- Caged chick can still turn (facingAngle updates) but position is locked.

**Visual `GameplayMap.tsx`)**:

- When `player.cagedUntil > now`, render a cage mesh around the character: 4 vertical bars + top plate, descending animation on first frame. Show "DETENTION 20s" countdown label above.

- After cage lifts, the existing invincible ripple shows for 5s.

**Client UI**:

- Eagle: cage button with 60s cooldown display (same pattern as fly cooldown).

- Caged chick: show "DETAINED! 20s" overlay on their control screen. Thumbstick disabled.

## 4. Bigger Spreading Invincible Ripple and protected zone (3 unit larger)

`**GameplayMap.tsx**` (invincible shimmer ring, line ~262):

- Replace the static `ringGeometry` with an animated expanding ring using `useFrame`. Start at radius 0.6, expand to 2.5 over 1s, then repeat. Use opacity that fades out as it expands.

- Add 2-3 staggered rings for a continuous ripple effect (offset by 0.3s each).

- Increase the ring color intensity and add a slight glow via `emissiveIntensity`.

---

## Files Summary

| File                                               | Changes                                                                                                                                                                                                             |

| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

| `src/lib/gameTypes.ts`                             | Add `teleport`, `cage` to PropType. Add `teleportPending`, `teleportTarget`, `cagedUntil`, `cagePostInvincibleUntil`, `cageCooldownUntil` fields. Add new client messages. Add `activeTipShareConnIds` to snapshot. |

| `src/hooks/useGameLogic.ts`                        | Proximity check for tip sharing. Chick starting props. Teleport 2-phase logic. Cage logic. Cage cooldown. Game loop updates for cage/teleport.                                                                      |

| `src/components/GameplayMap.tsx`                   | Tip share radius circle. Teleport target dot. Cage mesh around caged players. Animated spreading invincible ripple.                                                                                                 |

| `src/pages/Client.tsx`                             | Teleport targeting mode UI. Cage button for eagle. Caged overlay for chicks. Teleport prop icon swap. Proximity warning for tips.                                                                                   |

| `src/components/controls/ChickStage23Controls.tsx` | Proximity warning for tip sharing.                                                                                                                                                                                  |

| `src/components/controls/EagleControls.tsx`        | Cage button with cooldown.                                                                                                                                                                                          |

| `src/lib/gameplayMapData.ts`                       | Add `TIP_SHARE_RADIUS = 6` constant.                                                                                                                                                                                |

&nbsp;