# Post-Attack Replay & Countdown System

## Overview

After a valid eagle attack, instead of immediately resuming, the host shows a **3-second split-screen overlay** (replacing the current instant resume). The left side shows a **3D replay** of the attack from a focused camera angle, the right side shows a **3-2-1 countdown**. They're separated by a diagonal "/" divider, forming a trapezoid shape on the left.

Additionally, after this overlay dismisses, the **eagle is frozen for 3 seconds** (existing attack cooldown remains separate at 5s).

## Current Flow

1. Eagle hits chick → `frozenAll = true`, `videoPlaying = 'hurt'|'dead'`
2. Video plays (or is skipped) → `onVideoComplete` fires
3. `onVideoComplete`: unfreezes all, freezes eagle for 3s, sets attack cooldown

## New Flow

1. Eagle hits chick → `frozenAll = true`, `videoPlaying = 'hurt'|'dead'` (unchanged)
2. Video plays or is skipped → `onVideoComplete` fires
3. **NEW**: Instead of immediately unfreezing, enter a **3-second replay+countdown phase**
4. After 3s countdown ends → unfreeze all, freeze eagle for 3s, set attack cooldown

## Implementation Plan

### 1. Add position history recording to useGameLogic

Record a circular buffer of all player positions+facingAngles every frame in the game loop. Store ~5 seconds of history (at 60fps = ~300 frames). Each frame: `{ time: number, positions: Record<connId, {x,z,facingAngle,isMoving,isAttacking}> }`.

When an attack lands, snapshot the last 3 seconds of position history and store it as `replayData` on the game state ref, along with `attackerConnId` and `victimConnIds`.

**File**: `src/hooks/useGameLogic.ts`

- Add `positionHistory` circular buffer to the game loop
- On valid attack hit (line ~1645), save `replayData = { frames: last3SecondsOfHistory, attackerConnId, victimConnIds }`
- Add new state: `replayCountdown: { active: boolean, startedAt: number, replayData: ReplayData } | null`

### 2. Modify onVideoComplete to start replay countdown

Instead of immediately unfreezing, `onVideoComplete` sets `replayCountdown` state. The game stays `frozenAll = true` during this phase.

After 3 seconds (tracked via `setTimeout` or game loop), the actual unfreeze + eagle freeze logic executes.

**File**: `src/hooks/useGameLogic.ts`

- In `onVideoComplete`, instead of unfreezing, set `replayCountdown` active
- Add a new callback `onReplayCountdownComplete` that does the current unfreeze logic
- Broadcast `replayCountdown` data in `GameStateSnapshot` so clients know to disable controls

### 3. Add ReplayData types

**File**: `src/lib/gameTypes.ts`

- Add `ReplayFrame` type: `{ time: number, players: Record<string, {x,z,facingAngle,isMoving,isAttacking,chickColor,colorIndex,isEagle}> }`
- Add `ReplayData` type: `{ frames: ReplayFrame[], attackerConnId: string, victimConnIds: string[], attackTime: number }`
- Add `replayCountdown` field to `GameStateSnapshot`: `{ secondsLeft: number, replayData: ReplayData } | null`
- similar to `Download Log`

### 4. Create ReplayCountdownOverlay component

**File**: `src/components/ReplayCountdownOverlay.tsx` (new)

A portal overlay (same z-index as VideoOverlay) with a split-screen layout:

- **Container**: Same dimensions as VideoOverlay (`max-w-[80vw] max-h-[60vh]`), rounded, with shadow
- **Left side (trapezoid shape)**: A `<Canvas>` rendering the 3D replay scene using a clip-path to create the trapezoid (top-left wider than bottom-left, with diagonal "/" cut on right edge)
- **Right side**: Large countdown number (3, 2, 1) with styling, occupying the triangular space right of the diagonal
- **Diagonal divider**: CSS clip-path or SVG to create the "/" visual separation

**Replay 3D scene details**:

- Render characters at positions from `replayData.frames`, stepping through frames mapped to wall-clock time
- Camera: Focus on the eagle (attacker), similar to `PlayerFocusCamera`
- Timeline: 0-1.5s = normal scene replay (eagle approaching), 1.5-2.0s = attack animation moment, 2.0-3.0s = zoom-in static shot on the eagle
- Use the same `CharacterViewer`, lighting, and grid as `GameplayMap`
- Re-render all players visible in the replay frames

### 5. Integrate overlay into Host.tsx

**File**: `src/pages/Host.tsx`

- Import and render `ReplayCountdownOverlay` after `VideoOverlay`
- Pass `replayCountdown` data from game logic
- On countdown complete, call the new `onReplayCountdownComplete` callback

### 6. Client-side: no visual changes, controls disabled

**File**: `src/pages/Client.tsx`

- Controls are already disabled during `frozenAll`/`videoPlaying` — the replay countdown keeps `frozenAll = true` so controls remain disabled automatically
- No new UI needed on the client

### 7. Eagle post-replay freeze (3 seconds)

This already exists in `onVideoComplete` (lines 2034-2044) where eagle gets `FREEZE_DURATION` (3000ms). Move this logic to fire after the replay countdown completes instead. The existing 3s freeze + 3s attack cooldown after freeze stays the same.

## Key Technical Decisions

- **Position history buffer**: Record in the rAF game loop, ~300 entries circular buffer, lightweight (just positions + angles per player)
- **Replay playback**: Client-side interpolation through recorded frames in the overlay's `useFrame` hook
- **Camera choreography**: Three phases controlled by elapsed time in the overlay — wide shot → attack moment → zoom-in
- **Trapezoid clip-path**: CSS `clip-path: polygon(0 0, 70% 0, 55% 100%, 0 100%)` on the left panel, with the right panel holding the countdown
- **No client changes needed**: `frozenAll` already disables all client controls