---
name: Transcript scale and post-video i-frames
overview: Bump transcript ceremony GLB scale by 7.5x (from 0.2 to 1.5) in Host/preview/TranscriptView, and grant all alive chicks 500ms invincibility when Hurt/Dead combat videos finish or skip, using the existing `pendingEagleFreezeAfterVideo` flag in `onVideoComplete`.
todos:
  - id: scale-transcript-glb
    content: Set transcript GLB scale to 1.5 (7.5x 0.2) in Host.tsx, TranscriptView.tsx, preview/HostGameover.tsx
    status: completed
  - id: post-video-invinc
    content: Add POST_HIT_VIDEO_CHICK_INVINC_MS and apply chick invincibleUntil in onVideoComplete when fromEagleHitVideo
    status: completed
isProject: false
---

# Transcript GLB scale and post-video chick invincibility

## 1. Transcript GLB scale (7.5x current)

Current linear scale is **0.2** (see `[Host.tsx](src/pages/Host.tsx)` ~line 116, transcript phase `group scale={TRANSCRIPT_CEREMONY_MODEL_SCALE}` ~789).

- Set `**TRANSCRIPT_CEREMONY_MODEL_SCALE = 0.2 * 7.5`** i.e. `**1.5`** (same visual intent everywhere).
- Update the same constant in:
  - `[src/pages/Host.tsx](src/pages/Host.tsx)` (GameOverCeremony transcript phase)
  - `[src/components/TranscriptView.tsx](src/components/TranscriptView.tsx)` (`TRANSCRIPT_MODEL_SCALE`)
  - `[src/pages/preview/HostGameover.tsx](src/pages/preview/HostGameover.tsx)`

**Optional follow-up (only if framing looks too tight after playtest):** slightly pull camera `z` / `fov` on the transcript `Canvas` in Host (same block as ~776–779) so the larger models still fit; not required unless you see clipping.

---

## 2. Bug: double-hit after Hurt/Dead video (overlap)

**Cause (intended behavior gap):** After `[VideoOverlay](src/components/VideoOverlay.tsx)` calls `onComplete` (video end or **SKIP**), `[onVideoComplete](src/hooks/useGameLogic.ts)` clears `frozenAll` and applies eagle freeze when `pendingEagleFreezeAfterVideo` is set (~1756–1784). Chick and eagle can still be overlapping; anything that registers a second valid hit in that window can apply another `applyDamage` immediately.

**Fix:** When a combat Hurt/Dead video finishes (the flow that set `pendingEagleFreezeAfterVideo` when the hit occurred), grant **all alive chicks** **500ms** invincibility using the existing field `**invincibleUntil`**, which attack resolution already respects (`[attack-press` loop](src/hooks/useGameLogic.ts) ~1353–1355: `if (p.invincibleUntil > now) continue`).

**Implementation in `[useGameLogic.ts](src/hooks/useGameLogic.ts)`:**

1. Add a constant next to other timings, e.g. `POST_HIT_VIDEO_CHICK_INVINC_MS = 500`.
2. At the **start** of `onVideoComplete`, before mutating flags:
  - `const fromEagleHitVideo = gs.pendingEagleFreezeAfterVideo`  
   (`pendingEagleFreezeAfterVideo` is only set from successful eagle hits that queue the overlay — [~1401–1402](src/hooks/useGameLogic.ts).)
3. Keep existing order:
  - Unfreeze / clear `videoPlaying`
  - Early return when `pendingExamEndAfterVideo` (exam timeout video) — **do not** use `fromEagleHitVideo` for that path (exam branch returns before eagle-freeze block; invincibility is for combat hits only).
4. After the `if (gs.pendingEagleFreezeAfterVideo) { ... freeze eagle ... }` block (or inline after it), **if `fromEagleHitVideo`**:
  - `const t = Date.now()` (reuse existing `now` in callback)
  - For each `p` in `playerStates` where `!p.isEagle && p.alive`:  
  `p.invincibleUntil = Math.max(p.invincibleUntil, now + POST_HIT_VIDEO_CHICK_INVINC_MS)`

This runs for both natural `onEnded` and **SKIP** because both call `onComplete`.

No change to `VideoOverlay` required.

---

## Files to touch


| File                                                                       | Change                                                                    |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `[src/hooks/useGameLogic.ts](src/hooks/useGameLogic.ts)`                   | Constant + `onVideoComplete` chick invincibility when `fromEagleHitVideo` |
| `[src/pages/Host.tsx](src/pages/Host.tsx)`                                 | `TRANSCRIPT_CEREMONY_MODEL_SCALE = 1.5`                                   |
| `[src/components/TranscriptView.tsx](src/components/TranscriptView.tsx)`   | `TRANSCRIPT_MODEL_SCALE = 1.5`                                            |
| `[src/pages/preview/HostGameover.tsx](src/pages/preview/HostGameover.tsx)` | `TRANSCRIPT_CEREMONY_MODEL_SCALE = 1.5`                                   |


