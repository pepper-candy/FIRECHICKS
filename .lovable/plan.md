# AI Bot System — Implementation Plan

## Overview

Add AI bots that can fill empty player slots for both Eagle and Chick roles. Bots operate at intermediate skill level with 200ms reaction delays, simple pathfinding, and role-specific behaviors. A "Toggle Bots" button in the lobby allows starting with fewer human players.

## Architecture

```text
NEW FILE: src/lib/botAI.ts
  - All bot logic lives here, called from useGameLogic.ts game loop
  - Produces synthetic joystick data + client messages per bot per frame
  - No network layer — bots inject directly into game state

HOST LOBBY:
  [🤖 Fill Bots] button — adds bot players to fill remaining slots
  Bots get special connIds: "bot-eagle-1", "bot-chick-1", etc.
  If a human joins a bot's slot, bot is removed and human takes over

GAME LOOP:
  Each frame, botAI.update() runs for each bot player:
  - Reads game state (positions, stage, threats)
  - Outputs: joystick vector (x, y) + optional action messages
  - 200ms reaction delay via a buffered decision queue
```

## Bot Behavior Details

### Eagle Bot (The Hunter)

- **Targeting**: Find nearest alive, non-invincible, non-caged chick not in a protected zone. If target is "safe" (in zone or invincible), switch to next.
- **Chase timeout**: Track chase target + duration. If chasing same chick > 5s without catch, pick a different target for 3s.
- **Interception**: Instead of moving to chick's current position, lead by `chickVelocity * 0.5s` ahead.
- **Attack**: When within `ATTACK_OVERLAP_THRESHOLD`, emit `attack-press` (respects cooldown).
- **Fly**: Use fly prop when > 15 units from target and fly is off cooldown.
- **Cage**: Use cage when off cooldown and > 2 alive chicks.
- **Hitbox**: When in a building zone with active zone, emit `hitbox-click` at ~5 clicks/s.
- **Events**: During hitbox challenge, click at ~8/s. During crossy road, use speed-up/add-obstacle on cooldown. Skip mock exam.

### Chick Bot (The Gatherer/Survivor)

- **Stage 1 (Social Circle)**: Move toward nearest un-met chick. Juke slightly when eagle is near.
- **Stage 2 (Exam Tips)**: Move toward nearest glowing building with a tip the bot doesn't have. Stay in zone for 7s to obtain tip.
- **Stage 2-3 (Tip Sharing)**: If bot has a tip another nearby chick doesn't, virtually "share" it (directly set the tip on the other bot or trigger tip-request/scan-result flow for human players within proximity), the countdown also applies.
- **Stage 3 (Final Exam)**: Move toward nearest building. Bots do NOT submit exam answers.
- **Flee Mode**: If eagle is within 12 units, switch to flee — move opposite direction from eagle. If eagle is within 6 units, add random "juke" (90° direction change every 0.5s).
- **Props**: Use speed prop when fleeing and eagle < 8 units. Use teleport if eagle < 5 units (set target to opposite map quadrant, confirm immediately). Use invincible if eagle < 4 units. Use heal if health < 2.7, attempt use all before the final exam.
- **Events**: During hitbox, click at ~6/s. During crossy road, hop forward every ~1.5s, hop back if obstacle detected ahead. Skip mock exam answer submission.

### Reaction Delay

- Bot decisions are computed each frame but applied with a 200ms delay buffer.
- Store `lastDecisionTime` per bot; only re-evaluate when 200ms has passed.
- Joystick values interpolate smoothly toward the target direction.

### Pathfinding

- Use simple raycasting against AABB obstacles from `gameplayMapData.ts`:
  - Cast a ray from bot position toward target.
  - If ray hits an obstacle, steer perpendicular to obstacle face until clear.
  - Use `resolvePosition()` for collision resolution (already exists).
- No A* needed — the map is open enough that obstacle avoidance + sliding works well.

## New Files


| File               | Purpose                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `src/lib/botAI.ts` | Bot decision engine: `BotController` class with `update(gs, delta)` returning joystick + actions |


## Modified Files


| File                            | Changes                                                                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useGameRoom.ts`      | Add `addBot(connId, colorIndex)` and `removeBot(connId)` methods. `fillBots()` fills remaining slots. Bots added to players Map with `isBot: true` flag on PlayerState. |
| `src/hooks/useGameLogic.ts`     | Import `BotController`. In game loop, after human movement, run `botController.update()` for each bot. Inject synthetic joystick + messages.                            |
| `src/pages/Host.tsx`            | Add "🤖 Fill Bots" button in lobby. Show bot indicators (robot icon) on player dots. Allow start with fewer than max players when bots fill slots.                      |
| `src/lib/gameTypes.ts`          | No structural changes needed — bots use same PlayerGameState.                                                                                                           |
| `src/pages/preview/mockData.ts` | Add bot player mocks for testing.                                                                                                                                       |


## Integration Rules

1. Bots trigger the same collision/win/loss logic as humans (they exist as normal PlayerGameState entries).
2. Bot connIds use prefix `bot-` so they can be identified.
3. If a human player joins and all non-bot slots are taken, the most recently added bot is removed and replaced.
4. Bots don't have real WebRTC connections — their joystick data is written directly into the players Map.
5. Bots don't attempt mock exam or final exam answer submissions.
6. Bot tip sharing: between two bots, tips are exchanged directly. Between bot and human, the bot generates a real tip-request (QR code) that the human must scan, or the bot scans the human's QR virtually (instant scan when in proximity).

## Fine-Tuning Decisions

- **Eagle chase speed**: Bot eagle moves at 90% of max speed to give chicks a slight edge.
- **Chick flee juke**: Random 60-120° direction change every 0.3-0.7s when eagle < 6 units.
- **Prop usage timing**: Bots wait 1s after prop becomes available before using (feels more human).
- **Building zone patience**: Chick bots stay in zone for full 7s even if eagle approaches (commit to obtaining tip), but flee if eagle enters the zone.
- **Social circle**: Bots approach other chicks at walking speed, pause 0.5s on contact before moving to next.