# Fix & Enhance Plan — 11 Items

## 1. Focus Camera Panel on Host Gameplay

**File: `src/pages/Host.tsx**`

- Add a notification-style button (iPhone pull-down icon) at top-center of the gameplay screen (`z-20`).
- On click, toggle a panel overlay showing N rectangular screens (one per alive player) in a horizontal flex row.
- Each screen is a small `<Canvas>` with a camera following that player's position, using `OrbitControls` (zoom, rotate, but no movement control). Camera `target` is the player's `position`, updated each frame via `useFrame`.
- A close button or tap-outside dismisses the panel.
- The leaderboard and stop watch timer height will locate right under the panel when toggle, relocate to original when dismisses the panel.

## 2. Eagle Attack/Fly Disabled During Video

**Files: `src/pages/Client.tsx`, `src/hooks/useGameLogic.ts**`

- Client: The `AttackButton` already has a `disabled` prop. Pass `disabled={myState.frozen || !!videoOverlayActive}` where `videoOverlayActive` is derived from `gameState?.videoPlaying`.
- Game logic: In `onVideoComplete`, after the existing freeze logic, also disable fly: set `flyCooldownUntil = now + FREEZE_DURATION + ATTACK_COOLDOWN` (≈18s total from attack hit). The attack cooldown is already set to `now + FREEZE_DURATION + ATTACK_COOLDOWN` — match fly to that same value.
- In the `prop-use` → `fly` handler, add check: `if (now < player.attackCooldownUntil) return;` to block fly while attack is on cooldown (post-video).

## 3. Video Overlay Z-Index Fix (Portal)

**File: `src/components/VideoOverlay.tsx**`

- Render the overlay via `ReactDOM.createPortal(...)` into `document.body` so it escapes any stacking context. This guarantees it sits above all other elements regardless of parent z-index.

## 4. Mock Exam Layer on Host — Portal

**File: `src/pages/Host.tsx**`

- Same portal approach: when `snapshot.activeEvent?.type === 'mock-exam'` and phase is `active`, render the `EventOverlay` via `createPortal` into `document.body` with `z-index: 9998` (below video overlay at 9999).

## 5. Mock Exam Layer 2 on Client Scanner

**File: `src/pages/Client.tsx**` (mock-exam active phase, lines ~847-897)

- For chick players: show layer 2 image inside the scanner box area (replace scanner with the exam image). Currently the image renders but may not appear if the layout doesn't match the scanner's aspect ratio. Fix by using the same `aspectRatio: "873/457"` container with `w-full` and placing the layer-2 image inside it at full width.
- Make sure the layer 2 is there overlaying when the camera is on so that the visual cryptography can work.

## 6. Mock Exam Client Submit Button

**File: `src/pages/Client.tsx**` (lines ~847-897)

- Already has Input + Submit button for mock exam (lines 868-894). Verify the submit button works — add `hasSubmittedMockExam` state to prevent double submission. After submit, replace the form with "✓ Submitted" text.
- After the countdown/all good chicks have submitted, the client side will tell the user whether the answer is correct or not. and the host side will display which chicks fails. then main game continue after checking whether there are chicks received F-grade afte the grade deduction. (details in point 7)

## 7. F-Grade Elimination After Events

**File: `src/hooks/useGameLogic.ts**`

- After hitbox event result processing (lines 729-738), add F-grade elimination check:
  ```
  for (const [, p] of gs.playerStates) {
    if (!p.isEagle && p.alive && isDead(p.health)) {
      p.alive = false; p.health = 0;
      currentBroadcast({ type: "you-died", connId: p.connId });
    }
  }
  ```
- The mock-exam eagle-win path already has this check (lines 748-752). Verify the chick-win path also checks.

## 8. End Game Characters Rotated 180°

**File: `src/pages/Host.tsx**` (`DancingChar` component, line ~102-110)

- The `facingAngle` starts at the `delay` value and increments. Add `Math.PI` offset so characters face the camera:
  ```
  const angleRef = useRef(delay + Math.PI);
  ```

## 9. End Game Character Base at 2/5 Screen Height

**File: `src/pages/Host.tsx**`

- In the transcript phase (Phase 3), change the Canvas camera position to look slightly downward and move the character group down. Set the Canvas container height to fill more space, and adjust camera `position` and `fov` so characters are visible with heads not clipped by the header.
- Move the MVP/team showcase Canvas camera position similarly: `position: [0, 2, 4]` and lower `fov` to ~30.

## 10. Client Reveal Timer: 7s Rotation + 3s Countdown = 10s

**Files: `src/components/CharacterReveal.tsx`, `src/hooks/useGameLogic.ts`, `src/pages/Host.tsx**`

- `CharacterReveal.tsx`: Change `duration = 7000` (from 5000). The component already handles the countdown display.
- `useGameLogic.ts`: Change `REVEAL_DURATION = 7000` (from 5000), `COUNTDOWN_DURATION = 3` stays.
- `Host.tsx`: The reveal countdown uses `startClickAt` with 8s total. Change to 10s: `Math.max(0, 10 - (revealNow - startClickAt) / 1000)`.

## 11. Client Reveal Character Base at 2/3 Screen Height

**File: `src/components/CharacterReveal.tsx**`

- The Canvas currently uses `flex-1` for the 3D area. Change the layout so the Canvas takes up 2/3 of `h-dvh` and the info panel takes 1/3. Adjust camera position to `[0, 2.2, 3.8]` and `lookAt(0, 0.6, 0)` so the character's feet are visible and head isn't clipped.

---

## Files Modified Summary


| File                                 | Changes                                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `src/pages/Host.tsx`                 | Focus camera panel, portal for mock exam, DancingChar 180° rotation, character base positioning, 10s reveal timer |
| `src/pages/Client.tsx`               | Attack disabled during video, mock exam layout fix, submit state tracking                                         |
| `src/hooks/useGameLogic.ts`          | Fly disabled post-attack, F-grade elimination after hitbox, REVEAL_DURATION=7000                                  |
| `src/components/VideoOverlay.tsx`    | Portal rendering for guaranteed top layer                                                                         |
| `src/components/CharacterReveal.tsx` | 7s duration, character base at 2/3 height                                                                         |
