# Eagle vs Chick — Full Game Implementation Plan

## Overview

Implement the complete game flow: lobby color selection, game start, role assignment, 3D gameplay map with combat, 4-stage mission system (Social Circle, Exam Tips, Share Tips, Final Exam), props, health/grades, and end-game transcript. This is a very large implementation spanning ~20+ new/modified files.

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                     ROUTING                              │
│  /host         → Lobby (existing, enhanced)              │
│  /client       → Join (existing, enhanced)               │
│  /game-host    → Host gameplay screen (new)              │
│  /game-client  → Client remote controller (new)          │
│  /transcript   → End-game results (new)                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              GAME STATE (broadcast via channel)          │
│  Host is authoritative. All game logic runs on host.     │
│  Clients send: joystick, button presses, scan results    │
│  Host sends: positions, health, stage, events, freezes   │
└─────────────────────────────────────────────────────────┘
```

## Detailed Plan

### 1. Expand Color System & Player Types

**File: `src/lib/playerColors.ts**`

- Expand `PLAYER_COLORS` to all 8 colors (Black, Gold, Red, Yellow, Blue, Green, Cyan, Pink)
- Mark Black and Gold as `isEagle: true`
- Add `MAX_PLAYERS` variants: 4 for 1v3, 8 for 2v6

**File: `src/lib/gameTypes.ts` (new)**

- Define shared types: `GameMode` (1v3 | 2v6), `GameStage` (lobby | reveal | playing | exam | transcript)
- `PlayerGameState`: health (numeric grade), isEagle, isStarStudent, tips held, props inventory, alive status
- Grade system: `4.3, 4, 3.7, 3.3, 3, 2.7, 2.3, 2, 1.7, 1, 0` with letter mappings (A+ through F)
- Helper functions: `gradeToLetter()`, `applyDamage()`, `applyHeal()`
- Props types: SpeedUp, Heal, Fly (eagle), Invincible (star student)
- Message protocol types for host↔client communication

### 2. Lobby Enhancements

**File: `src/hooks/useGameRoom.ts**`

- Change color allocation: assign random color from all 8 on join
- Add `color-swap` message: client requests a color, host validates availability and broadcasts update
- Add `game-start` broadcast message from host
- Add `game-state` broadcast for ongoing game state sync
- For 2v6: support up to 8 players with color choosing prompt

**File: `src/pages/Host.tsx**`

- Add cyber-styled "START GAME" button at top center (visible when player count meets threshold: 4 for 1v3)
- Grey out used colors in player indicators
- On start click: broadcast `game-start`, navigate to `/game-host`

**File: `src/pages/Client.tsx**`

- Add color-choosing circles below thumbstick (8 circles, grey out taken colors excluding own)
- Tapping an available color sends `color-swap` request to host
- On receiving `game-start`: navigate to `/game-client`

### 3. Role Assignment & Reveal Screen

**File: `src/pages/GameHost.tsx` (new)**

- On mount: randomly assign 1 player as eagle (Black or Gold, no repeat in 2v6) for 1v3
- Broadcast role assignments to all clients
- Show 5-second countdown with character reveal
- For 2v6: skip random assignment (colors already chosen), still show reveal
- After reveal: enter gameplay mode with 10-second countdown

**File: `src/pages/GameClient.tsx` (new)**

- On mount: receive role assignment
- Show rotating 3D static model of assigned character for 5 seconds with color name underneath
- After reveal: transition to gameplay remote controller layout

### 4. Gameplay Map (Host Screen)

**File: `src/components/GameplayMap.tsx` (new)**

- 3D rectangular map, 4x larger than lobby (roughly 32x32 units)
- Fixed camera angle similar to lobby (isometric-ish from above)
- 4 buildings at the 4 corners (with gap from edges so chicks can surround)
- Short bar/line obstacles scattered for chase dynamics
- All characters rendered with `CharacterViewer`, positions driven by host game state
- Initially show 2 prop pickups on the map: Speed x2 and Heal, each with a circle icon + QR code square underneath

**File: `src/lib/gameplayMapData.ts` (new)**

- Define building positions, obstacle geometry, spawn points
- Ensure routes exist to all buildings (no dead ends)

### 5. Client Remote Controller Layout

**File: `src/pages/GameClient.tsx**`

- **Chick layout** (top to bottom):
  - Scanner rectangle (same size as PW exam camera view) — toggles camera on/off
  - Thumbstick in the middle
  - Bottom row: 2 rectangular boxes (for social circle / tips) + 1 circle props button
  - Props button shows count badge, swipe-up arrow ">" to switch props
- **Eagle layout**:
  - Hitbox rectangle (instead of scanner) — for click counting
  - Thumbstick in the middle
  - Bottom: large Attack button + props button (fly)
  - Attack button: plays attack animation once, 5-sec cooldown countdown

### 6. Health & Grade System

**File: `src/lib/gradeSystem.ts` (new)**

- Grade scale: `[4.3, 4, 3.7, 3.3, 3, 2.7, 2.3, 2, 1.7, 1, 0]`
- Letter mapping: A+=4.3, A=4, A-=3.7, B+=3.3, B=3, B-=2.7, C+=2.3, C=2, C-=1.7, D=1, F=0
- Each attack: -2 grades (drop 2 steps in the array)
- Below 1.7 → 1 (D), below 1 → 0 (F = dead)
- Starting health: 4.3 (A+)

**Host screen**: Health display top-right showing each character's grade + numeric value + star indicator

### 7. Combat System

**File: `src/hooks/useGameLogic.ts` (new)** — runs on host only

- Collision detection: eagle mesh overlapping chick mesh
- Valid attack: eagle overlaps chick + presses attack → damage applied
- On successful attack: freeze all players, play Hurt.mp4 or Dead.mp4 (most serious if multiple chicks hit)
- Eagle gets 5-sec movement freeze + 5-sec attack cooldown after successful hit
- Dead chick: eliminated, big "F" on client screen
- Preload Hurt.mp4 and Dead.mp4 on host
- Eagle flight prop: 0.5sec speed x3, ignores obstacles, can attack during flight

### 8. Four-Stage Mission System

**Stage 1 — Social Circle**

- Each chick must physically overlap every other chick at least once
- Host validates overlaps, broadcasts confirmation
- Client's 2 rectangular boxes turn green when each overlap is confirmed
- When all chicks have both boxes green → Stage 2
- For 2v6, make it 2 rectangular to 5 rectangular boxes

**Stage 2 — Get Exam Tips**

- 2 diagonal buildings glow (T1, T2) with golden protected zones
- Protected zone: 1 chick-size + buffer radius, attacks invalid inside for chicks
- Eagle can attack the zone via hitbox (50 HP per zone, -1 per click)
- Eagle leaving zone resets zone HP
- Chick enters zone for 7 seconds → becomes Star Student
- Star student: +5 sub-grades, gets 1 invincible prop (3 sec)
- Display star icon next to health box for star students

**Stage 3 — Share Exam Tips** (concurrent with Stage 2)

- Star students' tips stored in rectangular boxes (💡Tips 1 / 💡Tips 2)
- Tapping box generates QR code (reuses existing exam-tips QR logic)
- Other chicks scan with scanner to receive tips
- First scanner gets it, 3-sec loading ("Copying"), 5-sec cooldown on box
- Continue until all alive chicks have both tips → Stage 4

**Stage 4 — Final Exam**

- All chicks run to any building to start exam
- Uses PW Exam question: layer-1 to 1 random player, layer-2 to others
- Replace thumbstick with camera overlay + sliders temporarily
- 2 rectangular boxes become answer input + submit button
- Timer: 45 sec (1v3), 60 sec (2v6)
- Correct submission = team success → end game
- Wrong answer = each player -1 grade
- If layer-1 holder dies: everyone -1 more, layer-1 shown on host screen

**Host progress bar**: Bottom of screen showing 4 stages + brief instruction for chicks

### 9. Props System

- Speed Up: x2 speed for 0.5 sec, spawns every 10-12 sec randomly on map
- Heal: +1 grade (if not max), spawns every 30 sec
- Eagle Fly: speed x3 for 0.5 sec, ignores obstacles
- Invincible (star student only): 3 sec immune to attacks
- Props accumulate, shown with count badge on props button
- Swipe the swipe-up arrow to switch between prop types

### 10. Win Conditions & Transcript

**Eagle Team wins**: 1v3: eliminate 3 chicks. Draw: 2. 2v6: >4 eliminated. Draw: 4.  
**Chicks Team wins**: not Eagles wins  
**Personal Chicks wins**: Complete Final Exam successfully.

**File: `src/pages/Transcript.tsx` (new)**

- MVP displayed first (2 sec), then ranked same-team players
- Victory animation for winners, idle for others
- 3D characters with glitter celebration
- Stats table: letter grade (big), survival time, damage taken, action score
- Eagle stats: damage dealt, action score
- Client also sees their character dancing if they won + congrats/MVP message

### 11. Event System (Placeholder)

- Every 1 min: Mario "?" box spawns, active in 10-15 sec
- Chick touches: get 3 speed-up props
- Eagle touches: trigger event (pass/fail, fail = -2 sub-grades)
- After event: eagle frozen 5 sec
- Mock Exam & Hitbox events: basic structure created, detailed implementation deferred

### 12. Database Changes

**New migration**: Add `game_sessions` table to track game state for Supabase mode:

- `id`, `room_code`, `game_mode`, `stage`, `player_states` (JSONB), `created_at`
- This is optional — primary sync is via Supabase Realtime broadcast channels (already used)

### 13. Communication Protocol

All game state synced via existing broadcast channel (`game-room-{code}`):

```text
Host → Clients:
  game-start, role-assign, game-state (positions, health, stage, freezes),
  stage-change, attack-result, video-play, exam-start, game-over

Clients → Host:
  joystick, attack-press, prop-use, scan-result, answer-submit,
  hitbox-click, color-swap
```

---

## File Summary


| Action    | File                                                      |
| --------- | --------------------------------------------------------- |
| New       | `src/lib/gameTypes.ts` — shared types & protocol          |
| New       | `src/lib/gradeSystem.ts` — grade/health logic             |
| New       | `src/lib/gameplayMapData.ts` — map layout data            |
| New       | `src/hooks/useGameLogic.ts` — host-side game engine       |
| New       | `src/pages/GameHost.tsx` — host gameplay screen           |
| New       | `src/pages/GameClient.tsx` — client remote controller     |
| New       | `src/pages/Transcript.tsx` — end-game results             |
| New       | `src/components/GameplayMap.tsx` — 3D gameplay map        |
| New       | `src/components/HealthDisplay.tsx` — grade/health HUD     |
| New       | `src/components/StageProgressBar.tsx` — 4-stage progress  |
| New       | `src/components/VideoOverlay.tsx` — Hurt/Dead video popup |
| New       | `src/components/PropsButton.tsx` — props UI for client    |
| New       | `src/components/ScannerBox.tsx` — scanner/hitbox toggle   |
| New       | `src/components/ColorPicker.tsx` — lobby color chooser    |
| Modify    | `src/lib/playerColors.ts` — expand to 8 colors            |
| Modify    | `src/hooks/useGameRoom.ts` — color swap, game-start msgs  |
| Modify    | `src/pages/Host.tsx` — start button, game-start flow      |
| Modify    | `src/pages/Client.tsx` — color picker, game-start nav     |
| Modify    | `src/App.tsx` — new routes                                |
| Migration | Add RLS-enabled game state table (optional)               |


## Implementation Order

1. Types, grade system, expanded colors
2. Lobby enhancements (color picking, start button)
3. Role reveal screens
4. Gameplay map + movement
5. Combat (attack, health, hurt/dead videos)
6. Stage 1 (Social Circle)
7. Stage 2-3 (Exam Tips + Sharing)
8. Stage 4 (Final Exam integration)
9. Props system
10. Transcript / end-game
11. Event system (placeholder)

This will be implemented across multiple files simultaneously, with the host as the authoritative game server and clients as thin controllers.