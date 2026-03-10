

## Two Issues to Fix

### 1. Detect Client Tab Close

**WebRTC**: Already handled — PeerJS fires a `close` event when the underlying RTCDataChannel/RTCPeerConnection detects the remote peer is gone. When a browser tab closes, the connection drops and the host's `conn.on('close')` fires, removing the player. However, detection can be slow (up to ~30s via ICE timeout). We can add a **heartbeat** system: if the host doesn't receive any data from a client for N seconds, it force-removes them.

**Supabase**: The `client-leave` event only fires if the client explicitly calls `disconnect()`. Tab close won't trigger it. Fix: use the `beforeunload` event on the client to send the leave message, plus add a heartbeat/timeout on the host side as a fallback.

### 2. Smart Color Recycling

Currently `nextColorRef` increments forever (`0, 1, 2, 3...`), so after player 0 (Green) disconnects and a new player joins, they get color index 7 (which wraps or is undefined). Fix: instead of a monotonic counter, track **which color indices are in use** and assign the **first available** color index from the pool.

---

### Implementation Plan

**`src/hooks/useGameRoom.ts`**:

1. **Color allocation helper** — Replace `nextColorRef` with a `usedColorsRef: Set<number>`. New function `allocateColor()` finds the lowest unused index (0–6). On disconnect, remove the index from the set.

2. **WebRTC host heartbeat** — Track `lastSeenRef: Map<string, number>`. Update timestamp on every `data` event. Run a 5-second interval that removes any player not seen for 10 seconds.

3. **Supabase host heartbeat** — Same `lastSeenRef` pattern. Update on `joystick` events. Run same 5s cleanup interval.

4. **Supabase client `beforeunload`** — In `useClientSupabase`, add a `beforeunload` listener that sends the `client-leave` broadcast before the tab closes.

5. **WebRTC host `conn.on('error')`** — Also listen for connection errors to trigger cleanup, not just `close`.

All changes are in a single file. No new dependencies needed.

