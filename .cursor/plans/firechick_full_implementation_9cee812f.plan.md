---
name: FireChick Full Implementation
overview: Complete implementation of the FireChick (Eagle vs Chick) multiplayer game -- fixing existing animation/collision bugs, then building out all 4 game stages, combat, props, exam integration, transcript, and events system.
todos:
  - id: phase1-animation
    content: "Phase 1A: Fix character animation states -- Running when moving, Idle when stationary, Attack for eagle actions"
    status: completed
  - id: phase1-collision
    content: "Phase 1B: Fix wall collision with push-out resolution vectors instead of boolean blocking"
    status: completed
  - id: phase1-fly
    content: "Phase 1C: Fix eagle fly -- skip obstacle collision during fly, resolve position after"
    status: completed
  - id: phase2-start
    content: "Phase 2A: Move Start button to top center with cyber styling"
    status: completed
  - id: phase2-color
    content: "Phase 2B-C: Grey out taken colors (exclude self), 2v6 red outline on eagle colors"
    status: completed
  - id: phase3-reveal
    content: "Phase 3A-C: Random eagle assignment (1v3), 10s countdown, character reveal display"
    status: completed
  - id: phase3-map
    content: "Phase 3D: Expand gameplay map to 4x, fixed camera, ensure building accessibility"
    status: completed
  - id: phase4-layout
    content: "Phase 4: Client gameplay UI layout (chick: scanner/thumbstick/boxes+props, eagle: hitbox/thumbstick/attack+props)"
    status: completed
  - id: phase5-combat
    content: "Phase 5: Combat system -- attack validation, freeze, video overlay, damage, death"
    status: completed
  - id: phase6-props
    content: "Phase 6: Props system -- spawning, speed/heal/fly/invincible, eagle awakening delay"
    status: completed
  - id: phase7-social
    content: "Phase 7: Stage 1 Social Circle -- overlap tracking, green box indicators, stage completion"
    status: completed
  - id: phase8-tips
    content: "Phase 8: Stage 2 Exam Tips -- building glow, protected zones, hitbox attack on zones, star students"
    status: completed
  - id: phase9-share
    content: "Phase 9: Stage 3 Share Tips -- QR generation, scanning chain, cooldowns, stage completion"
    status: completed
  - id: phase10-exam
    content: "Phase 10: Stage 4 Final Exam -- PW integration, layer distribution, answer submission, exam timer"
    status: completed
  - id: phase11-transcript
    content: "Phase 11: End game -- win conditions, transcript with 3D characters, stats table, MVP"
    status: completed
  - id: phase12-events
    content: "Phase 12: Events -- mystery boxes, mock exam event, hitbox challenge, post-event buffer"
    status: completed
isProject: false
---

# FireChick Full Game Implementation Plan

## Current State Summary

**Already built and working:**

- Lobby join flow (Host/Client, WebRTC + Supabase, room codes, discovery)
- Character system (8 colors, 5 animations via GLB, `CharacterViewer`)
- Color picking in lobby (`ColorPicker`)
- Thumbstick controller, AttackButton, PropsButton, ScannerBox
- Grade/health system (`gradeSystem.ts`)
- Basic game logic hook (`useGameLogic.ts`) with phases, role assignment, movement, stages
- GameplayMap with buildings, obstacles, collision
- VideoOverlay (Hurt/Dead), HealthDisplay, StageProgressBar
- CharacterReveal, PW Exam page, ExamTips page (QR sharing via Supabase)
- TranscriptView component (exists but not integrated)

**Known bugs to fix:**

- Characters use Idle animation when moving in gameplay (should be Running)
- Characters get stuck inside walls (collision detection issue)
- Eagle can get stuck on wrong side of wall after fly

**Assets confirmed present at:**

- `/public/FireChick/FireChick_Animation/FireChick_{Anim}/{Anim}_{Color}.glb`
- `/public/FireChick/FireChick_Models/FireChick_{Color}.glb`
- `/public/Animations/Hurt.mp4`, `/public/Animations/Dead.mp4`
- `/public/PW/PW_{Mock|Final}_{1-4}_layer-{1|2}.png`

---

## Phase 1: Bug Fixes (Animation + Collision)

### 1A. Fix character animation in gameplay

**Problem:** [GameplayMap.tsx](src/components/GameplayMap.tsx) renders `GameCharacter` but the animation state derivation is wrong -- characters stay in Idle while moving.

**Fix in `GameplayMap.tsx`:**

- The `GameCharacter` component needs to derive animation from player velocity/movement, not just pass a static state
- When `speedMultiplier > 0` or player position is changing frame-to-frame, use `Running`
- When stationary, use `Idle`
- When eagle uses fly prop, use `Attack` animation
- When attack button pressed (eagle), play `Attack` once then return to previous state

**Fix in `CharacterViewer.tsx`:**

- Ensure `animState` transitions properly with fade-in/fade-out
- The `Attack` animation should support one-shot mode (play once, not loop) for attack action vs loop for fly

### 1B. Fix wall collision (characters stuck in walls)

**Problem in [gameplayMapData.ts](src/lib/gameplayMapData.ts):**

- `checkCollision` returns boolean but doesn't push the player out
- Need to add a **resolution vector** that slides the player along walls instead of stopping them

**Fix:**

- Change `checkCollision` to return `{ blocked: boolean, resolvedX: number, resolvedZ: number }`
- Implement AABB push-out: when a player overlaps a wall, push them to the nearest edge
- Apply in `useGameLogic.ts` movement update loop

### 1C. Fix eagle fly through walls without getting stuck

- During fly (Attack animation + speed x3 for 0.5s), skip collision checks for obstacles (not map bounds)
- After fly ends, if eagle is inside a wall, push them to the nearest open space using the collision resolution from 1B
- Ensure the eagle lands on the correct side (direction they were traveling)

---

## Phase 2: Lobby Polish

### 2A. Start button positioning and styling

**File:** [Host.tsx](src/pages/Host.tsx)

- Move START GAME button from inline with header controls to **top center** of the screen
- Cyber-styled: glowing border animation, pulsing neon effect, larger size
- Only visible when `isFull` (player count === maxPlayers)

### 2B. Color picker: grey out taken colors (exclude self)

**File:** [ColorPicker.tsx](src/components/ColorPicker.tsx)

- Currently disables taken colors; verify it shows them as grey (not just disabled)
- Ensure the player's own current color is NOT greyed out even though it's "used"
- Visual: grey fill + reduced opacity for taken-by-others

### 2C. 2v6 mode: color selection prompt with eagle indicators

**File:** [Client.tsx](src/pages/Client.tsx) (the 2v6 color selection screen at line 181)

- Show red outline/border on Black and Gold color circles to indicate eagle roles
- All 8 colors visible; once chosen by another, grey them out
- After all 8 players pick, auto-advance to lobby

---

## Phase 3: Core Game Flow

### 3A. Reveal phase (random eagle assignment for 1v3)

**File:** [useGameLogic.ts](src/hooks/useGameLogic.ts)

- **1v3:** Randomly pick 1 of 4 players to be eagle, randomly assign Black or Gold
- **2v6:** Eagle roles already determined by color choice (Black/Gold), skip random assignment
- Broadcast `game-start` with assignments to all clients

### 3B. Host countdown screen (10 seconds)

**File:** [Host.tsx](src/pages/Host.tsx) lines 167-181

- Change countdown from 3 seconds to 10 seconds
- Show large countdown number with cyber styling
- During this time, clients see their character reveal (5s) then gameplay controller

### 3C. Client character display during reveal

**File:** [CharacterReveal.tsx](src/components/CharacterReveal.tsx)

- Show static 3D model rotating (already implemented)
- Show color name underneath the character
- Display for 5 seconds, then transition to gameplay controller screen
- Ensure eagle players see eagle character, chicks see their chick color

### 3D. Gameplay map (4x larger, fixed camera)

**Files:** [GameplayMap.tsx](src/components/GameplayMap.tsx), [gameplayMapData.ts](src/lib/gameplayMapData.ts)

- Current map: 32x32 (`MAP_SIZE=32`), lobby is ~16x16 -> map is already 2x lobby on each side
- Increase to `MAP_SIZE=64` (4x area of lobby's 16x16)
- Camera: fixed overhead-angled view (similar to lobby), adjust zoom/position so entire 64x64 field is visible
- 4 buildings at corners with buffer space (~2 chick-widths from map edge)
- Short bar obstacles (open curves/lines) scattered for chase dynamics
- Ensure all buildings are reachable from any point (no dead ends)

---

## Phase 4: Client Gameplay UI Layout

### 4A. Chick client layout

**File:** [Client.tsx](src/pages/Client.tsx) lines 287-418

Layout (top to bottom):

- **Top:** Scanner rectangle (same aspect ratio as PW exam: 873x457), tap to toggle camera on/off
- **Middle:** Thumbstick
- **Bottom row (left to right):** 2 rectangles (for social circle / tips indicators) + 1 circle props button

### 4B. Eagle client layout

- **Top:** Hitbox rectangle (same size as scanner), for clicking count
- **Middle:** Thumbstick  
- **Bottom row:** Large attack button (left) + circle props button (right)
- No scanner, no 2 rectangles

### 4C. Props display

**File:** [PropsButton.tsx](src/components/PropsButton.tsx)

- Circle with props icon
- Below circle: square with QR code (for tips sharing stage)
- Count badge overlay
- Arrow ">" on top when multiple prop types, swipe up to switch
- Speed x2 for 0.5s, Heal (+1 grade if not max)
- Eagle special: Fly prop (Attack animation + speed x3 + ignore obstacles for 0.5s)

---

## Phase 5: Combat System

### 5A. Attack validation and execution

**File:** [useGameLogic.ts](src/hooks/useGameLogic.ts)

- Eagle mesh overlap check with chick meshes (using `checkOverlap` with appropriate threshold)
- On valid attack: play Attack animation once on eagle
- 5-second cooldown on attack button regardless of hit/miss
- On successful hit:
  - Apply damage (drop 2 grades via `applyDamage`)
  - Freeze ALL players + game time
  - Play video: Dead.mp4 if any chick died, Hurt.mp4 if hurt only (most serious result)
  - If multiple chicks hit, damage all but play only one video
  - After video: unfreeze, eagle gets extra 5s movement freeze + 5s attack cooldown
  - If chick dies: eliminate from game, show big "F" on their client

### 5B. Video overlay system

**File:** [VideoOverlay.tsx](src/components/VideoOverlay.tsx)

- Already implemented; verify it works with freeze/unfreeze flow
- Ensure `preloadVideos()` is called on host mount

### 5C. Health display

**File:** [HealthDisplay.tsx](src/components/HealthDisplay.tsx)

- Position: top right of host screen
- Show: color dot, grade letter (large), numeric health, star indicator
- Dead players: "F" with reduced opacity

---

## Phase 6: Props System

### 6A. Prop spawning

**File:** [useGameLogic.ts](src/hooks/useGameLogic.ts)

- Speed Up props: spawn randomly on map every 10-12 seconds
- Heal props: spawn every 30 seconds
- Visual on map: glowing pickup marker at spawn point
- Chicks pick up by overlapping; accumulate in inventory

### 6B. Chick props

- **Speed Up:** 2x speed for 0.5 seconds
- **Heal:** +1 grade (if not at max A+ 4.3)
- **Invincible:** (Star student reward) 3 seconds, ignore all attacks
- Start with 2 initial props (1 speed, 1 heal)

### 6C. Eagle props

- **Fly:** Attack animation + 3x speed for 0.5s in facing direction, ignore all obstacles
- After fly ends: resolve position to valid space if inside wall

### 6D. Eagle awakening delay

- Chicks get 5 extra seconds of movement before eagle can move
- Show "Eagle awakens in Xs" countdown on host
- Eagle client shows "Waking up..." during delay

---

## Phase 7: Stage 1 -- Social Circle

### 7A. Overlap detection

**File:** [useGameLogic.ts](src/hooks/useGameLogic.ts)

- Each chick must overlap every other chick at least once
- 1v3: each chick needs 2 contacts; 2v6: each chick needs 5 contacts
- Track via `socialCircleMet` Set per player

### 7B. Client UI indicators

**File:** [Client.tsx](src/pages/Client.tsx)

- 2 rectangles at bottom: each fills green when one contact is made
- Both green = this chick has completed social circle
- Host validates overlap, sends confirmation to clients

### 7C. Stage completion

- When ALL alive chicks have met all others -> advance to Stage 2
- Broadcast phase change to all clients

---

## Phase 8: Stage 2 -- Get Exam Tips

### 8A. Building glow activation

**File:** [useGameLogic.ts](src/hooks/useGameLogic.ts), [GameplayMap.tsx](src/components/GameplayMap.tsx)

- 2 diagonal buildings glow (one = T1, one = T2)
- Use `DIAGONAL_PAIRS` from `gameplayMapData.ts`

### 8B. Protected zones

- Golden sphere around glowing buildings (radius = 1 chick size + buffer)
- Attacks invalid when chick is fully inside zone
- Eagle can enter zone and use Hitbox to attack the zone itself (50 HP each)
- Hitbox UI: gate-open animation when eagle enters zone, ripple on click, -1 HP per click
- If eagle leaves zone before destroying it: zone HP resets
- When zone broken: deactivated (grey), normal attacks valid inside
- Display zone HP above the sphere

### 8C. Star Student mechanic

- Chick overlaps protected zone for 7 seconds (show timer) -> becomes Star Student
- One building = one star student (1v3); 2v6: each building needs 2 star students (2 visits)
- Star student rewards: +5 sub-grades, 1 invincible prop
- Display star icon next to color in HealthDisplay
- Building glow disappears when tips obtained

### 8D. 2v6 differences

- Still 2 diagonal buildings, but each needs 2 separate star students
- Total: 2-4 star students possible

---

## Phase 9: Stage 3 -- Share Exam Tips (concurrent with Stage 2)

### 9A. Stage indicator

- Host progress bar updates to "Stage 2 & 3" once first tip is obtained
- Clear the 2 rectangular boxes on all clients when entering Stage 2

### 9B. Tips holding and sharing

- Star student's corresponding box turns gold with text "Tips 1" or "Tips 2"
- Tap the box -> generate QR code on screen (reuse ExamTips.tsx logic)
- Other chicks scan with scanner -> first scanner gets the tip
- 3-second loading ("Copying...") on receiver
- 5-second cooldown on the QR box before it can generate again
- Chain sharing: receivers become Tips Holders too

### 9C. Stage completion

- When all alive chicks have both Tips 1 and Tips 2 -> advance to Stage 4

---

## Phase 10: Stage 4 -- Final Exam

### 10A. Exam venue entry

- All alive chicks must enter any building -> exam starts
- Broadcast exam phase to all clients

### 10B. Exam UI -- Client

**File:** [Client.tsx](src/pages/Client.tsx)

- Replace thumbstick with PW exam camera overlay (from PWExam.tsx)
- Distribute: 1 random player gets layer-1, others get layer-2
- Adjustable zoom/opacity sliders (reuse PWExam controls)
- Replace 2 rectangles with answer input field, props button becomes submit button
- 1v3: 45s timer, 2v6: 60s timer

### 10C. Exam logic

**File:** [useGameLogic.ts](src/hooks/useGameLogic.ts)

- Choose 1 random Final Exam question from PW (questions 1-4)
- Do NOT reveal which question to players
- One correct answer from any player = team success
- Each incorrect answer: -1 grade to ALL players
- If layer-1 holder dies during exam: -1 grade to all, layer-1 shown on host screen
- If only 1 player alive at Stage 4: they see layer-1 on screen, hold layer-2 on phone
- Eagle: show tip text "Distract the chicks in real life!"

---

## Phase 11: End Game and Transcript

### 11A. Win conditions

- **Eagle wins:** Eliminate 3 chicks (1v3) or >4 chicks (2v6)
- **Eagle draws:** Eliminate 2 (1v3) or 4 (2v6)
- **Chicks win:** Someone solves the Final Exam
- **Chicks lose:** All chicks eliminated

### 11B. Transcript page

**File:** [src/pages/Host.tsx](src/pages/Host.tsx) (new gameover phase), [TranscriptView.tsx](src/components/TranscriptView.tsx)

- MVP appears first (2s announcement, left-most position) with Victory animation + glitter
- Same-team players by rank appear next (6s Victory animation)
- Then slide all 3D characters up, show remaining characters in Idle below
- Stats table titled "Transcript":
  - Chicks: letter grade (large), survival time, damage taken, action score
  - Eagles: damage dealt, action score (hitbox clicks, damage, etc.)
- Action score: props used, riddles solved, correct answers, star student status, etc.

### 11C. Client end screen

- Winners: see their character doing Victory dance + congratulations/MVP message
- Losers: see their character in Idle + result

---

## Phase 12: Events and Riddles System

### 12A. Mystery box spawning

- Every 60 seconds, a Mario-style "?" box spawns on the map
- Active after random 10-15 seconds (countdown visible)
- Chick touches: 3x Speed Up props
- Eagle touches: triggers a challenge event, freeze + pause game time

### 12B. Mock Exam event

- Host screen: display one Mock question layer from PW
- Host gets one layer, players get the other
- Fastest correct answer: +1 sub-grade
- Slowest (if all finish): -1 sub-grade
- 30 second limit; failure = -2 sub-grades to all chicks

### 12C. Hitbox challenge event

- Chick scanner becomes hitbox, eagle keeps hitbox
- 3-2-1 countdown, then 10 seconds of clicking
- Average chick clicks vs eagle clicks
- Chick wins: everyone +2 sub-grades
- Eagle wins: -2 sub-grades (fail)

### 12D. Post-event buffer

- After any event: both eagles frozen 5 seconds (buffer for chicks to run)
- Game resumes regardless of hurt/dead results

---

## Key Files to Modify


| File                                  | Changes                                                       |
| ------------------------------------- | ------------------------------------------------------------- |
| `src/hooks/useGameLogic.ts`           | Major expansion: all game stages, combat, props, events, exam |
| `src/lib/gameTypes.ts`                | New types for events, exam state, expanded messages           |
| `src/lib/gameplayMapData.ts`          | Map size increase, collision resolution, protected zones      |
| `src/components/GameplayMap.tsx`      | Larger map, protected zone visuals, prop spawns, ? boxes      |
| `src/components/CharacterViewer.tsx`  | Animation fix, one-shot attack support                        |
| `src/pages/Host.tsx`                  | Start button, exam phase, transcript integration              |
| `src/pages/Client.tsx`                | Layout overhaul, exam UI, tips sharing                        |
| `src/components/ColorPicker.tsx`      | Grey out taken colors, 2v6 eagle indicators                   |
| `src/components/PropsButton.tsx`      | Multi-prop switching, QR display                              |
| `src/components/ScannerBox.tsx`       | Toggle on/off, tips scanning                                  |
| `src/components/AttackButton.tsx`     | Integration with freeze/cooldown                              |
| `src/components/HealthDisplay.tsx`    | Star student indicator, positioning                           |
| `src/components/StageProgressBar.tsx` | Combined stage labels                                         |
| `src/components/TranscriptView.tsx`   | Full integration with stats                                   |
| `src/components/VideoOverlay.tsx`     | Verify freeze/unfreeze flow                                   |
| `src/components/LobbyArena.tsx`       | Animation fix (Running not Idle)                              |


---

## Implementation Order

Strictly sequential -- each phase builds on the previous:

1. **Phase 1** (Bug fixes) -- foundation for everything else
2. **Phase 2** (Lobby polish) -- clean entry experience
3. **Phase 3** (Core game flow) -- reveal, countdown, map
4. **Phase 4** (Client UI layout) -- gameplay controllers
5. **Phase 5** (Combat) -- attack, damage, freeze, video
6. **Phase 6** (Props) -- spawning, usage, eagle fly
7. **Phase 7** (Stage 1: Social Circle) -- first stage
8. **Phase 8** (Stage 2: Exam Tips) -- buildings, protected zones
9. **Phase 9** (Stage 3: Share Tips) -- QR sharing chain
10. **Phase 10** (Stage 4: Final Exam) -- PW integration
11. **Phase 11** (End game / Transcript) -- results display
12. **Phase 12** (Events) -- ? boxes, mock exam, hitbox challenge

