---
name: Immersive fix pass
overview: Stabilize immersive-mode multiplayer reliability by fixing rebroadcast persistence, event input handling, disconnect behavior at transcript, and SKIP behavior; then verify UI tweaks and countdown sync under immersive testing.
todos: []
isProject: false
---

# Immersive Reliability Redo Plan

## Confirmed root causes from code trace

- `rebroadcastWebRTCRoom()` currently creates a short-lived presence track, then `untrack()`/removes channel almost immediately, which matches your observed blink/disappear behavior.
- Event input messages are blocked by an early guard in [src/hooks/useGameLogic.ts](src/hooks/useGameLogic.ts): `if (gs.frozenAll ...) return;`. During minigames, host sets `gs.frozenAll = true`, so `event-hitbox-click`, `crossy-hop`, and `crossy-eagle-action` never process.
- Transcript persistence guard in [src/pages/Client.tsx](src/pages/Client.tsx) only checks `gamePhase === 'gameover'` (or F-transcript flag). If phase drifts before disconnect, redirect still occurs.
- SKIP behavior exists but is coupled to the same event lifecycle; with event inputs blocked and no explicit skip signal UX, behavior appears unreliable in immersive runs.

## Implementation plan

### 1) Fix immersive rebroadcast to be persistent (very high priority)

- Refactor [src/hooks/useGameRoom.ts](src/hooks/useGameRoom.ts):
  - Replace ephemeral `rebroadcastWebRTCRoom()` behavior with a retrack on the existing long-lived `useWebRTCRoomBroadcast()` channel.
  - Keep a stable channel ref for the host broadcast hook and expose a `rebroadcastNow()` callback.
  - Do not `untrack()` immediately after manual click; keep presence alive through normal heartbeat lifecycle.
- Update [src/pages/Host.tsx](src/pages/Host.tsx):
  - Room-code click should call the persistent `rebroadcastNow()` from hook state, not open a transient channel.
  - Add lightweight visual feedback (e.g., small host-side toast/log line) so host can confirm click executed.

### 2) Unblock event controls in immersive minigames

- Adjust input gating in [src/hooks/useGameLogic.ts](src/hooks/useGameLogic.ts):
  - Keep freeze guards for combat/exam actions.
  - Allow event actions while frozen if `gs.activeEvent?.phase === 'active'`:
    - `event-hitbox-click`
    - `crossy-hop`
    - `crossy-eagle-action`
- Add a targeted guard helper (`isEventInputAllowed`) to avoid regressions and keep switch cases explicit.

### 3) Make transcript persistence robust on host disconnect

- Harden disconnect logic in [src/pages/Client.tsx](src/pages/Client.tsx):
  - Introduce `hasReachedEndgameRef` (set true once `game-over` message or `gamePhase === 'gameover'` is observed).
  - In disconnect redirect effect, skip redirect if `hasReachedEndgameRef.current` is true (not only phase equality at that instant).
  - Reset this ref only when a new session starts (join/new lobby flow).

### 4) Make SKIP behavior deterministic and visible

- Update [src/hooks/useGameLogic.ts](src/hooks/useGameLogic.ts):
  - For event SKIP: force transition directly from countdown/active to result computation path in the same tick.
  - For exam SKIP: preserve current no-penalty path and force immediate endgame resolution.
  - Emit an explicit host broadcast event (e.g., `event-skipped` / `exam-skipped`) for client-side UX notification.
- Update [src/pages/Client.tsx](src/pages/Client.tsx):
  - Listen for skip notifications and show a short toast/status label so players understand why event ended instantly.
- Update [src/pages/Host.tsx](src/pages/Host.tsx):
  - Keep SKIP visible in immersive, ensure z-index/clickability over overlays.

### 5) Event countdown 30s recheck in immersive path

- Validate all event timers in [src/pages/Client.tsx](src/pages/Client.tsx) and [src/components/events/CrossyRoadClient.tsx](src/components/events/CrossyRoadClient.tsx) are derived from host `activeEvent.endAt` only.
- Add one defensive fallback: if `endAt` is missing/stale, derive remaining from host phase timestamps rather than local fixed 20s defaults.

### 6) Adjust F-page message sizing/alignment

- Update [src/pages/Client.tsx](src/pages/Client.tsx) and [src/components/GameOverScreen.tsx](src/components/GameOverScreen.tsx):
  - Render `F doesn't define you.` with responsive size (`text-lg`/`text-xl`) and centered container width constraints so it never overflows in immersive mobile widths.

## Validation checklist (immersive mode)

- Rebroadcast:
  - Click room code repeatedly; room remains discoverable (no blink-disappear behavior).
- Hitbox event:
  - Chick and eagle taps increment server-side counters/results.
- Crossy event:
  - Chick hop works (`up/down`), eagle actions (`speed-up`, `add-obstacle`) apply and reflect in UI.
- Disconnect at transcript:
  - Host pressing play again/disconnecting does not force client back to join if client already reached transcript.
- SKIP:
  - Host SKIP immediately ends active minigame/exam and clients receive clear skip state/notification.
- F message:
  - `F doesn't define you.` is centered and fits width on narrow immersive screens.

## Key files

- [src/hooks/useGameRoom.ts](src/hooks/useGameRoom.ts)
- [src/hooks/useGameLogic.ts](src/hooks/useGameLogic.ts)
- [src/pages/Host.tsx](src/pages/Host.tsx)
- [src/pages/Client.tsx](src/pages/Client.tsx)
- [src/components/events/CrossyRoadClient.tsx](src/components/events/CrossyRoadClient.tsx)
- [src/components/GameOverScreen.tsx](src/components/GameOverScreen.tsx)