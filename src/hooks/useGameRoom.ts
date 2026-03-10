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

export interface JoystickData {
  x: number; // -1 to 1
  y: number; // -1 to 1
}

export interface PlayerState {
  joystick: JoystickData;
  colorIndex: number;
}

// ─── Binary encoding for joystick data ──────────────────────
// 5 bytes: [0] = colorIndex, [1-2] = x as Int16, [3-4] = y as Int16
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

// ─── HOST: WebRTC (multi-player) ────────────────────────────
function useHostWebRTC() {
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState<Map<string, PlayerState>>(new Map());
  const peerRef = useRef<Peer | null>(null);
  const connsRef = useRef<Map<string, DataConnection>>(new Map());
  const nextColorRef = useRef(0);

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
      if (connsRef.current.size >= MAX_PLAYERS) {
        conn.on('open', () => {
          conn.send(JSON.stringify({ type: 'room-full' }));
          setTimeout(() => conn.close(), 200);
        });
        return;
      }

      const colorIndex = nextColorRef.current % MAX_PLAYERS;
      nextColorRef.current++;

      conn.on('open', () => {
        connsRef.current.set(connId, conn);
        // Send assigned color index to client
        conn.send(JSON.stringify({ type: 'assign-color', colorIndex }));
        setPlayers((prev) => {
          const next = new Map(prev);
          next.set(connId, { joystick: { x: 0, y: 0 }, colorIndex });
          return next;
        });
      });

      conn.on('data', (data) => {
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

      conn.on('close', () => {
        connsRef.current.delete(connId);
        setPlayers((prev) => {
          const next = new Map(prev);
          next.delete(connId);
          return next;
        });
      });
    });

    return () => {
      connsRef.current.forEach((c) => c.close());
      connsRef.current.clear();
      peer.destroy();
    };
  }, []);

  return { roomCode, players };
}

// ─── HOST: Supabase (multi-player) ─────────────────────────
function useHostSupabase() {
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState<Map<string, PlayerState>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const colorMapRef = useRef<Map<string, number>>(new Map());
  const nextColorRef = useRef(0);

  useEffect(() => {
    const code = generateRoomCode();
    setRoomCode(code);

    const channel = supabase.channel(`game-room-${code}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'joystick' }, (payload) => {
        const { clientId, x, y } = payload.payload as { clientId: string; x: number; y: number };
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
        if (colorMapRef.current.size >= MAX_PLAYERS) return;
        const colorIndex = nextColorRef.current % MAX_PLAYERS;
        nextColorRef.current++;
        colorMapRef.current.set(clientId, colorIndex);
        setPlayers((prev) => {
          const next = new Map(prev);
          next.set(clientId, { joystick: { x: 0, y: 0 }, colorIndex });
          return next;
        });
        // Send assigned color back
        channel.send({ type: 'broadcast', event: 'assign-color', payload: { clientId, colorIndex } });
      })
      .on('broadcast', { event: 'client-leave' }, (payload) => {
        const { clientId } = payload.payload as { clientId: string };
        colorMapRef.current.delete(clientId);
        setPlayers((prev) => {
          const next = new Map(prev);
          next.delete(clientId);
          return next;
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, []);

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

      // Override the DC config after PeerJS creates it
      conn.on('open', () => {
        setConnected(true);
        // Start continuous binary send loop
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
    // Also send immediately for responsiveness
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

  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);

  return { connected, connect, sendJoystick, disconnect, colorIndex };
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
