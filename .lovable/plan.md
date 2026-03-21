

# Fixes Plan — 7 Items

## 1. Mock Exam is Individual, Not Team Win

**File: `src/hooks/useGameLogic.ts`** (lines 776-801)

Current logic: if any chick answers correctly → "chick" result with grade boost for all. If none → "eagle" result with -2 for all chicks.

**Change to individual**: When mock exam time expires or all chicks submit:
- Each chick who answered correctly: +1 sub-grade (already done in event-answer handler at line 1262-1268). No additional team reward.
- Each chick who did NOT answer correctly: -2 sub-grades.
- Eagles: no change.
- `ev.result` becomes informational only — set to "chick" if majority got it right, "eagle" otherwise (cosmetic).
- F-grade elimination still applies per-individual after grade changes.

Also update the result display text on both host and client to show individual results ("Correct!" or "Wrong -2 grades") instead of team win/loss.

## 2. Add Zoom & Opacity Controls to Mock Exam Client

**File: `src/pages/Client.tsx`** (lines 949-1010, mock exam active section)

Add `mockExamZoom` and `mockExamOpacity` state variables. Add `Slider` controls (same pattern as `/pw-exam` page lines 222-248) below the camera+layer view:
- Zoom slider: min 0.5, max 1.25, step 0.05
- Opacity slider: min 0, max 1, step 0.05
- Apply zoom via `transform: scale(zoom)` and opacity to the layer-2 image overlay.

Also update `MockExamClient.tsx` component to accept `zoom` and `opacity` props.

## 3. Fix Mock Exam Timer on Client

**File: `src/pages/Client.tsx`** (line 914)

Current: `const timeLeft = Math.max(0, Math.ceil((activeEvent.endAt - now) / 1000));`

The issue is that `activeEvent.endAt` is set during countdown phase as `now + 3000 + eventDuration`, but then reset in the game loop (line 741) to `now + EVENT_MOCK_DURATION` when transitioning to active. The client's `now` via `Date.now()` may be slightly offset from the host's `now`. This should work correctly — but the `endAt` in the serialized state might be stale if it was set during countdown and not updated after active phase begins.

**Fix**: In `useGameLogic.ts` line 741, ensure `ev.endAt` is updated and broadcast. On client side, use `clockNow` (which is updated via interval) instead of inline `Date.now()` for consistency.

## 4. Fix Props Button Overlap for Chicks

**File: `src/pages/Client.tsx`** (`PropsStackBtn`, lines 98-141)

Current: buttons are absolutely positioned with `top: i * 16px`, creating overlap. With 3 props, buttons overlap significantly.

**Fix**: Change from overlapping stack to a simple vertical flex column with proper spacing:
```
<div className="flex flex-col gap-2 items-center">
  {available.map(item => (
    <button key={item.type} ... className="w-14 h-14 rounded-full ..." />
  ))}
</div>
```
Remove the absolute positioning and calculated height. Each button gets its own space.

## 5. Tip Copying Countdown After QR Scan (Stage 3)

The copying countdown logic already exists (lines 488-508 in Client.tsx). The issue is likely that the tip state change isn't being detected on the receiver's side because the game state update for `tips[i]` isn't happening when a scan occurs.

**Verify in `useGameLogic.ts`**: When a `scan-result` message with a tip QR code is received, the receiver's `tips[i]` should be set to `true`. Check that this triggers the `prevTipsRef` diff in Client.tsx. If the scan handler doesn't update tips immediately but waits, add the state change. The `tipCopyStartedAt` and `loadingTip` states should then produce the "📋 Copying... 3s" countdown display in `TipsBox`.

## 6. Eagle Fly Button Shows Cooldown During Attack Cooldown

**File: `src/pages/Client.tsx`** (eagle layout, lines 1233-1246)

Current: `PropsBtn` shows fly cooldown based on `flyCooldownUntil` only. But fly is also disabled during `attackCooldownUntil`.

**Fix**: Pass `effectiveFlyCooldown = Math.max(myState.flyCooldownUntil, myState.attackCooldownUntil)` as the `flyCooldownUntil` prop to `PropsBtn`. This makes the fly button show the attack cooldown timer when it's longer than the fly cooldown.

Also apply same fix in `EagleControls.tsx` (line 66-67): use `Math.max(flyCooldownUntil, attackCooldownUntil)` — add `attackCooldownUntil` as a prop.

## 7. LEAVE Button Redirects to `/`

**File: `src/pages/Client.tsx`**

Multiple LEAVE/DISCONNECT buttons call `disconnect()` but don't navigate. Fix all disconnect buttons to also call `navigate("/")`:

- Line 819 (color picker DISCONNECT): add `navigate("/")`
- Line 849 (dead screen LEAVE): add `navigate("/")`
- Line 903 (gameover LEAVE): replace current handler with `{ disconnect(); navigate("/"); }`
- Line 1208 (gameplay ✕ button): add `navigate("/")`

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `src/hooks/useGameLogic.ts` | Mock exam individual scoring, verify tip scan handler |
| `src/pages/Client.tsx` | Mock exam zoom/opacity controls, timer fix, props layout fix, fly cooldown display, navigate on disconnect |
| `src/components/controls/EagleControls.tsx` | Accept `attackCooldownUntil` prop for fly disable display |
| `src/components/events/MockExamClient.tsx` | Accept zoom/opacity props |

