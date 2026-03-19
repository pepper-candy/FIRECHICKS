---
name: Barcode Spawn Camera Fixes
overview: Switch all QR codes to Code 128 barcodes, fix character reveal to use static GLB models with 1.25-circle rotation, fix spawn points, fix host camera/zoom, add back buttons, add fullscreen to home, and show all countdown timers.
todos:
  - id: install-jsbarcode
    content: Install jsbarcode package and create shared BarcodeDisplay component
    status: completed
  - id: character-reveal-static
    content: "CharacterReveal: switch to static GLB model with 1.25-circle clockwise rotation over 5 seconds"
    status: completed
  - id: spawn-points
    content: "Update spawn points: chicks at building inner edges, eagle at random edge point"
    status: completed
  - id: timing-fix
    content: "Fix timing: 8s total (5s reveal + 3s countdown), host shows 8s countdown from start click"
    status: completed
  - id: host-camera-zoom
    content: "Fix host camera: center map on screen, add zoom slider, bottom edge above progress bar"
    status: completed
  - id: hide-eagle-leaderboard
    content: "HealthDisplay: filter out eagle from the top-right leaderboard"
    status: completed
  - id: back-button-join
    content: Add < Back button to join game page navigating to /
    status: completed
  - id: fullscreen-home
    content: Add fullscreen button to GameIndex home page
    status: completed
  - id: countdown-timers
    content: Show countdown timers on all cooldowns and timed actions on client
    status: completed
  - id: barcode-lobby
    content: Replace QR with barcode in LobbyArena crystal ball props
    status: completed
  - id: barcode-tips-sharing
    content: Replace QR with barcode in exam tips sharing (scanner area becomes barcode display)
    status: completed
  - id: barcode-exam-tips-page
    content: Replace QR with barcode on /exam-tips standalone page
    status: completed
  - id: remove-qr-dep
    content: Remove react-qr-code dependency after all migrations
    status: completed
isProject: false
---

# Barcode, Spawn, Camera, and UX Fixes

## 1. Install JsBarcode for Code 128 generation

Add the `jsbarcode` npm package (generates Code 128 barcodes to SVG/canvas). This replaces all `react-qr-code` usage across the app.

```
npm install jsbarcode
```

Remove `react-qr-code` from `package.json` once all references are migrated.

## 2. Create a shared `BarcodeDisplay` component

New file: `src/components/BarcodeDisplay.tsx`

- Accepts `value: string` and renders a Code 128 barcode via `JsBarcode` into a canvas ref
- Fits inside the 2:1 scanner aspect ratio (landscape-oriented horizontal bars)
- Used in: lobby crystal ball prop tags, exam tips sharing (in scanner area), `/exam-tips` page

## 3. Character Reveal -- use static GLB model with 1.25-circle rotation

**File:** [src/components/CharacterReveal.tsx](src/components/CharacterReveal.tsx)

- Currently uses `CharacterViewer` (animated GLB from `FireChick_Animation/`). Switch to loading the **static model** from `/FireChick/FireChick_Models/FireChick_{Color}.glb` via `useGLTF`
- Rotate the model exactly 1.25 full clockwise circles over 5 seconds = `1.25 * 2 * PI = 7.854 rad` total, at constant angular velocity `7.854 / 5 = 1.5708 rad/s`
- For the eagle (1v3 randomly assigned), the model should be the eagle color (Black or Gold), and the client UI should transition to eagle controller layout after reveal

## 4. Eagle controller for randomly-picked player (1v3)

**File:** [src/pages/Client.tsx](src/pages/Client.tsx)

- After reveal, the `isEagle` flag from `myAssignment` is already set. The gameplay section already renders eagle vs chick layout based on `isEagle`. Verify this works correctly:
  - Eagle sees: Hitbox (top), Thumbstick (middle), Attack + Props/Fly (bottom)
  - Chick sees: Scanner (top), Thumbstick (middle), TipsBoxes + Props (bottom)
- No logic change needed -- just verify the layout branches after eagle assignment

## 5. Spawn points -- buildings for chicks, random edge for eagle

**File:** [src/lib/gameplayMapData.ts](src/lib/gameplayMapData.ts)

Current `SPAWN_POINTS` are near center. Change to spawn chicks at each building's inner edge (closest to map center):

- Building 0 at `(-22, -22)` -> chick spawn at `(-18, -18)` (inner edge)
- Building 1 at `(22, -22)` -> chick spawn at `(18, -18)`
- Building 2 at `(-22, 22)` -> chick spawn at `(-18, 18)`
- Building 3 at `(22, 22)` -> chick spawn at `(18, 18)`

Add `EAGLE_SPAWN_CANDIDATES` as the same 4 points. In `useGameLogic.ts`, pick one randomly for the eagle.

**File:** [src/hooks/useGameLogic.ts](src/hooks/useGameLogic.ts)

- Use the new building-edge spawn points for chicks
- Pick a random edge point for eagle spawn (from the 4 candidates)

## 6. Timing fix -- 8 second host countdown, 5s reveal + 3s countdown on client

**File:** [src/hooks/useGameLogic.ts](src/hooks/useGameLogic.ts)

- Change `COUNTDOWN_DURATION` from `10` to `8`
- `REVEAL_DURATION` stays at `5000` (5 seconds)
- After reveal (5s), host enters countdown phase showing 3...2...1 (3 seconds)
- Client shows character reveal for 5s, then 3s countdown, then gameplay begins
- Total from start click to gameplay: 8 seconds

**File:** [src/pages/Host.tsx](src/pages/Host.tsx)

- Reveal phase: show 8-second countdown directly (no role info)
- Countdown phase: show final 3...2...1

## 7. Host camera -- fill screen, zoom slider, map centered

**File:** [src/components/GameplayMap.tsx](src/components/GameplayMap.tsx)

- Adjust `MapCamera` to position the map field centered vertically with the bottom edge just above the progress bar
- Add a `zoomLevel` prop (or internal state with a slider control)
- Add a small zoom slider overlay in the top-left corner of the host gameplay screen

**File:** [src/pages/Host.tsx](src/pages/Host.tsx)

- Add `zoomLevel` state, pass to `GameplayMap`
- Render a compact slider overlay in the gameplay phase for host zoom adjustment

## 8. Leaderboard -- hide eagle from health display

**File:** [src/components/HealthDisplay.tsx](src/components/HealthDisplay.tsx)

- Filter out players where `isEagle === true` so the top-right display only shows chick grades

## 9. Back button on Join Game page

**File:** [src/pages/Client.tsx](src/pages/Client.tsx)

- Add a `< Back` button at the top-left of the join screen that navigates to `/`

## 10. Fullscreen button on home page (/)

**File:** [src/pages/GameIndex.tsx](src/pages/GameIndex.tsx)

- Import `useFullscreen` hook
- Add a fullscreen button at the top of the page (similar to the client splash)

## 11. Show countdown timers everywhere

**File:** [src/pages/Client.tsx](src/pages/Client.tsx)

Audit all cooldown/timer interactions and ensure visible countdown text:

- Attack button cooldown: already shows countdown (AttackButton component)
- Tip QR cooldown: show seconds remaining on the tip box
- Exam tips obtain (7s at building): host broadcasts timer progress, client shows "Obtaining tips... Xs"
- Invincible duration: show "Invincible Xs" near health
- Speed boost: show "Speed Xs" briefly
- Exam timer: already shown

## 12. Barcode migration across all files

### a. Lobby crystal ball props

**File:** [src/components/LobbyArena.tsx](src/components/LobbyArena.tsx)

- Replace `QRCode` import/usage with `BarcodeDisplay` in the crystal ball price tag section

### b. Gameplay prop markers

**File:** [src/components/GameplayMap.tsx](src/components/GameplayMap.tsx)

- Not currently showing QR on map props -- no change needed (props are crystal balls now)

### c. Exam tips sharing (in-game)

**File:** [src/pages/Client.tsx](src/pages/Client.tsx)

- When a star student taps their tip box to share, instead of showing a QR code overlay, replace the scanner area with a `BarcodeDisplay` showing the tip code
- Tapping the scanner area while barcode is displayed closes the barcode (equivalent to toggling scanner back on) and starts cooldown
- Successful scan: toast message on both sender and receiver sides

### d. `/exam-tips` standalone page

**File:** [src/pages/ExamTips.tsx](src/pages/ExamTips.tsx)

- Replace `QRCode` with `BarcodeDisplay` for the holder view
- Scanner (`qr-scanner` library) already reads Code 128 barcodes -- verify and test

### e. Remove `react-qr-code` dependency

After all references are migrated, remove from `package.json`.