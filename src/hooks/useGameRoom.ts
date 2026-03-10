import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { MAX_PLAYERS } from '@/lib/playerColors';

export type ConnectionMode = 'webrtc' | 'supabase';

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const PEER_PREFIX = 'evsc-';
const JOYSTICK_SEND_INTERVAL = 33; // ~30Hz
const HEARTBEAT_CHECK_INTERVAL = 5000; // 5s
const HEARTBEAT_TIMEOUT = 10000; // 10s

export interface JoystickData {
  x: number;
  y: number;
}

export interface PlayerState {
  joystick: JoystickData;
  colorIndex: number;
}

// ─── Binary encoding for joystick data ──────────────────────
function encodeJoystick(colorIndex: number, x: number, y: number): ArrayBuffer {
  const buf = new ArrayBuffer(5);
  const view = new DataView(buf);
  view.setUint8(0, colorIndex);
  view.setInt16(1, Math.round(x * 32767), true);
  view.setInt16(3, Math.round(y * 32767), true);
  return buf;
}

function decodeJoystick(buf: ArrayBuffer): { colorIndex: number; x: number; y: number } {
  const view = new DataView(buf);
  return {
    colorIndex: view.getUint8(0),
    x: view.getInt16(1, true) / 32767,
    y: view.getInt16(3, true) / 32767,
  };
}

// ─── Color allocation helper ────────────────────────────────
function allocateColor(usedColors: Set<number>): number | null {
  for (let i = 0; i < MAX_PLAYERS; i++) {
    if (!usedColors.has(i)) return i;
  }
  return null;
}

// ─── HOST: WebRTC (multi-player) ────────────────────────────
function useHostWebRTC() {
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState<Map<string, PlayerState>>(new Map());
  const peerRef = useRef<Peer | null>(null);
  const connsRef = useRef<Map<string, DataConnection>>(new Map());
  const usedColorsRef = useRef<Set<number>>(new Set());
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const connColorMapRef = useRef<Map<string, number>>(new Map());

  const removePlayer = useCallback((connId: string) => {
    const colorIdx = connColorMapRef.current.get(connId);
    if (colorIdx !== undefined) {
      usedColorsRef.current.delete(colorIdx);
      connColorMapRef.current.delete(connId);
    }
    connsRef.current.get(connId)?.close();
    connsRef.current.delete(connId);
    lastSeenRef.current.delete(connId);
    setPlayers((prev) => {
      const next = new Map(prev);
      next.delete(connId);
      return next;
    });
  }, []);

  useEffect(() => {
    const code = generateRoomCode();
    setRoomCode(code);

    const peer = new Peer(`${PEER_PREFIX}${code}`, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
        iceCandidatePoolSize: 4,
      },
    });
    peerRef.current = peer;

    peer.on('connection', (conn) => {
      const connId = conn.peer;

      conn.on('open', () => {
        const colorIndex = allocateColor(usedColorsRef.current);
        if (colorIndex === null) {
          conn.send(JSON.stringify({ type: 'room-full' }));
          setTimeout(() => conn.close(), 200);
          return;
        }

        usedColorsRef.current.add(colorIndex);
        connColorMapRef.current.set(connId, colorIndex);
        connsRef.current.set(connId, conn);
        lastSeenRef.current.set(connId, Date.now());

        conn.send(JSON.stringify({ type: 'assign-color', colorIndex }));
        setPlayers((prev) => {
          const next = new Map(prev);
          next.set(connId, { joystick: { x: 0, y: 0 }, colorIndex });
          return next;
        });
      });

      conn.on('data', (data) => {
        lastSeenRef.current.set(connId, Date.now());
        if (data instanceof ArrayBuffer) {
          const decoded = decodeJoystick(data);
          setPlayers((prev) => {
            const next = new Map(prev);
            const existing = next.get(connId);
            if (existing) {
              next.set(connId, { ...existing, joystick: { x: decoded.x, y: decoded.y } });
            }
            return next;
          });
        }
      });

      conn.on('close', () => removePlayer(connId));
      conn.on('error', () => removePlayer(connId));
    });

    // Heartbeat: remove stale players
    const heartbeatInterval = window.setInterval(() => {
      const now = Date.now();
      lastSeenRef.current.forEach((ts, connId) => {
        if (now - ts > HEARTBEAT_TIMEOUT) {
          removePlayer(connId);
        }
      });
    }, HEARTBEAT_CHECK_INTERVAL);

    return () => {
      clearInterval(heartbeatInterval);
      connsRef.current.forEach((c) => c.close());
      connsRef.current.clear();
      peer.destroy();
    };
  }, [removePlayer]);

  return { roomCode, players };
}

// ─── HOST: Supabase (multi-player) ─────────────────────────
function useHostSupabase() {
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState<Map<string, PlayerState>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const usedColorsRef = useRef<Set<number>>(new Set());
  const clientColorMapRef = useRef<Map<string, number>>(new Map());
  const lastSeenRef = useRef<Map<string, number>>(new Map());

  const removePlayer = useCallback((clientId: string) => {
    const colorIdx = clientColorMapRef.current.get(clientId);
    if (colorIdx !== undefined) {
      usedColorsRef.current.delete(colorIdx);
      clientColorMapRef.current.delete(clientId);
    }
    lastSeenRef.current.delete(clientId);
    setPlayers((prev) => {
      const next = new Map(prev);
      next.delete(clientId);
      return next;
    });
  }, []);

  useEffect(() => {
    const code = generateRoomCode();
    setRoomCode(code);

    const channel = supabase.channel(`game-room-${code}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'joystick' }, (payload) => {
        const { clientId, x, y } = payload.payload as { clientId: string; x: number; y: number };
        lastSeenRef.current.set(clientId, Date.now());
        setPlayers((prev) => {
          const next = new Map(prev);
          const existing = next.get(clientId);
          if (existing) {
            next.set(clientId, { ...existing, joystick: { x, y } });
          }
          return next;
        });
      })
      .on('broadcast', { event: 'client-join' }, (payload) => {
        const { clientId } = payload.payload as { clientId: string };
        const colorIndex = allocateColor(usedColorsRef.current);
        if (colorIndex === null) {
          channel.send({ type: 'broadcast', event: 'room-full', payload: { clientId } });
          return;
        }
        usedColorsRef.current.add(colorIndex);
        clientColorMapRef.current.set(clientId, colorIndex);
        lastSeenRef.current.set(clientId, Date.now());
        setPlayers((prev) => {
          const next = new Map(prev);
          next.set(clientId, { joystick: { x: 0, y: 0 }, colorIndex });
          return next;
        });
        channel.send({ type: 'broadcast', event: 'assign-color', payload: { clientId, colorIndex } });
      })
      .on('broadcast', { event: 'client-leave' }, (payload) => {
        const { clientId } = payload.payload as { clientId: string };
        removePlayer(clientId);
      })
      .subscribe();

    channelRef.current = channel;

    // Heartbeat: remove stale players
    const heartbeatInterval = window.setInterval(() => {
      const now = Date.now();
      lastSeenRef.current.forEach((ts, clientId) => {
        if (now - ts > HEARTBEAT_TIMEOUT) {
          removePlayer(clientId);
        }
      });
    }, HEARTBEAT_CHECK_INTERVAL);

    return () => {
      clearInterval(heartbeatInterval);
      channel.unsubscribe();
    };
  }, [removePlayer]);

  return { roomCode, players };
}

// ─── CLIENT: WebRTC (optimized) ─────────────────────────────
function useClientWebRTC(roomCode: string) {
  const [connected, setConnected] = useState(false);
  const [colorIndex, setColorIndex] = useState<number>(-1);
  const [roomFull, setRoomFull] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const joystickRef = useRef<JoystickData>({ x: 0, y: 0 });
  const intervalRef = useRef<number | null>(null);
  const colorIndexRef = useRef(-1);

  const connect = useCallback((overrideCode?: string) => {
    const targetCode = overrideCode || roomCode;
    if (!targetCode) return;
    const code = targetCode.toUpperCase();

    const peer = new Peer(undefined, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
        iceCandidatePoolSize: 4,
      },
    });
    peerRef.current = peer;

    peer.on('open', () => {
      const conn = peer.connect(`${PEER_PREFIX}${code}`, {
        serialization: 'binary',
      });
      connRef.current = conn;

      conn.on('open', () => {
        setConnected(true);
        intervalRef.current = window.setInterval(() => {
          if (colorIndexRef.current >= 0) {
            const buf = encodeJoystick(colorIndexRef.current, joystickRef.current.x, joystickRef.current.y);
            try { conn.send(buf); } catch {}
          }
        }, JOYSTICK_SEND_INTERVAL);
      });

      conn.on('data', (data) => {
        let msg: any = null;
        if (typeof data === 'string') {
          try { msg = JSON.parse(data); } catch {}
        } else if (data instanceof ArrayBuffer) {
          try { msg = JSON.parse(new TextDecoder().decode(data)); } catch {}
        }
        if (msg) {
          if (msg.type === 'assign-color') {
            colorIndexRef.current = msg.colorIndex;
            setColorIndex(msg.colorIndex);
          } else if (msg.type === 'room-full') {
            setRoomFull(true);
          }
        }
      });

      conn.on('close', () => {
        setConnected(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
      });
    });
  }, [roomCode]);

  const sendJoystick = useCallback((data: JoystickData) => {
    joystickRef.current = data;
    if (connRef.current && colorIndexRef.current >= 0) {
      try {
        connRef.current.send(encodeJoystick(colorIndexRef.current, data.x, data.y));
      } catch {}
    }
  }, []);

  const disconnect = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    connRef.current?.close();
    connRef.current = null;
    peerRef.current?.destroy();
    peerRef.current = null;
    setConnected(false);
    setColorIndex(-1);
    colorIndexRef.current = -1;
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      connRef.current?.close();
      peerRef.current?.destroy();
    };
  }, []);

  return { connected, connect, sendJoystick, disconnect, colorIndex, roomFull };
}

// ─── CLIENT: Supabase ───────────────────────────────────────
function useClientSupabase(roomCode: string) {
  const [connected, setConnected] = useState(false);
  const [colorIndex, setColorIndex] = useState<number>(-1);
  const [roomFull, setRoomFull] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientIdRef = useRef(Math.random().toString(36).substring(2, 10));

  const connect = useCallback((overrideCode?: string) => {
    const targetCode = overrideCode || roomCode;
    if (!targetCode) return;
    const code = targetCode.toUpperCase();
    const channel = supabase.channel(`game-room-${code}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'assign-color' }, (payload) => {
        const { clientId, colorIndex: ci } = payload.payload as { clientId: string; colorIndex: number };
        if (clientId === clientIdRef.current) {
          setColorIndex(ci);
        }
      })
      .on('broadcast', { event: 'room-full' }, (payload) => {
        const { clientId } = payload.payload as { clientId: string };
        if (clientId === clientIdRef.current) {
          setRoomFull(true);
          setConnected(false);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          channel.send({ type: 'broadcast', event: 'client-join', payload: { clientId: clientIdRef.current } });
        }
      });

    channelRef.current = channel;
  }, [roomCode]);

  const sendJoystick = useCallback((data: JoystickData) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'joystick',
      payload: { clientId: clientIdRef.current, ...data },
    });
  }, []);

  const disconnect = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'client-leave', payload: { clientId: clientIdRef.current } });
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setConnected(false);
    setColorIndex(-1);
  }, []);

  // beforeunload: send leave on tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (channelRef.current) {
        channelRef.current.send({ type: 'broadcast', event: 'client-leave', payload: { clientId: clientIdRef.current } });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      channelRef.current?.unsubscribe();
    };
  }, []);

  return { connected, connect, sendJoystick, disconnect, colorIndex, roomFull };
}

// ─── Public hooks ───────────────────────────────────────────
export function useHostRoom(mode: ConnectionMode = 'webrtc') {
  const webrtc = useHostWebRTC();
  const supa = useHostSupabase();
  return mode === 'webrtc' ? webrtc : supa;
}

export function useClientRoom(roomCode: string, mode: ConnectionMode = 'webrtc') {
  const webrtc = useClientWebRTC(roomCode);
  const supa = useClientSupabase(roomCode);
  return mode === 'webrtc' ? webrtc : supa;
}

// ─── Room discovery (for WebRTC mode) ───────────────────────
const LOBBY_CHANNEL = 'game-lobby';

export function useAdvertiseRoom(roomCode: string, mode: ConnectionMode) {
  useEffect(() => {
    if (mode !== 'webrtc' || !roomCode) return;

    const channel = supabase.channel(LOBBY_CHANNEL);
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ roomCode, ts: Date.now() });
      }
    });

    return () => {
      channel.untrack();
      channel.unsubscribe();
    };
  }, [roomCode, mode]);
}

export function useDiscoverRooms(mode: ConnectionMode) {
  const [rooms, setRooms] = useState<string[]>([]);

  useEffect(() => {
    if (mode !== 'webrtc') {
      setRooms([]);
      return;
    }

    const channel = supabase.channel(LOBBY_CHANNEL);

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const codes = Object.values(state)
        .flat()
        .map((p: any) => p.roomCode as string)
        .filter(Boolean);
      setRooms([...new Set(codes)]);
    });

    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [mode]);

  return rooms;
}
