# Damage Flash, Prop-Use Effects & Haptic Feedback

## 1. Red Damage Flash on Client Screen

**What**: When a chick takes attack damage(only attack, other damage no), a full-screen red overlay flashes and fades out with a "melting ice" dissolve effect.

**How**:

- In `Client.tsx`, track `myState.damageTaken` with a `useRef` for the previous value
- When it increases, set a `damageFlash` state to `true`
- Render a fixed full-screen `<div>` with red background that uses a CSS animation: instant red at full opacity → fade out over ~3000ms with a downward gradient dissolve (top clears first, bottom lingers — "melting ice" effect)
- Add a `@keyframes damage-flash` in `tailwind.config.ts` that goes from `opacity:0.6` to `opacity:0` with a vertical mask transition
- Auto-clear the state after animation ends (~3000ms)
- Reset tracking on phase change to lobby
- It is ok to keep it up to 5000ms, as the video of being attack is 8 sec long

## 2. Prop-Use Screen-Edge Color Pulse

**What**: When the player (or any player for eagle attack) uses a prop, a brief radial color pulse flashes at screen edges.

**How — Client-side only (no new host message needed)**:

- Track `myState` fields to detect prop usage locally:
  - `speedMultiplierUntil` increases → speed (yellow)
  - `health` increases → heal (green)  
  - `invincibleUntil` increases → invincible (golden ripple, more obvious)
  - `flyCooldownUntil` increases → fly (cyan)
  - `cagedUntil` increases on any player → cage was used (red, for the caged player)
  - Teleport confirm → purple
- Set a `propFlash` state with the color, render a full-screen `<div>` with a `box-shadow: inset 0 0 80px <color>` that fades out over 400ms
- For eagle attack (public): detect when any chick's `damageTaken` increases (already handled by damage flash for the victim; for the eagle player, flash red outward on successful attack via `damageDealt` increase)
- Add `@keyframes prop-pulse` to tailwind config

## 3. Haptic Feedback

**What**: Short vibration buzz on valid button presses.

**How**:

- Create a utility `src/lib/haptics.ts` with `export function buzz(ms = 50) { navigator?.vibrate?.(ms); }`
- Call `buzz()` in:
  - `AttackButton.tsx` — inside `onPointerDown` when `!inactive`
  - `CooldownRingButton` in `EagleControls.tsx` — when not on cooldown
  - `PropsStackBtn` / `PropsBtn` in `Client.tsx` — on valid press
  - `ChickStage1Controls.tsx` prop buttons — on press
- Wrapped safely with optional chaining, no-ops on unsupported browsers

## Files to Modify


| File                                              | Changes                                                        |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `src/pages/Client.tsx`                            | Add damage flash + prop pulse overlays with useEffect tracking |
| `src/index.css` or `tailwind.config.ts`           | Add `damage-flash` and `prop-pulse` keyframe animations        |
| `src/lib/haptics.ts`                              | New file — `buzz()` utility                                    |
| `src/components/AttackButton.tsx`                 | Add `buzz()` call                                              |
| `src/components/controls/EagleControls.tsx`       | Add `buzz()` in CooldownRingButton                             |
| `src/components/controls/ChickStage1Controls.tsx` | Add `buzz()` on prop press                                     |
