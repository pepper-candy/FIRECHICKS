

## WebRTC via PeerJS for Realtime Joystick Data

### Why PeerJS works well here

PeerJS wraps WebRTC DataChannels with a simple API. For this use case (high-frequency joystick updates), it offers lower latency than Supabase Broadcast since data goes peer-to-peer after the initial connection. PeerJS uses a free signaling server by default, so no backend is needed.

### Trade-offs

- **Pro**: Lower latency (direct P2P), no Supabase dependency for realtime, free
- **Con**: NAT traversal can fail on some networks (rare), requires both devices to have internet for initial signaling

### Plan

1. **Add `peerjs` dependency** to the project.

2. **Rewrite `src/hooks/useGameRoom.ts`** to use PeerJS instead of Supabase channels:
   - `useHostRoom`: Creates a `Peer` with an ID derived from the room code (e.g., `eagle-chick-{CODE}`). Listens for incoming data connections. Receives joystick data via `conn.on('data')`.
   - `useClientRoom`: Creates a `Peer`, connects to the host's peer ID. Sends joystick data via `conn.send()`.
   - Room code flow stays the same (host generates code, client enters it).

3. **Remove Supabase Realtime usage** from the game room logic. The Supabase client stays for any future DB/auth needs but is no longer used for broadcast.

4. **No changes needed** to `GameArena.tsx`, `Thumbstick.tsx`, `Host.tsx`, `Client.tsx`, or routing -- they all consume the same hook interface (`joystick`, `sendJoystick`, `connected`, etc.).

### Technical detail

The hook API remains identical:
```text
useHostRoom()  → { roomCode, clientConnected, joystick }
useClientRoom(code) → { connected, connect, sendJoystick, disconnect }
```

PeerJS peer IDs will be namespaced (e.g., `evsc-{ROOM_CODE}`) to avoid collisions on the public PeerJS signaling server.

