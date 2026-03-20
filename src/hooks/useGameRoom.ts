import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { MAX_PLAYERS, EAGLE_COLOR_INDICES } from '@/lib/playerColors';

export type ConnectionMode = 'webrtc' | 'supabase';

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const PEER_PREFIX = 'evsc-';
const JOYSTICK_SEND_INTERVAL = 33;

export interface JoystickData {
  x: number;
  y: number;
}

export interface PlayerState {
  joystick: JoystickData;
  colorIndex: number;
  ping: number;
  lastPongAt: number;
}

// Binary encoding for joystick data
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

function allocateColor(usedColors: Set<number>, excludeIndices: number[] = []): number | null {
  const available: number[] = [];
  for (let i = 0; i < MAX_PLAYERS; i++) {
    if (!usedColors.has(i) && !excludeIndices.includes(i)) available.push(i);
  }
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

// ─── HOST: WebRTC ───────────────────────────────────────────
function useHostWebRTC() {
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState<Map<string, PlayerState>>(new Map());
  const peerRef = useRef<Peer | null>(null);
  const connsRef = useRef<Map<string, DataConnection>>(new Map());
  const usedColorsRef = useRef<Set<number>>(new Set());
  const connColorMapRef = useRef<Map<string, number>>(new Map());
  const clientMsgCallbackRef = useRef<((connId: string, msg: any) => void) | null>(null);
  const gameModeRef = useRef<'1v3' | '2v6'>('1v3');

  const removePlayer = useCallback((connId: string) => {
    const colorIdx = connColorMapRef.current.get(connId);
    if (colorIdx !== undefined) {
      usedColorsRef.current.delete(colorIdx);
      connColorMapRef.current.delete(connId);
    }
    connsRef.current.get(connId)?.close();
    connsRef.current.delete(connId);
    setPlayers((prev) => {
      const next = new Map(prev);
      next.delete(connId);
      return next;
    });
  }, []);

  const kickPlayer = useCallback((connId: string) => {
    const conn = connsRef.current.get(connId);
    if (conn) {
      try { conn.send(JSON.stringify({ type: 'kicked' })); } catch {}
    }
    removePlayer(connId);
  }, [removePlayer]);

  const kickAllPlayers = useCallback(() => {
    for (const [connId, conn] of connsRef.current.entries()) {
      try { conn.send(JSON.stringify({ type: 'kicked' })); } catch {}
    }
    connsRef.current.clear();
    usedColorsRef.current.clear();
    connColorMapRef.current.clear();
    setPlayers(new Map());
  }, []);

  const broadcast = useCallback((msg: any) => {
    const data = JSON.stringify(msg);
    connsRef.current.forEach((conn) => {
      try { conn.send(data); } catch {}
    });
  }, []);

  const onClientMessage = useCallback((cb: (connId: string, msg: any) => void) => {
    clientMsgCallbackRef.current = cb;
  }, []);

  // Handle color swap
  const handleColorSwap = useCallback((connId: string, requestedColor: number) => {
    if (usedColorsRef.current.has(requestedColor)) return; // already taken
    const currentColor = connColorMapRef.current.get(connId);
    if (currentColor !== undefined) {
      usedColorsRef.current.delete(currentColor);
    }
    usedColorsRef.current.add(requestedColor);
    connColorMapRef.current.set(connId, requestedColor);

    setPlayers((prev) => {
      const next = new Map(prev);
      const existing = next.get(connId);
      if (existing) {
        next.set(connId, { ...existing, colorIndex: requestedColor });
      }
      return next;
    });

    // Tell all clients about the swap
    const conn = connsRef.current.get(connId);
    if (conn) {
      try { conn.send(JSON.stringify({ type: 'color-update', colorIndex: requestedColor })); } catch {}
    }
    // Broadcast used colors to all
    broadcast({ type: 'used-colors', colors: Array.from(usedColorsRef.current) });
  }, [broadcast]);

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
        const excludeIndices = gameModeRef.current === '2v6' ? [] : (EAGLE_COLOR_INDICES as unknown as number[]);
        const colorIndex = allocateColor(usedColorsRef.current, excludeIndices);
        if (colorIndex === null) {
          conn.send(JSON.stringify({ type: 'room-full' }));
          setTimeout(() => conn.close(), 200);
          return;
        }

        usedColorsRef.current.add(colorIndex);
        connColorMapRef.current.set(connId, colorIndex);
        connsRef.current.set(connId, conn);

        conn.send(JSON.stringify({ type: 'assign-color', colorIndex }));
        conn.send(JSON.stringify({ type: 'used-colors', colors: Array.from(usedColorsRef.current) }));
        setPlayers((prev) => {
          const next = new Map(prev);
          next.set(connId, { joystick: { x: 0, y: 0 }, colorIndex, ping: 0, lastPongAt: Date.now() });
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
        } else {
          let msg: any = null;
          if (typeof data === 'string') {
            try { msg = JSON.parse(data); } catch {}
          }
          if (msg) {
            if (msg.type === 'pong') {
              const rtt = Date.now() - msg.ts;
              setPlayers((prev) => {
                const next = new Map(prev);
                const existing = next.get(connId);
                if (existing) {
                  next.set(connId, { ...existing, ping: rtt, lastPongAt: Date.now() });
                }
                return next;
              });
            } else if (msg.type === 'color-swap') {
              handleColorSwap(connId, msg.requestedColor);
            } else {
              // Forward to game logic
              clientMsgCallbackRef.current?.(connId, msg);
            }
          }
        }
      });

      conn.on('close', () => removePlayer(connId));
      conn.on('error', () => removePlayer(connId));
    });

    const pingInterval = window.setInterval(() => {
      const ts = Date.now();
      connsRef.current.forEach((conn) => {
        try { conn.send(JSON.stringify({ type: 'ping', ts })); } catch {}
      });
    }, 2000);

    return () => {
      clearInterval(pingInterval);
      connsRef.current.forEach((c) => c.close());
      connsRef.current.clear();
      peer.destroy();
    };
  }, [removePlayer, handleColorSwap]);

  return { roomCode, players, kickPlayer, kickAllPlayers, broadcast, onClientMessage, usedColors: usedColorsRef };
}

// ─── HOST: Supabase ─────────────────────────────────────────
function useHostSupabase() {
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState<Map<string, PlayerState>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const usedColorsRef = useRef<Set<number>>(new Set());
  const clientColorMapRef = useRef<Map<string, number>>(new Map());
  const clientMsgCallbackRef = useRef<((connId: string, msg: any) => void) | null>(null);

  const removePlayer = useCallback((clientId: string) => {
    const colorIdx = clientColorMapRef.current.get(clientId);
    if (colorIdx !== undefined) {
      usedColorsRef.current.delete(colorIdx);
      clientColorMapRef.current.delete(clientId);
    }
    setPlayers((prev) => {
      const next = new Map(prev);
      next.delete(clientId);
      return next;
    });
  }, []);

  const kickPlayer = useCallback((clientId: string) => {
    channelRef.current?.send({ type: 'broadcast', event: 'kicked', payload: { clientId } });
    removePlayer(clientId);
  }, [removePlayer]);

  const kickAllPlayers = useCallback(() => {
    for (const clientId of clientColorMapRef.current.keys()) {
      channelRef.current?.send({ type: 'broadcast', event: 'kicked', payload: { clientId } });
    }
    usedColorsRef.current.clear();
    clientColorMapRef.current.clear();
    setPlayers(new Map());
  }, []);

  const broadcast = useCallback((msg: any) => {
    channelRef.current?.send({ type: 'broadcast', event: 'host-message', payload: msg });
  }, []);

  const onClientMessage = useCallback((cb: (connId: string, msg: any) => void) => {
    clientMsgCallbackRef.current = cb;
  }, []);

  const handleColorSwap = useCallback((clientId: string, requestedColor: number) => {
    if (usedColorsRef.current.has(requestedColor)) return;
    const currentColor = clientColorMapRef.current.get(clientId);
    if (currentColor !== undefined) usedColorsRef.current.delete(currentColor);
    usedColorsRef.current.add(requestedColor);
    clientColorMapRef.current.set(clientId, requestedColor);

    setPlayers((prev) => {
      const next = new Map(prev);
      const existing = next.get(clientId);
      if (existing) next.set(clientId, { ...existing, colorIndex: requestedColor });
      return next;
    });

    channelRef.current?.send({
      type: 'broadcast', event: 'assign-color',
      payload: { clientId, colorIndex: requestedColor },
    });
    channelRef.current?.send({
      type: 'broadcast', event: 'used-colors',
      payload: { colors: Array.from(usedColorsRef.current) },
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
        setPlayers((prev) => {
          const next = new Map(prev);
          const existing = next.get(clientId);
          if (existing) next.set(clientId, { ...existing, joystick: { x, y } });
          return next;
        });
      })
      .on('broadcast', { event: 'client-join' }, (payload) => {
        const { clientId } = payload.payload as { clientId: string };
        const colorIndex = allocateColor(usedColorsRef.current, EAGLE_COLOR_INDICES as unknown as number[]);
        if (colorIndex === null) {
          channel.send({ type: 'broadcast', event: 'room-full', payload: { clientId } });
          return;
        }
        usedColorsRef.current.add(colorIndex);
        clientColorMapRef.current.set(clientId, colorIndex);
        setPlayers((prev) => {
          const next = new Map(prev);
          next.set(clientId, { joystick: { x: 0, y: 0 }, colorIndex, ping: 0, lastPongAt: Date.now() });
          return next;
        });
        channel.send({ type: 'broadcast', event: 'assign-color', payload: { clientId, colorIndex } });
        channel.send({ type: 'broadcast', event: 'used-colors', payload: { colors: Array.from(usedColorsRef.current) } });
      })
      .on('broadcast', { event: 'client-leave' }, (payload) => {
        const { clientId } = payload.payload as { clientId: string };
        removePlayer(clientId);
      })
      .on('broadcast', { event: 'color-swap' }, (payload) => {
        const { clientId, requestedColor } = payload.payload as { clientId: string; requestedColor: number };
        handleColorSwap(clientId, requestedColor);
      })
      .on('broadcast', { event: 'client-action' }, (payload) => {
        const { clientId, ...msg } = payload.payload as { clientId: string; [key: string]: any };
        clientMsgCallbackRef.current?.(clientId, msg);
      })
      .on('broadcast', { event: 'pong' }, (payload) => {
        const { clientId, ts } = payload.payload as { clientId: string; ts: number };
        const rtt = Date.now() - ts;
        setPlayers((prev) => {
          const next = new Map(prev);
          const existing = next.get(clientId);
          if (existing) next.set(clientId, { ...existing, ping: rtt, lastPongAt: Date.now() });
          return next;
        });
      })
      .subscribe();

    channelRef.current = channel;

    const pingInterval = window.setInterval(() => {
      channel.send({ type: 'broadcast', event: 'ping', payload: { ts: Date.now() } });
    }, 2000);

    return () => {
      clearInterval(pingInterval);
      channel.unsubscribe();
    };
  }, [removePlayer, handleColorSwap]);

  return { roomCode, players, kickPlayer, kickAllPlayers, broadcast, onClientMessage, usedColors: usedColorsRef };
}

// ─── CLIENT: WebRTC ─────────────────────────────────────────
function useClientWebRTC(roomCode: string) {
  const [connected, setConnected] = useState(false);
  const [colorIndex, setColorIndex] = useState<number>(-1);
  const [clientId, setClientId] = useState<string>("");
  const [roomFull, setRoomFull] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [usedColors, setUsedColors] = useState<Set<number>>(new Set());
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const joystickRef = useRef<JoystickData>({ x: 0, y: 0 });
  const intervalRef = useRef<number | null>(null);
  const idleRef = useRef(true);
  const colorIndexRef = useRef(-1);
  const hostMsgCallbackRef = useRef<((msg: any) => void) | null>(null);

  const connect = useCallback((overrideCode?: string) => {
    const targetCode = overrideCode || roomCode;
    if (!targetCode) return;
    const code = targetCode.toUpperCase();
    setKicked(false);
    setRoomFull(false);

    const peer = new Peer(undefined as any, {
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
      setClientId(peer.id);
      const conn = peer.connect(`${PEER_PREFIX}${code}`, {
        serialization: 'binary',
        reliable: false,
      });
      connRef.current = conn;

      conn.on('open', () => {
        setConnected(true);
        intervalRef.current = window.setInterval(() => {
          if (colorIndexRef.current >= 0 && !idleRef.current) {
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
          } else if (msg.type === 'color-update') {
            colorIndexRef.current = msg.colorIndex;
            setColorIndex(msg.colorIndex);
          } else if (msg.type === 'used-colors') {
            setUsedColors(new Set(msg.colors));
          } else if (msg.type === 'room-full') {
            setRoomFull(true);
          } else if (msg.type === 'kicked') {
            setKicked(true);
            doDisconnect();
          } else if (msg.type === 'ping') {
            if (!idleRef.current) {
              try { conn.send(JSON.stringify({ type: 'pong', ts: msg.ts })); } catch {}
            }
          } else {
            // Forward to game logic
            hostMsgCallbackRef.current?.(msg);
          }
        }
      });

      conn.on('close', () => {
        setConnected(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
      });
    });
  }, [roomCode]);

  const doDisconnect = useCallback(() => {
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

  const disconnect = useCallback(() => { doDisconnect(); }, [doDisconnect]);

  const sendJoystick = useCallback((data: JoystickData) => {
    joystickRef.current = data;
    if (!idleRef.current && connRef.current && colorIndexRef.current >= 0) {
      try { connRef.current.send(encodeJoystick(colorIndexRef.current, data.x, data.y)); } catch {}
    }
  }, []);

  const setIdle = useCallback((idle: boolean) => { idleRef.current = idle; }, []);

  const sendToHost = useCallback((msg: any) => {
    if (connRef.current) {
      try { connRef.current.send(JSON.stringify(msg)); } catch {}
    }
  }, []);

  const onHostMessage = useCallback((cb: (msg: any) => void) => {
    hostMsgCallbackRef.current = cb;
  }, []);

  const requestColorSwap = useCallback((requestedColor: number) => {
    sendToHost({ type: 'color-swap', requestedColor });
  }, [sendToHost]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      connRef.current?.close();
      peerRef.current?.destroy();
    };
  }, []);

  return { connected, connect, sendJoystick, disconnect, colorIndex, roomFull, kicked, clientId, setIdle, sendToHost, onHostMessage, requestColorSwap, usedColors };
}

// ─── CLIENT: Supabase ───────────────────────────────────────
function useClientSupabase(roomCode: string) {
  const [connected, setConnected] = useState(false);
  const [colorIndex, setColorIndex] = useState<number>(-1);
  const [clientId, setClientId] = useState<string>("");
  const [roomFull, setRoomFull] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [usedColors, setUsedColors] = useState<Set<number>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientIdRef = useRef(Math.random().toString(36).substring(2, 10));
  const idleRef = useRef(true);
  const hostMsgCallbackRef = useRef<((msg: any) => void) | null>(null);

  const connect = useCallback((overrideCode?: string) => {
    const targetCode = overrideCode || roomCode;
    if (!targetCode) return;
    const code = targetCode.toUpperCase();
    setKicked(false);
    setRoomFull(false);

    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    clientIdRef.current = Math.random().toString(36).substring(2, 10);
    setClientId(clientIdRef.current);

    const channel = supabase.channel(`game-room-${code}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'assign-color' }, (payload) => {
        const { clientId, colorIndex: ci } = payload.payload as { clientId: string; colorIndex: number };
        if (clientId === clientIdRef.current) setColorIndex(ci);
      })
      .on('broadcast', { event: 'used-colors' }, (payload) => {
        const { colors } = payload.payload as { colors: number[] };
        setUsedColors(new Set(colors));
      })
      .on('broadcast', { event: 'room-full' }, (payload) => {
        const { clientId } = payload.payload as { clientId: string };
        if (clientId === clientIdRef.current) {
          setRoomFull(true);
          setConnected(false);
          channelRef.current?.unsubscribe();
          channelRef.current = null;
        }
      })
      .on('broadcast', { event: 'kicked' }, (payload) => {
        const { clientId } = payload.payload as { clientId: string };
        if (clientId === clientIdRef.current) {
          setKicked(true);
          setConnected(false);
          setColorIndex(-1);
          channelRef.current?.unsubscribe();
          channelRef.current = null;
        }
      })
      .on('broadcast', { event: 'host-message' }, (payload) => {
        hostMsgCallbackRef.current?.(payload.payload);
      })
      .on('broadcast', { event: 'ping' }, (payload) => {
        if (idleRef.current) return;
        const { ts } = payload.payload as { ts: number };
        channel.send({ type: 'broadcast', event: 'pong', payload: { clientId: clientIdRef.current, ts } });
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
    if (idleRef.current) return;
    channelRef.current?.send({
      type: 'broadcast', event: 'joystick',
      payload: { clientId: clientIdRef.current, ...data },
    });
  }, []);

  const setIdle = useCallback((idle: boolean) => { idleRef.current = idle; }, []);

  const sendToHost = useCallback((msg: any) => {
    channelRef.current?.send({
      type: 'broadcast', event: 'client-action',
      payload: { clientId: clientIdRef.current, ...msg },
    });
  }, []);

  const onHostMessage = useCallback((cb: (msg: any) => void) => {
    hostMsgCallbackRef.current = cb;
  }, []);

  const requestColorSwap = useCallback((requestedColor: number) => {
    channelRef.current?.send({
      type: 'broadcast', event: 'color-swap',
      payload: { clientId: clientIdRef.current, requestedColor },
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
    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  return { connected, connect, sendJoystick, disconnect, colorIndex, roomFull, kicked, clientId, setIdle, sendToHost, onHostMessage, requestColorSwap, usedColors };
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

// ─── Room discovery ─────────────────────────────────────────
const LOBBY_CHANNEL = 'game-lobby';

export function useAdvertiseRoom(roomCode: string, _mode: ConnectionMode) {
  useEffect(() => {
    if (!roomCode) return;
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
  }, [roomCode]);
}

export function useDiscoverRooms(_mode: ConnectionMode) {
  const [rooms, setRooms] = useState<string[]>([]);
  useEffect(() => {
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
    return () => { channel.unsubscribe(); };
  }, []);
  return rooms;
}
