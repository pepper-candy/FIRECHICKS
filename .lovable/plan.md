# Fix & Enhance Plan — 13 Items

## 1. Smooth Character Rotation in Reveal

**File: `src/components/CharacterReveal.tsx**`

- Replace the `setInterval` + `Date.now()` approach with `requestAnimationFrame` for smooth per-frame angle interpolation. Use a ref for elapsed time and update via rAF delta, producing a continuous rotation instead of jumpy 100ms steps.

## 2. Eagle Fly Cooldown (10s)

**File: `src/hooks/useGameLogic.ts**`

- Add `FLY_COOLDOWN = 10000` constant.
- In the `fly` prop-use handler, track `flyCooldownUntil` on the player state (add to `PlayerGameState`).
- Block fly activation if `now < flyCooldownUntil`. Set `flyCooldownUntil = now + FLY_COOLDOWN` after each use.
- Broadcast `flyCooldownUntil` in serialized state so client can show countdown.

**File: `src/lib/gameTypes.ts**` — Add `flyCooldownUntil: number` to both `PlayerGameState` and `PlayerGameStateSerializable`.

## 3. Tip Obtain Countdown Overlap Fix

**File: `src/pages/Host.tsx**`

- Change the tip obtain countdown display from a single absolute-positioned element to a stacked list (flex column) at the top of the screen so multiple countdowns don't overlap.

## 4. Tips Persist After Zone Break

**File: `src/hooks/useGameLogic.ts**`

- In the hitbox-click handler, when `b.zoneHealth <= 0`: set `b.zoneActive = false` and `b.glowing = false`, but do NOT set `b.hasTip = false` or `b.tipObtained = true`. Tips remain obtainable — chicks just lose protection. Already mostly correct; verify `b.hasTip` is never set to false when zone breaks.

## 5. Hitbox Challenge: Average of Chicks vs Sum of Eagle

**File: `src/hooks/useGameLogic.ts**` (line ~706-716)

- Currently computes `avgChick` (total/count) vs `avgEagle` (total/count). Change to: `avgChick` (total/aliveChickCount) vs `eagleTotal` (raw sum, no averaging for 1v3 and  average of the 2 eagles in 2v6). Remove the eagle averaging calculation for 1v3, but not 2v6.

## 6. Tip QR Expiry → 5s Cooldown on Rectangular Box

**File: `src/pages/Client.tsx**`

- When `scannerQrExpireAt` fires (QR expires), set `tipShareCooldownLocal[tipIndex] = Date.now() + 5000` in local state.
- In `TipsBox`, show "⏳ 5s" countdown when local cooldown is active, preventing clicks.
- When host sends `tipShareCooldownUntil` via game state, use the larger of local and server cooldowns.

## 7. Tip Receiver: 3s Copying Countdown in Box

**File: `src/pages/Client.tsx**`

- Already has `loadingTip` state with 3s timeout. Pass `tipCopyingCountdown` to `TipsBox` — compute from a `tipCopyStartedAt` ref so the countdown displays seconds remaining (3, 2, 1) inside the rectangular box. Currently `tipCopyingCountdown` prop exists in `TipsBox` but isn't being computed properly from the caller.

## 8. Props Usable During Walking (Critical Fix)

**Root cause**: The prop-use message is sent via `sendToHost` which uses the data channel. The issue is likely that on the client side, the thumbstick `onMove` is continuously sending joystick data, and the prop button's `onClick` handler doesn't fire reliably on mobile while the thumbstick touch is active (touch event conflict).

**Fix approach in `src/pages/Client.tsx**`:

- Change `PropsBtn` button from `onClick` to `onPointerDown` with `stopPropagation` to avoid touch conflicts with the thumbstick.
- Ensure the prop button is outside the thumbstick touch area and uses pointer events that don't interfere.
- Add `touch-action: manipulation` to the props button to prevent delays.

## 9. Mock Exam: Layer 1 Display on Host

**File: `src/pages/Host.tsx**`

- When `snapshot.activeEvent?.type === 'mock-exam'` and phase is `active`, show layer 1 image full-size centered with white background, at `z-index: 40+` (above all other overlays including health/stage/zoom controls/props tags).
- On client side, layer 2 image in scanner area + answer input replacing the 2 tip boxes. One submission only per event — track `hasSubmittedEvent` state.

**Grade F elimination fix**: In `useGameLogic.ts` event result handling and answer-submit handler, after applying grade changes, iterate all players and set `alive = false` for any with `health <= 0` or `isDead(health)`, then broadcast `you-died`.

## 10. Video Overlay Z-Index Fix

**File: `src/components/VideoOverlay.tsx**` — Already has `z-index: 9999`.
**File: `src/pages/Host.tsx**` — Move `<VideoOverlay>` to be the LAST child in the render tree (after all other overlays). Ensure no other element has a higher z-index or creates a new stacking context that traps it.

## 11. End Game Conditions (Revised)

**File: `src/hooks/useGameLogic.ts**`

- Remove the continuous win-check in the game loop that auto-ends on draw/low chick count during playing phase.
- Only auto-end when ALL chicks are dead → eagle wins.
- After Final Exam completion: check alive chick count for chicks-win vs draw.
- MVP selection: highest `actionScore` among the winning team (or between eagle and last chick in draw).

**1v3**: 0 chicks = eagle wins. After exam: 1+ chicks = chicks win, 1 chick = draw.
**2v6**: 0 chicks = eagle wins. After exam: 3+ chicks = chicks win, 1-2 chicks = draw.

## 12. End Game Ceremony (5s MVP → 5s Team → Transcript)

**File: `src/pages/Host.tsx**` (gameover section)

- Add phased reveal using local state: `ceremonyPhase: 'mvp' | 'team' | 'transcript'`
- Phase 1 (0-5s): Show MVP character in Victory animation, centered, with name and "MVP" badge.
- Phase 2 (5-10s): Show winning team characters in Victory animation (skip if draw or 1v3 eagle solo win). Title: "Fire Chicks Win!" or "GAP Killers Win!".
- Phase 3 (10s+): Full transcript with all characters (winners in Victory, losers in static Idle) and stats table.

**File: `src/pages/Client.tsx**` (gameover section) — Similar phased display.

## 13. Route Separation for Preview/Debug

**File: `src/App.tsx**` — Add dedicated routes for each game phase/stage so they can be viewed independently:


| Route              | Component               | Purpose                           |
| ------------------ | ----------------------- | --------------------------------- |
| `/`                | GameIndex               | Home/landing                      |
| `/pw-exam`         | PWExam                  | PW exam tool (renamed from `/pw`) |
| `/exam-tips`       | ExamTips                | Exam tips page                    |
| `/character`       | Character               | Character viewer                  |
| `/host-lobby`      | Host (lobby phase)      | Host lobby                        |
| `/host-reveal`     | Host (reveal phase)     | Host reveal countdown             |
| `/host-gameplay`   | Host (playing phase)    | Host gameplay map                 |
| `/host-exam`       | Host (exam phase)       | Host exam overlay                 |
| `/host-gameover`   | Host (gameover phase)   | Host end game                     |
| `/client-join`     | Client (join screen)    | Client join                       |
| `/client-lobby`    | Client (lobby phase)    | Client lobby controller           |
| `/client-reveal`   | Client (reveal phase)   | Client character reveal           |
| `/client-gameplay` | Client (playing phase)  | Client remote controller          |
| `/client-exam`     | Client (exam phase)     | Client exam view                  |
| `/client-gameover` | Client (gameover phase) | Client end game                   |


**Implementation**: Extract each phase rendering block from `Host.tsx` and `Client.tsx` into standalone wrapper components that accept mock/default props. The main `/host` and `/client` routes continue to work as the full game flow. The phase-specific routes render the same components with mock data for preview purposes.

This adds ~10 small wrapper files in `src/pages/preview/` that import and render individual phases with placeholder data.

---

## Files Modified Summary


| File                                       | Changes                                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `src/components/CharacterReveal.tsx`       | Smooth rAF rotation                                                                             |
| `src/hooks/useGameLogic.ts`                | Fly cooldown, hitbox avg fix, zone break tips fix, F-grade elimination, win conditions overhaul |
| `src/lib/gameTypes.ts`                     | Add `flyCooldownUntil` field                                                                    |
| `src/pages/Host.tsx`                       | Tip countdown stacking, video overlay ordering, mock exam layer 1 display, ceremony phases      |
| `src/pages/Client.tsx`                     | Props touch fix, tip cooldowns, copying countdown, ceremony phases                              |
| `src/components/VideoOverlay.tsx`          | Verify z-index stacking                                                                         |
| `src/App.tsx`                              | New routes for preview pages                                                                    |
| `src/pages/preview/*.tsx` (new, ~10 files) | Phase-specific preview wrappers                                                                 |
