---
name: Reduce TURN traffic + gameplay fixes
overview: Reduce unnecessary Cloudflare TURN traffic and implement several gameplay/UI fixes around events, transcripts, attacks, HUD layout, and randomization.
todos:
  - id: reduce-broadcast-and-input-rate
    content: Throttle WebRTC game-state broadcasts and joystick/ping frequencies to reduce TURN traffic without hurting gameplay.
    status: pending
  - id: immersive-roomcode-rebroadcast
    content: Make lobby ROOM code box clickable in immersive host view to rebroadcast the code via Supabase presence/WEBRTC_BROADCAST_CHANNEL.
    status: pending
  - id: fix-event-countdown-30s
    content: Align client event countdown timers with 30s host durations for mock exam and hitbox.
    status: pending
  - id: transcript-persistence-on-disconnect
    content: Allow clients to stay on the end-game transcript page even if the host disconnects, while keeping earlier-phase disconnect redirect behavior.
    status: pending
  - id: attack-latency-compensation
    content: Add 0.2s backward leniency to eagle attack hit validation using position history instead of only instantaneous positions.
    status: pending
  - id: hud-score-reposition
    content: Move the client top score display so it sits next to the exit button, leaving center-top empty for camera notch safety.
    status: pending
  - id: f-page-next-flow
    content: Rework the F-page copy and NEXT behavior to show an early F-specific transcript while preserving final transcript behavior.
    status: pending
  - id: todo-1776367826110-suwwuoaau
    content: Implement SKIP button at minigame and final exam
    status: pending
  - id: event-and-question-randomization
    content: Adjust event type probabilities to 40/30/30 and make mock exam/final questions uniformly random.
    status: pending
isProject: false
---

# Reduce TURN Traffic & Gameplay Fixes

## Goals

- **Bandwith**: Lower Cloudflare TURN egress/ingress per session (especially for single real client + bots) by cutting unnecessary or overly frequent messages while keeping gameplay smooth.
- **Reliability**: Eliminate replay-related disconnects and room-discovery flakiness in immersive mode.
- **Gameplay/UI**: Fix the six specific issues: event countdown duration, transcript persistence, attack timing leniency, top score HUD position, F-page flow, and minigame/question randomization.

## 1. Analyze and reduce unnecessary TURN traffic

Files to inspect and adjust:

- Host networking & broadcast: `[src/hooks/useGameLogic.ts](c:/Users/mongk/Desktop/firechick/src/hooks/useGameLogic.ts)`
- WebRTC host/client transport: `[src/hooks/useGameRoom.ts](c:/Users/mongk/Desktop/firechick/src/hooks/useGameRoom.ts)`
- Client networking behavior: `[src/pages/Client.tsx](c:/Users/mongk/Desktop/firechick/src/pages/Client.tsx)`
- Network diagnostics overlay: `[src/components/NetworkPerformancePanel.tsx](c:/Users/mongk/Desktop/firechick/src/components/NetworkPerformancePanel.tsx)`

Planned adjustments:

- **1.1 Game-state broadcast rate (host → clients)**
  - Currently `doBroadcastState` in `useGameLogic.ts` sends WebRTC snapshots as fast as the tick loop except for special cases.
  - Introduce a **fixed min interval for WebRTC as well**, e.g. `minIntervalMs = 50–66` ms for `connectionModeRef === 'webrtc'`, not only during replay.
  - Keep host-local `setSnapshot` frequency unchanged so host UI stays smooth while snapshots over the network are throttled.
- **1.2 Joystick / input message frequency (client → host)**
  - In `useClientWebRTC` inside `useGameRoom.ts`, joystick sends run on an interval (currently `JOYSTICK_SEND_INTERVAL = 33` ms) and also send immediately in some paths.
  - Reduce TURN chatter by:
    - Increasing interval slightly (e.g. 40–50 ms) and/or
    - Early-returning when joystick delta since last send is below small thresholds (deadzone on both axes).
  - This lowers per-second input packets without noticeably hurting control feel.
- **1.3 Ping/pong health checks**
  - Host WebRTC pings every 2 seconds (`pingInterval` in `useHostWebRTC`), and clients respond with `pong`.
  - Reduce overhead by:
    - Increasing interval to e.g. 5 seconds.
    - Keep `NetworkPerformancePanel` thresholds in sync so it still flags idle/high-latency correctly.
- **1.4 Optional: prune redundant host messages**
  - Review host broadcasts in `useGameLogic.ts` (tip notifications, event updates, etc.) and ensure we don’t send repeated identical payloads multiple times per frame.
  - If necessary, memoize last `game-state` hash and skip sending when unchanged during replay/paused phases.

## 2. Immersive room code rebroadcast

Files:

- Host lobby UI: `[src/pages/Host.tsx](c:/Users/mongk/Desktop/firechick/src/pages/Host.tsx)`
- Room advertising helpers: `[src/hooks/useGameRoom.ts](c:/Users/mongk/Desktop/firechick/src/hooks/useGameRoom.ts)` (`useAdvertiseRoom`, `useWebRTCRoomBroadcast`, `useDiscoverRooms`)

Plan:

- **2.1 Make room-code box clickable in immersive lobby**
  - In the lobby branch of `Host.tsx`, the existing `ROOM: {roomCode}` box is rendered.
  - Wrap it in a button/`onClick` handler for immersive mode.
- **2.2 Implement a rebroadcast helper**
  - Add a small helper function (in `useGameRoom.ts` or inline in `Host.tsx`) that, when called, will:
    - Use the `WEBRTC_BROADCAST_CHANNEL` Supabase presence channel to `track` the current `roomCode` again (`source: 'webrtc'` as already used in `useWebRTCRoomBroadcast`).
  - The click handler on the ROOM box calls this helper, ensuring the room appears again in `useDiscoverRooms` even if initial presence somehow dropped.
- User reminder: It is noted that Immersive mode should be fully handled by cloudflare, even if supabase is down, the function should still works.

## 3. Event countdown: mobile 20s → 30s

Files:

- Client event UI: `[src/pages/Client.tsx](c:/Users/mongk/Desktop/firechick/src/pages/Client.tsx)` and `[src/components/events/EventCountdown.tsx](c:/Users/mongk/Desktop/firechick/src/components/events/EventCountdown.tsx)`
- Host event duration logic: `[src/hooks/useGameLogic.ts](c:/Users/mongk/Desktop/firechick/src/hooks/useGameLogic.ts)` (already uses 30s constants `EVENT_*_DURATION`)

Plan:

- Confirm how the client’s event countdown label is computed (likely based on `activeEvent.endAt - now` or a local fixed duration).
- Align client countdown with host:
  - Base it purely on the host-provided `activeEvent.endAt` +/- the known 3s countdown offset.
  - Ensure initial value is ~30 instead of 20, and that it decrements smoothly to 0 in sync with the host screen.

## 4. Transcript page persistence on host disconnect

Files:

- Client navigation on disconnect: `[src/pages/Client.tsx](c:/Users/mongk/Desktop/firechick/src/pages/Client.tsx)` (effect that watches `connected` and `kicked` and navigates to `/` with a toast).
- Game-over / transcript rendering: `Client.tsx` and `[src/components/TranscriptView.tsx](c:/Users/mongk/Desktop/firechick/src/components/TranscriptView.tsx)`

Plan:

- Modify the “host disconnected” redirect effect in `Client.tsx` to **not trigger** when the client is already in:
  - `gamePhase === 'gameover'` **or**
  - currently rendering the transcript/end-game UI.
- Leave the toast and redirect behavior intact for all earlier phases (lobby, reveal, countdown, playing, exam).
- This allows the transcript/result page to be stable even if host leaves, while keeping pre-result behavior unchanged.

## 5. Eagle attack: 0.2s backward leniency

Files:

- Attack handling: `[src/hooks/useGameLogic.ts](c:/Users/mongk/Desktop/firechick/src/hooks/useGameLogic.ts)` (case `"attack-press"`, overlap checks, position history buffer `positionHistoryRef`).
- Attack radius: `[src/lib/gameplayMapData.ts](c:/Users/mongk/Desktop/firechick/src/lib/gameplayMapData.ts)` (`ATTACK_OVERLAP_THRESHOLD`).

Plan:

- Currently, valid hits are checked against **current positions** with `checkOverlap(...)` and the replay uses last ~1.5s of positions for visuals only.
- To compensate remote delay without changing visuals:
  - When processing `attack-press`:
    - Compute an **effective victim position** as the last recorded position within `0.2s` before `now` from `positionHistoryRef`.
    - Run `checkOverlap` using that effective position instead of only the instantaneous position.
  - Keep replay frames as-is (they’re already from last 1.5s), so the replay aligns with the judged window.

## 6. HUD: move top score next to exit

Files:

- Client HUD layout: `[src/pages/Client.tsx](c:/Users/mongk/Desktop/firechick/src/pages/Client.tsx)`

Plan:

- Identify the top bar that shows the player’s grade (e.g. `A+ 4.3`) and the existing top-right exit/cross button.
- Restructure the layout so:
  - Exit button + grade cluster are aligned at the **top-right**, ideally in a single container.
  - The center-top remains visually clear (no text), avoiding camera notch overlap.
- Keep existing grade styling; just move position.
- User Original Prompt Reference:  
in game, at client screen, i want the top score display(A+ 4.3) to be right next to the cross exit button(exist now at right top corner)

## 7. F-page behavior and early transcript view

Files:

- F-page (client “F / better luck next time” screen): a branch in `[src/pages/Client.tsx](c:/Users/mongk/Desktop/firechick/src/pages/Client.tsx)` where `isDead && gamePhase !== 'gameover'`.
- End-game result/transcript page on client: likely same file + `TranscriptView`.

Plan:

- **7.1 Update copy on F-page**
  - Change the line from “better luck next time” to **“The system wasn't built for you to win.”**
  - Change button label from **LEAVE** to **NEXT**.
- **7.2 NEXT behavior (early transcript)**
  - When the F-player taps **NEXT** before game end:
    - Navigate to a **result-style screen** that:
      - Shows game-over style layout, action score, metrics, character, etc., based on **current snapshot**.
      - Uses F-specific messaging:
        - Skip the standard “You win” / “It's a draw” messages.
        - Instead, show **“F doesn't define you.”** in red near the conclusion section.
        - Re-use the existing “in this game your value…” copy and LEAVE button at the end.
    - Treat this as a **local-only transcript** that doesn’t depend on host still running.
- **7.3 Sync when game actually ends**
  - If a player is still on the F-page and the host reaches game-over, continue existing behavior: they’re pulled into the shared end-game transcript.
  - If they had already hit NEXT and are on the F-transcript, you can either:
    - Let them stay on the F-transcript (simpler and consistent with your safety requirement), or
    - Optionally refresh their data when a newer final snapshot arrives, but keep the F-specific messaging.
- User Original Prompt Reference:  
at client side, during gameplay, getting an F, at the page F(this will be named as F page), better luck next time, Leave button(exist). i want to change better luck next time to "The system wasn't built for you to win.", and change the LEAVE button to NEXT, directly bring the F grade player to the result page. Beaware, NOW: if the F player stay at the F page, when the game ends, they will also be pulled into the result end game client page(exist), this is a good, perfect doing, keep it. But if they pressed the NEXT button at the F page(this means the game is not end, no result yet), their result end game client page(exist) will still show game over, but skipping draw/win/lose, and direction to your grade, then what character you are, scroll down the same, action score and how you were measured(all exist), scroll down once more, then the line "You win"/"its a draw" will become "F doesn't define you." in red, below is the quote in this game your value..., then the leave button.

## 8. Event/minigame randomization (mock / hitbox / crossy + questions)

Files:

- Event spawning & type selection: `[src/hooks/useGameLogic.ts](c:/Users/mongk/Desktop/firechick/src/hooks/useGameLogic.ts)` (eventType logic around `rand < 0.33` & durations).
- Question selection for mock exam & final exam: same file and/or supporting exam libraries.

Plan:

- **8.1 Adjust event type probabilities**
  - Replace `rand < 0.33 ? 'mock-exam' : rand < 0.66 ? 'hitbox' : 'crossy-road'` with:
    - `rand < 0.4` → mock exam
    - `rand < 0.7` → hitbox
    - else → crossy road
  - This yields 40% / 30% / 30% per trigger, independent from previous events.
- **8.2 Equal chance randomizer for question numbers (4 set)**
  - Locate where `questionNum` for mock exam / final exam is assigned in `useGameLogic.ts`.
  - Ensure question index is computed using a **uniform** generator:
    - Example: `const questionNum = Math.floor(Math.random() * NUM_QUESTIONS);`
  - If there’s any stateful pattern (cycling or reusing a narrow subset), replace with a simple uniform pick per event or per exam.

## 9. Adding "SKIP" Button on events

Add:

- In Game, During Minigame(Mock Quiz, Hitbox, Crossy Road) and Final Exam, At HOST
- Add a SKIP Button at the top right of the screen (same place as bot pause button but overlap)
- Pressing SKIP button will directly set countdown to 0 seconds, release result of the event.
- Please be reminded to notify client side if the skip button is pressed.
- Special: for Final Exam, using SKIP will not bring any consequence(penalty) but directly getting into endgame.

## 10. Egress-focused validation

After implementation, validate:

- **Cloudflare TURN usage**: observe egress/ingress for a typical game session (1 real client, 7 bots) and confirm that traffic drops compared to the previous ~136/113 MB numbers.
- **Functional checks**:
  - Immersive lobby: room-code clickable rebroadcast works; room appears in Active Rooms list.
  - Event countdown on mobile shows 30s and matches host timer.
  - Transcript persists correctly when host disconnects.
  - Eagle attack feels slightly more forgiving for valid near-misses (~0.2s back).
  - HUD top-center is visually clear; grade is next to exit button.
  - F-page NEXT flow correctly routes to F-specific transcript without breaking eventual normal game-over transcript behavior.
  - Minigame distribution feels closer to 40/30/30 and questions appear uniformly random over multiple sessions.

## 11. Implementation checklist by todo

- **reduce-broadcast-and-input-rate**
  - [ ] Throttle WebRTC `doBroadcastState` calls with a min interval (50–66 ms) while keeping host UI updates unchanged.
  - [ ] Add joystick deadzone + slower `JOYSTICK_SEND_INTERVAL` and verify control feel.
  - [ ] Increase WebRTC ping interval (e.g. to 5s) and adjust `NetworkPerformancePanel` thresholds if needed.
  - [ ] Capture before/after message counts or TURN bandwidth for a representative session.
- **immersive-roomcode-rebroadcast**
  - [ ] Make the lobby `ROOM: {roomCode}` box clickable in immersive mode.
  - [ ] Add a helper to re-track the room on `WEBRTC_BROADCAST_CHANNEL` and/or Cloudflare discovery.
  - [ ] Verify that clicking the box makes the room reappear in Active Rooms for new clients.
- **fix-event-countdown-30s**
  - [ ] Ensure client countdown derives from host `activeEvent.endAt` (+/- 3s) and starts at ~30s.
  - [ ] Remove/align any 20s mobile-specific durations.
  - [ ] Confirm countdown sync between host and client across reconnects.
- **transcript-persistence-on-disconnect**
  - [ ] Gate disconnect redirect logic so it does not fire when `gamePhase === 'gameover'` / transcript is visible.
  - [ ] Confirm early-phase disconnect still redirects with a toast.
- **attack-latency-compensation**
  - [ ] Use `positionHistoryRef` to compute an effective victim position within 0.2s before `attack-press`.
  - [ ] Fall back gracefully when history is sparse.
  - [ ] Play test under artificial latency to confirm near-misses within 200 ms register as hits but late presses still miss.
- **hud-score-reposition**
  - [ ] Refactor the client HUD so the grade display sits next to the exit/cross button at top-right.
  - [ ] Test on notch and non-notch devices to ensure the center-top is visually clear and text isn’t clipped.
- **f-page-next-flow**
  - [ ] Change F-page copy to “The system wasn't built for you to win.” and button label to NEXT.
  - [ ] Implement the F-specific transcript screen that reuses the existing result layout with modified copy and “F doesn't define you.” in red.
  - [ ] Decide and implement behavior when the game ends while the player is on the F-transcript (stay vs. sync).
  - [ ] Regression check for the default end-game transcript when the player never hits F.
- **todo-1776367826110-suwwuoaau (SKIP button)**
  - [ ] Add a SKIP button to host UI for minigames and final exam in the top-right control cluster.
  - [ ] Wire SKIP to set event countdown to 0 and broadcast the resulting state change to clients.
  - [ ] Ensure final exam SKIP transitions directly to endgame without penalties.
- **event-and-question-randomization**
  - [ ] Adjust event randomization to 40/30/30 (mock/hitbox/crossy).
  - [ ] Ensure mock and final exam question indices are chosen via a uniform random generator.
  - [ ] Run long test sessions and spot-check logged distributions for events and questions.

