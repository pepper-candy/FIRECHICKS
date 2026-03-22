

# Crossy Road Minigame — Design Plan

## Concept

A 30-second event where chicks dodge lanes of obstacles on their phone screen. Eagles control obstacle speed. Chicks that survive get +2 sub-grades; chicks that get hit lose -2 sub-grades. Triggered from mystery boxes alongside hitbox and mock-exam.

## Architecture

```text
HOST SCREEN (/host):
  ┌─────────────────────────────────┐
  │  🐔 CROSSY ROAD — 25s          │
  │                                 │
  │  Top-down view of lanes         │
  │  ← ← ← obstacles moving ← ← ← │  Lane 1
  │  → → → obstacles moving → → →  │  Lane 2
  │  ← ← ← obstacles moving ← ← ← │  Lane 3
  │  → → → obstacles moving → → →  │  Lane 4
  │  ← ← ← obstacles moving ← ← ← │  Lane 5
  │                                 │
  │  Chick dots shown on their lane │
  │  Eagle: "Speed: 1.2x ▲"        │
  └─────────────────────────────────┘

CLIENT SCREEN (Chick /client):
  ┌───────────────────┐
  │  CROSSY ROAD 25s  │
  │                   │
  │  Side-scroll view │
  │  of YOUR lane     │
  │  ← obstacles →    │
  │  🐤 (you)         │
  │                   │
  │  [⬆] [⬇] [⬆HOP] │
  │  Move between     │
  │  safe zones       │
  └───────────────────┘

CLIENT SCREEN (Eagle /client):
  ┌───────────────────┐
  │  CROSSY ROAD 25s  │
  │                   │
  │  [SPEED UP]       │
  │  Current: 1.2x    │
  │  Cooldown: 3s     │
  │                   │
  │  [ADD OBSTACLE]   │
  │  Adds one extra   │
  │  obstacle to a    │
  │  random lane      │
  └───────────────────┘
```

## Gameplay Rules

- **5 horizontal lanes** with obstacles (fire/cars) moving left or right at varying speeds.
- **Chicks** start at bottom, must hop forward through lanes to reach the top (safe zone). Each successful crossing = 1 point. They keep crossing back and forth for 30s.
- **Getting hit** resets the chick to the start of that crossing attempt (no immediate grade loss — counted at end).
- **Eagles** can press "Speed Up" (boosts all lane speeds by 0.2x, cooldown 5s) and "Add Obstacle" (adds an extra obstacle to a random lane, cooldown 8s).
- **At end**: Chicks with 3+ successful crossings get +2 sub-grades. Chicks with 0-1 crossings get -2 sub-grades. 2 crossings = no change.
- F-grade elimination check runs after.

## Data Model Changes

**`src/lib/gameTypes.ts`**:
- Add `'crossy-road'` to `EventType` union.
- Add to `GameEvent`:
  ```
  crossyLanes?: CrossyLane[];
  crossyPlayerStates?: Record<string, CrossyPlayerState>;
  eagleSpeedBoost?: number;
  ```
- New types:
  ```
  interface CrossyLane {
    id: number;
    direction: 'left' | 'right';
    speed: number;
    obstacles: { x: number; width: number }[];
  }
  interface CrossyPlayerState {
    laneIndex: number;   // 0=start, 5=finish
    xPosition: number;
    crossings: number;
    hitCount: number;
  }
  ```

**`src/lib/gameTypes.ts`** — Add `'crossy-hop'` to `ClientMessage`:
```
| { type: 'crossy-hop'; direction: 'up' | 'down' }
| { type: 'crossy-eagle-action'; action: 'speed-up' | 'add-obstacle' }
```

## New Files

| File | Purpose |
|------|---------|
| `src/components/events/CrossyRoadHost.tsx` | Host view: top-down lane visualization with chick positions |
| `src/components/events/CrossyRoadClient.tsx` | Client view: chick controls (hop up/down) or eagle controls (speed/obstacle) |
| `src/pages/preview/CrossyRoadHost.tsx` | Preview wrapper with mock data |
| `src/pages/preview/CrossyRoadClient.tsx` | Preview wrapper with mock data |

## Modified Files

| File | Changes |
|------|---------|
| `src/lib/gameTypes.ts` | Add `crossy-road` event type, lane/player types, client messages |
| `src/hooks/useGameLogic.ts` | Lane simulation in game loop, collision detection, eagle actions, scoring |
| `src/pages/Host.tsx` | Render `CrossyRoadHost` when event active |
| `src/pages/Client.tsx` | Render `CrossyRoadClient` when event active |
| `src/App.tsx` | Add 2 preview routes |

## Game Logic (in `useGameLogic.ts`)

- **Mystery box**: 1/3 chance each of `hitbox`, `mock-exam`, `crossy-road`.
- **Lane init**: Generate 5 lanes with 2-4 obstacles each, alternating directions, random speeds (2-5 units/s).
- **Game loop**: Each frame, move obstacles by `speed * dt * eagleSpeedBoost`. Wrap obstacles that go off-screen. Check collision between chick hitbox and obstacles in their lane.
- **Hop handler**: On `crossy-hop` message, move chick up/down one lane (clamped 0-5). If reaching lane 5, increment crossings, reset to lane 0.
- **Eagle actions**: `speed-up` adds 0.2 to global multiplier (max 2.0x), `add-obstacle` pushes a new obstacle into a random lane.
- **Scoring at end**: iterate chicks, apply +2 or -2 based on crossing count, then F-grade elimination.

