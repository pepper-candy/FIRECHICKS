---
name: Fix Immersive HUD + Replay Disconnect
overview: Address immersive client HUD cleanup and replay-time disconnects by removing the `(webrtc)` badge in immersive mode, limiting pause overlay to host-manual pauses only, and reducing replay payload pressure on WebRTC clients to prevent connection drops.
todos:
  - id: hide-immersive-mode-label
    content: Update `src/pages/Client.tsx` to hide the `(webrtc)`/mode badge in immersive mode only.
    status: completed
  - id: manual-pause-only-overlay
    content: Update client pause overlay condition in `src/pages/Client.tsx` so it appears only for host manual pause, not attack video/replay states.
    status: completed
  - id: trim-replay-network-payload
    content: In `src/hooks/useGameLogic.ts` (and `src/lib/gameTypes.ts` if needed), keep full replay data for host UI but broadcast lightweight replay state to clients to prevent WebRTC overload/disconnects.
    status: completed
  - id: replay-send-rate-cap
    content: Cap network game-state broadcast rate during video/replay windows in `src/hooks/useGameLogic.ts` to reduce transport spikes while preserving smooth gameplay.
    status: completed
  - id: verify-no-regression
    content: "Run diagnostics and validate immersive replay flow manually: no mode badge, no replay pause overlay, no disconnect on replay, manual host pause overlay still works."
    status: completed
isProject: false
---

# Fix Immersive HUD + Replay Disconnect

## What I found

- The immersive client still renders the mode badge here: [src/pages/Client.tsx](c:/Users/mongk/Desktop/firechick/src/pages/Client.tsx) as `({mode})` in the top LIVE row.
- The pause overlay in client currently appears whenever `frozenAll || videoPlaying || replayCountdown`, so it also shows during attack video/replay.
- During attack flow, host creates replay data from position history and stores full `replayData.frames` into `replayCountdown`.
- The host then broadcasts full `game-state` snapshots to clients, and those snapshots currently include `replayCountdown` as-is (including heavy replay frames) in [src/hooks/useGameLogic.ts](c:/Users/mongk/Desktop/firechick/src/hooks/useGameLogic.ts).
- Client does not use replay frame payload for rendering; it only checks replay/pause flags. This makes large replay payloads likely unnecessary network pressure on WebRTC (especially iOS), and can trigger peer connection instability/disconnect.

## Implementation plan

1. **Remove immersive mode badge in client HUD**
  - File: [src/pages/Client.tsx](c:/Users/mongk/Desktop/firechick/src/pages/Client.tsx)
  - Change the top LIVE status row so `({mode})` is hidden when `isImmersive` is true.
  - Keep non-immersive behavior unchanged.
2. **Show pause overlay only for host manual pause**
  - File: [src/pages/Client.tsx](c:/Users/mongk/Desktop/firechick/src/pages/Client.tsx)
  - Replace current overlay condition (`clientInputLocked && gamePhase === "playing"`) with logic that excludes attack video/replay states:
    - Show overlay only when manually paused (`frozenAll` true **and** no `videoPlaying` **and** no `replayCountdown`).
  - This matches your preference: hide attack-time pause messaging, keep manual host pause visibility.
3. **Stop sending heavy replay frames to clients over network snapshots**
  - File: [src/hooks/useGameLogic.ts](c:/Users/mongk/Desktop/firechick/src/hooks/useGameLogic.ts)
  - In `doBroadcastState`, build two snapshot variants:
    - `hostSnap` (full, for local host UI via `setSnapshot`) keeps full replay data.
    - `networkSnap` (for `bcast({ type: "game-state" ... })`) strips replay frames and sends only lightweight replay metadata needed by clients (or `replayCountdown: null` if clients don’t need it).
  - Preserve type safety by introducing a lightweight replay summary type in [src/lib/gameTypes.ts](c:/Users/mongk/Desktop/firechick/src/lib/gameTypes.ts), or by making `ReplayCountdownState.replayData` frame field optional for network snapshots.
4. **Guard against replay-phase transport spikes**
  - File: [src/hooks/useGameLogic.ts](c:/Users/mongk/Desktop/firechick/src/hooks/useGameLogic.ts)
  - Add/reuse a non-zero WebRTC snapshot send interval during replay/video windows (e.g. cap to ~15–20 Hz) while keeping host local tick unchanged.
  - Keep gameplay smooth by applying the cap only during `videoPlaying || replayCountdown`.
5. **Sanity verification**
  - Confirm no TS/lint errors in modified files.
  - Manual flow check:
    - Immersive client lobby: no `(webrtc)` at top.
    - Attack valid hit: no “Hold still” overlay during video/replay.
    - During replay, clients stay connected (no host disconnected toast / forced return).
    - Manual host pause still shows pause overlay on client.

