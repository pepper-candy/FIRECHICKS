# Separation & UI Enhancement Plan

## Overview

This plan addresses 7 major requests: (1) video overlay as a separate page, (2) minigames as separate pages, (3) final exam as separate page, (4) client controls separated by stage, (5) stage transitions with 5s pause, (6) props repositioned to left of thumbstick, (7) 2v6 room-full bug fix. The goal is to make each moment independently viewable and testable.

## Architecture

```text
NEW PREVIEW ROUTES (mock-data powered, for UI iteration):
  /preview/video-hurt        — Hurt.mp4 playback page with skip
  /preview/video-dead        — Dead.mp4 playback page with skip
  /preview/mock-exam-host    — Mock exam host view
  /preview/mock-exam-client  — Mock exam client view
  /preview/hitbox-host       — Hitbox challenge host view
  /preview/hitbox-client     — Hitbox challenge client view
  /preview/final-exam-host   — Final exam host overlay
  /preview/final-exam-client — Final exam client view
  /preview/chick-stage1      — Chick controller stage 1 (social circle)
  /preview/chick-stage23     — Chick controller stage 2-3 (exam tips)
  /preview/eagle-control     — Eagle controller
  /preview/stage-transition  — 5s stage transition screen

GAME FLOW CHANGES:
  - Video plays on a full-page overlay (portaled) with skip button
  - Stage transitions show a 5s interstitial on both host + client
  - Props listed vertically to the left of thumbstick for chicks
  - Bottom text shows current stage instructions for chicks
```

## Detailed Plan

### 1. Video Overlay Page with Skip Button

**File: `src/components/VideoOverlay.tsx**`

- Keep the portal approach but redesign: full-screen black background, video centered, skip button at bottom-right aligned with video's bottom edge.
- Skip button: small "SKIP ▶" text button, calls `onComplete()`.
- Ensure `z-index: 99999` on the portal container.

### 2. Extract Minigame/Event Components

**New files:**

- `src/components/events/HitboxChallenge.tsx` — Host view (score display, countdown)
- `src/components/events/HitboxClient.tsx` — Client hit button
- `src/components/events/MockExamHost.tsx` — Host layer 1 display (portal)
- `src/components/events/MockExamClient.tsx` — Client layer 2 + camera + submit
- `src/components/events/EventCountdown.tsx` — 3-2-1 countdown shared component
- `src/components/events/EventResult.tsx` — Result display shared component

These are extracted from inline code in `Host.tsx` (lines 28-100) and `Client.tsx` (lines 908-1029). The main pages import and use these components; preview routes render them standalone with mock props.

### 3. Extract Final Exam Components

**New files:**

- `src/components/exam/FinalExamHost.tsx` — Host exam overlay (layer 1 display when holder dies)
- `src/components/exam/FinalExamClient.tsx` — Client exam view (camera + layer overlay + answer input)
- `src/components/exam/EagleExamView.tsx` — Eagle "distract" message

Extracted from `Client.tsx` lines 1032-1141 and `Host.tsx` lines 479-489.

### 4. Extract Client Control Layouts by Stage

**New files:**

- `src/components/controls/ChickStage1Controls.tsx` — Social circle: scanner + 2 "Meet" boxes + thumbstick + props
- `src/components/controls/ChickStage23Controls.tsx` — Exam tips: scanner (with QR display) + 2 tip boxes + thumbstick + props
- `src/components/controls/EagleControls.tsx` — Hitbox + thumbstick + attack + fly prop

Extracted from `Client.tsx` lines 1202-1308. The main `Client.tsx` switches between these based on `stage`.

### 5. Stage Transition Interstitial

**New file: `src/components/StageTransition.tsx**`

- Full-screen overlay showing stage number, name, and brief instruction for chicks.
- Displays for 5 seconds, then auto-dismisses.
- Stage info:
  - Stage 1: "Social Circle — Meet ALL other Chicks! 🐣"
  - Stage 2-3: "Exam Tips — Get TIPS from glowing buildings, then SHARE!"
  - Stage 4: "Final Exam — Run to any building and finish the EXAM!"

**File: `src/hooks/useGameLogic.ts**`

- When `stage` changes, set a `stageTransitionUntil = now + 5000` in game state.
- Freeze all movement during transition.
- Broadcast transition state so both host and client show it.

**File: `src/lib/gameTypes.ts**`

- Add `stageTransitionUntil: number` to `GameStateSnapshot`.

### 6. Props Repositioned for Chicks

**File: `src/components/controls/ChickStage1Controls.tsx` & `ChickStage23Controls.tsx**`

- Layout: scanner at top, tip boxes under scanner, then a row with [props column on left | thumbstick centered-right].
- Props listed vertically (each as a circle button with icon + count badge), spaced with `gap-2`.
- Thumbstick positioned: `marginLeft = propsColumnWidth`, then centered in remaining width.
- Eagle layout unchanged (attack + fly at bottom).

### 7. Bottom Stage Instructions for Chicks

**In each chick control component**, below the `<Color> Chick` indicator:

- Small text showing current objective:
  - Stage 0: "Walk to other chicks to meet them"
  - Stage 1: "Enter glowing buildings for 7s to get tips"
  - Stage 2: "Tap tips to share QR, scan others' tips"
  - Stage 3: "Run to any building to start the exam"

### 8. Fix 2v6 Room-Full Bug (Critical)

**Root cause**: `allocateColor()` in both `useHostWebRTC` (line 157) and `useHostSupabase` (line 324) always passes `EAGLE_COLOR_INDICES` as excluded indices, so Black and Gold can never be assigned, limiting the room to 6 players max.

**Fix in `src/hooks/useGameRoom.ts`:**

- The host hooks need to know the current game mode. Add a `gameModeRef` that the Host page updates.
- Export a `setGameMode` function from the hook, or accept it as a parameter.
- Simpler approach: have `useHostRoom` accept a `gameMode` parameter. When `gameMode === '2v6'`, pass empty array `[]` as `excludeIndices` to `allocateColor()`. When `'1v3'`, pass `EAGLE_COLOR_INDICES`.
- Apply same fix to both WebRTC and Supabase host implementations.
- Also ensure the ColorPicker in 2v6 shows all 8 colors (4 top, 4 bottom) — this already works per `ColorPicker.tsx` logic, but verify the `usedColors` broadcast includes eagle indices.

### 9. Preview Routes

**File: `src/App.tsx**` — Add ~12 new preview routes:


| Route                        | Component                           |
| ---------------------------- | ----------------------------------- |
| `/preview/video-hurt`        | VideoOverlay with `video="hurt"`    |
| `/preview/video-dead`        | VideoOverlay with `video="dead"`    |
| `/preview/mock-exam-host`    | MockExamHost with mock data         |
| `/preview/mock-exam-client`  | MockExamClient with mock data       |
| `/preview/hitbox-host`       | HitboxChallenge with mock data      |
| `/preview/hitbox-client`     | HitboxClient with mock data         |
| `/preview/final-exam-host`   | FinalExamHost with mock data        |
| `/preview/final-exam-client` | FinalExamClient with mock data      |
| `/preview/chick-stage1`      | ChickStage1Controls with mock data  |
| `/preview/chick-stage23`     | ChickStage23Controls with mock data |
| `/preview/eagle-control`     | EagleControls with mock data        |
| `/preview/stage-transition`  | StageTransition with mock stage     |


**New files in `src/pages/preview/**` — Thin wrappers that render each component with mock props.

---

## Files Summary


| File                                               | Action    | Changes                                |
| -------------------------------------------------- | --------- | -------------------------------------- |
| `src/components/VideoOverlay.tsx`                  | Modify    | Add skip button, keep portal           |
| `src/components/events/HitboxChallenge.tsx`        | New       | Host hitbox view                       |
| `src/components/events/HitboxClient.tsx`           | New       | Client hitbox button                   |
| `src/components/events/MockExamHost.tsx`           | New       | Host mock exam layer 1                 |
| `src/components/events/MockExamClient.tsx`         | New       | Client mock exam layer 2 + camera      |
| `src/components/events/EventCountdown.tsx`         | New       | Shared 3-2-1 countdown                 |
| `src/components/events/EventResult.tsx`            | New       | Shared result display                  |
| `src/components/exam/FinalExamHost.tsx`            | New       | Host exam overlay                      |
| `src/components/exam/FinalExamClient.tsx`          | New       | Client exam view                       |
| `src/components/exam/EagleExamView.tsx`            | New       | Eagle distract view                    |
| `src/components/controls/ChickStage1Controls.tsx`  | New       | Chick stage 1 controller               |
| `src/components/controls/ChickStage23Controls.tsx` | New       | Chick stage 2-3 controller             |
| `src/components/controls/EagleControls.tsx`        | New       | Eagle controller                       |
| `src/components/StageTransition.tsx`               | New       | 5s stage interstitial                  |
| `src/hooks/useGameRoom.ts`                         | Modify    | Accept gameMode, fix allocateColor     |
| `src/hooks/useGameLogic.ts`                        | Modify    | Stage transition freeze                |
| `src/lib/gameTypes.ts`                             | Modify    | Add stageTransitionUntil               |
| `src/pages/Host.tsx`                               | Modify    | Use extracted components               |
| `src/pages/Client.tsx`                             | Modify    | Use extracted components, props layout |
| `src/pages/preview/*.tsx`                          | New (~12) | Preview wrappers                       |
| `src/App.tsx`                                      | Modify    | Add preview routes                     |
