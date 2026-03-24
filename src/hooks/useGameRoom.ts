import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { MAX_PLAYERS, MAX_PLAYERS_1V3, MAX_PLAYERS_2V6, EAGLE_COLOR_INDICES } from '@/lib/playerColors';

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
  isBot?: boolean;
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
  // Persistent slot data for reconnection: keyed by original connId, survives disconnect
  const slotDataRef = useRef<Map<string, { colorIndex: number; code: string }>>(new Map());
  const [takeoverCodes, setTakeoverCodes] = useState<Record<string, string>>({});

  const recordSlot = (connId: string, colorIndex: number): string => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    slotDataRef.current.set(connId, { colorIndex, code });
    setTakeoverCodes(prev => ({ ...prev, [connId]: code }));
    return code;
  };

  const sendToClient = useCallback((connId: string, msg: any) => {
    const conn = connsRef.current.get(connId);
    if (conn) try { conn.send(JSON.stringify(msg)); } catch {}
  }, []);

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
      const newConnId = conn.peer;
      const takeoverCode = (conn.metadata as any)?.takeoverCode as string | undefined;

      // Resolve effective connId and validate takeover before 'open'
      let effectiveConnId = newConnId;
      let isValidTakeover = false;
      if (takeoverCode) {
        for (const [oldId, slotData] of slotDataRef.current.entries()) {
          if (slotData.code === takeoverCode) {
            effectiveConnId = oldId;
            isValidTakeover = true;
            break;
          }
        }
      }

      conn.on('open', () => {
        if (isValidTakeover) {
          // Reconnect: rebind new connection to old slot
          connsRef.current.get(effectiveConnId)?.close();
          connsRef.current.set(effectiveConnId, conn);
          const slotData = slotDataRef.current.get(effectiveConnId)!;
          // Restore color (was freed on disconnect)
          usedColorsRef.current.add(slotData.colorIndex);
          connColorMapRef.current.set(effectiveConnId, slotData.colorIndex);
          setPlayers((prev) => {
            const next = new Map(prev);
            next.set(effectiveConnId, { joystick: { x: 0, y: 0 }, colorIndex: slotData.colorIndex, ping: 0, lastPongAt: Date.now() });
            return next;
          });
          // Invalidate old code, issue fresh one
          const newCode = recordSlot(effectiveConnId, slotData.colorIndex);
          conn.send(JSON.stringify({ type: 'takeover-accepted', colorIndex: slotData.colorIndex, connId: effectiveConnId }));
          conn.send(JSON.stringify({ type: 'used-colors', colors: Array.from(usedColorsRef.current) }));
          void newCode; // used via slotDataRef side-effect
        } else {
          const mode = gameModeRef.current;
          const maxSlots = mode === '2v6' ? MAX_PLAYERS_2V6 : MAX_PLAYERS_1V3;
          if (usedColorsRef.current.size >= maxSlots) {
            conn.send(JSON.stringify({ type: 'room-full' }));
            setTimeout(() => conn.close(), 200);
            return;
          }
          const excludeIndices = mode === '2v6' ? [] : (EAGLE_COLOR_INDICES as unknown as number[]);
          const colorIndex = allocateColor(usedColorsRef.current, excludeIndices);
          if (colorIndex === null) {
            conn.send(JSON.stringify({ type: 'room-full' }));
            setTimeout(() => conn.close(), 200);
            return;
          }

          usedColorsRef.current.add(colorIndex);
          connColorMapRef.current.set(effectiveConnId, colorIndex);
          connsRef.current.set(effectiveConnId, conn);

          conn.send(JSON.stringify({ type: 'assign-color', colorIndex }));
          conn.send(JSON.stringify({ type: 'used-colors', colors: Array.from(usedColorsRef.current) }));
          setPlayers((prev) => {
            const next = new Map(prev);
            next.set(effectiveConnId, { joystick: { x: 0, y: 0 }, colorIndex, ping: 0, lastPongAt: Date.now() });
            return next;
          });
          recordSlot(effectiveConnId, colorIndex);
        }
      });

      conn.on('data', (data) => {
        if (data instanceof ArrayBuffer) {
          const decoded = decodeJoystick(data);
          setPlayers((prev) => {
            const next = new Map(prev);
            const existing = next.get(effectiveConnId);
            if (existing) {
              next.set(effectiveConnId, { ...existing, joystick: { x: decoded.x, y: decoded.y } });
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
                const existing = next.get(effectiveConnId);
                if (existing) {
                  next.set(effectiveConnId, { ...existing, ping: rtt, lastPongAt: Date.now() });
                }
                return next;
              });
            } else if (msg.type === 'color-swap') {
              handleColorSwap(effectiveConnId, msg.requestedColor);
              // Keep slotData color in sync after swap
              const newColor = connColorMapRef.current.get(effectiveConnId);
              if (newColor !== undefined) recordSlot(effectiveConnId, newColor);
            } else {
              clientMsgCallbackRef.current?.(effectiveConnId, msg);
            }
          }
        }
      });

      conn.on('close', () => removePlayer(effectiveConnId));
      conn.on('error', () => removePlayer(effectiveConnId));
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

  const addBot = useCallback((connId: string, colorIndex: number) => {
    usedColorsRef.current.add(colorIndex);
    connColorMapRef.current.set(connId, colorIndex);
    setPlayers((prev) => {
      const next = new Map(prev);
      next.set(connId, { joystick: { x: 0, y: 0 }, colorIndex, ping: 0, lastPongAt: Date.now(), isBot: true });
      return next;
    });
  }, []);

  const removeBot = useCallback((connId: string) => {
    const colorIdx = connColorMapRef.current.get(connId);
    if (colorIdx !== undefined) {
      usedColorsRef.current.delete(colorIdx);
      connColorMapRef.current.delete(connId);
    }
    setPlayers((prev) => {
      const next = new Map(prev);
      next.delete(connId);
      return next;
    });
  }, []);

  const fillBots = useCallback(() => {
    const mode = gameModeRef.current;
    const maxSlots = mode === '2v6' ? MAX_PLAYERS_2V6 : MAX_PLAYERS_1V3;
    const currentCount = usedColorsRef.current.size;
    const needed = maxSlots - currentCount;
    if (needed <= 0) return;

    // In 1v3, we might need a bot eagle. Check if any eagle color is taken.
    const hasEagle = mode === '1v3' ? Array.from(usedColorsRef.current).some(c => EAGLE_COLOR_INDICES.includes(c)) : true;

    for (let i = 0; i < needed; i++) {
      const excludeIndices = mode === '2v6' ? [] : (EAGLE_COLOR_INDICES as unknown as number[]);
      // If 1v3 and no eagle yet, first bot should be eagle
      const needEagle = mode === '1v3' && !hasEagle && i === 0;
      let colorIndex: number | null;
      if (needEagle) {
        const eagleIdx = EAGLE_COLOR_INDICES.find(c => !usedColorsRef.current.has(c));
        colorIndex = eagleIdx ?? null;
      } else {
        colorIndex = allocateColor(usedColorsRef.current, excludeIndices);
      }
      if (colorIndex === null) break;

      const isEagleSlot = EAGLE_COLOR_INDICES.includes(colorIndex);
      const botId = isEagleSlot ? `bot-eagle-${i}` : `bot-chick-${i + 1}`;
      addBot(botId, colorIndex);
    }
  }, [addBot]);

  const removeBots = useCallback(() => {
    const botIds = Array.from(connColorMapRef.current.keys()).filter(id => id.startsWith('bot-'));
    for (const id of botIds) removeBot(id);
  }, [removeBot]);

  return { roomCode, players, kickPlayer, kickAllPlayers, broadcast, onClientMessage, usedColors: usedColorsRef, gameModeRef, takeoverCodes, sendToClient, addBot, removeBot, fillBots, removeBots };
}

// ─── HOST: Supabase ─────────────────────────────────────────
function useHostSupabase() {
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState<Map<string, PlayerState>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const usedColorsRef = useRef<Set<number>>(new Set());
  const clientColorMapRef = useRef<Map<string, number>>(new Map());
  const clientMsgCallbackRef = useRef<((connId: string, msg: any) => void) | null>(null);
  const gameModeRef = useRef<'1v3' | '2v6'>('1v3');
  const slotDataRef = useRef<Map<string, { colorIndex: number; code: string }>>(new Map());
  const clientAliasRef = useRef<Map<string, string>>(new Map()); // newClientId → oldClientId
  const currentClientRef = useRef<Map<string, string>>(new Map()); // oldClientId → currentClientId
  const [takeoverCodes, setTakeoverCodes] = useState<Record<string, string>>({});

  const recordSlot = (connId: string, colorIndex: number): string => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    slotDataRef.current.set(connId, { colorIndex, code });
    setTakeoverCodes(prev => ({ ...prev, [connId]: code }));
    return code;
  };

  const sendToClient = useCallback((connId: string, msg: any) => {
    const currentId = currentClientRef.current.get(connId) ?? connId;
    channelRef.current?.send({ type: 'broadcast', event: 'host-direct', payload: { targetId: currentId, ...msg } });
  }, []);

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
        const resolvedId = clientAliasRef.current.get(clientId) ?? clientId;
        setPlayers((prev) => {
          const next = new Map(prev);
          const existing = next.get(resolvedId);
          if (existing) next.set(resolvedId, { ...existing, joystick: { x, y } });
          return next;
        });
      })
      .on('broadcast', { event: 'client-join' }, (payload) => {
        const { clientId, takeoverCode } = payload.payload as { clientId: string; takeoverCode?: string };

        // Validate takeover
        if (takeoverCode) {
          for (const [oldId, slotData] of slotDataRef.current.entries()) {
            if (slotData.code === takeoverCode) {
              // Reconnect: remap new clientId to old slot
              clientAliasRef.current.set(clientId, oldId);
              currentClientRef.current.set(oldId, clientId);
              usedColorsRef.current.add(slotData.colorIndex);
              clientColorMapRef.current.set(oldId, slotData.colorIndex);
              setPlayers((prev) => {
                const next = new Map(prev);
                next.set(oldId, { joystick: { x: 0, y: 0 }, colorIndex: slotData.colorIndex, ping: 0, lastPongAt: Date.now() });
                return next;
              });
              // Invalidate old code
              const newCode = recordSlot(oldId, slotData.colorIndex);
              void newCode;
              channel.send({ type: 'broadcast', event: 'host-direct', payload: { targetId: clientId, type: 'takeover-accepted', colorIndex: slotData.colorIndex, connId: oldId } });
              channel.send({ type: 'broadcast', event: 'used-colors', payload: { colors: Array.from(usedColorsRef.current) } });
              return;
            }
          }
          // Invalid code — fall through to normal join
        }

        const mode = gameModeRef.current;
        const maxSlots = mode === '2v6' ? MAX_PLAYERS_2V6 : MAX_PLAYERS_1V3;
        if (usedColorsRef.current.size >= maxSlots) {
          channel.send({ type: 'broadcast', event: 'room-full', payload: { clientId } });
          return;
        }
        const excludeIndices = mode === '2v6' ? [] : (EAGLE_COLOR_INDICES as unknown as number[]);
        const colorIndex = allocateColor(usedColorsRef.current, excludeIndices);
        if (colorIndex === null) {
          channel.send({ type: 'broadcast', event: 'room-full', payload: { clientId } });
          return;
        }
        usedColorsRef.current.add(colorIndex);
        clientColorMapRef.current.set(clientId, colorIndex);
        currentClientRef.current.set(clientId, clientId);
        setPlayers((prev) => {
          const next = new Map(prev);
          next.set(clientId, { joystick: { x: 0, y: 0 }, colorIndex, ping: 0, lastPongAt: Date.now() });
          return next;
        });
        recordSlot(clientId, colorIndex);
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
        // Resolve alias: new clientId may map to old connId for game logic
        const resolvedId = clientAliasRef.current.get(clientId) ?? clientId;
        clientMsgCallbackRef.current?.(resolvedId, msg);
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

  const addBot = useCallback((connId: string, colorIndex: number) => {
    usedColorsRef.current.add(colorIndex);
    clientColorMapRef.current.set(connId, colorIndex);
    setPlayers((prev) => {
      const next = new Map(prev);
      next.set(connId, { joystick: { x: 0, y: 0 }, colorIndex, ping: 0, lastPongAt: Date.now(), isBot: true });
      return next;
    });
  }, []);

  const removeBot = useCallback((connId: string) => {
    const colorIdx = clientColorMapRef.current.get(connId);
    if (colorIdx !== undefined) {
      usedColorsRef.current.delete(colorIdx);
      clientColorMapRef.current.delete(connId);
    }
    setPlayers((prev) => {
      const next = new Map(prev);
      next.delete(connId);
      return next;
    });
  }, []);

  const fillBots = useCallback(() => {
    const mode = gameModeRef.current;
    const maxSlots = mode === '2v6' ? MAX_PLAYERS_2V6 : MAX_PLAYERS_1V3;
    const currentCount = usedColorsRef.current.size;
    const needed = maxSlots - currentCount;
    if (needed <= 0) return;

    const hasEagle = mode === '1v3' ? Array.from(usedColorsRef.current).some(c => EAGLE_COLOR_INDICES.includes(c)) : true;

    for (let i = 0; i < needed; i++) {
      const excludeIndices = mode === '2v6' ? [] : (EAGLE_COLOR_INDICES as unknown as number[]);
      const needEagle = mode === '1v3' && !hasEagle && i === 0;
      let colorIndex: number | null;
      if (needEagle) {
        const eagleIdx = EAGLE_COLOR_INDICES.find(c => !usedColorsRef.current.has(c));
        colorIndex = eagleIdx ?? null;
      } else {
        colorIndex = allocateColor(usedColorsRef.current, excludeIndices);
      }
      if (colorIndex === null) break;

      const isEagleSlot = EAGLE_COLOR_INDICES.includes(colorIndex);
      const botId = isEagleSlot ? `bot-eagle-${i}` : `bot-chick-${i + 1}`;
      addBot(botId, colorIndex);
    }
  }, [addBot]);

  const removeBots = useCallback(() => {
    const botIds = Array.from(clientColorMapRef.current.keys()).filter(id => id.startsWith('bot-'));
    for (const id of botIds) removeBot(id);
  }, [removeBot]);

  return { roomCode, players, kickPlayer, kickAllPlayers, broadcast, onClientMessage, usedColors: usedColorsRef, gameModeRef, takeoverCodes, sendToClient, addBot, removeBot, fillBots, removeBots };
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

  const connect = useCallback((overrideCode?: string, takeoverCode?: string) => {
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
        metadata: takeoverCode ? { takeoverCode } : undefined,
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
          } else if (msg.type === 'takeover-accepted') {
            colorIndexRef.current = msg.colorIndex;
            setColorIndex(msg.colorIndex);
            hostMsgCallbackRef.current?.(msg); // forward for connIdRef update in Client.tsx
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

  const connect = useCallback((overrideCode?: string, takeoverCode?: string) => {
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
      .on('broadcast', { event: 'host-direct' }, (payload) => {
        const { targetId, ...msg } = payload.payload as { targetId: string; [key: string]: any };
        if (targetId !== clientIdRef.current) return;
        if (msg.type === 'takeover-accepted') {
          setColorIndex(msg.colorIndex);
        }
        hostMsgCallbackRef.current?.(msg);
      })
      .on('broadcast', { event: 'ping' }, (payload) => {
        if (idleRef.current) return;
        const { ts } = payload.payload as { ts: number };
        channel.send({ type: 'broadcast', event: 'pong', payload: { clientId: clientIdRef.current, ts } });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          channel.send({ type: 'broadcast', event: 'client-join', payload: { clientId: clientIdRef.current, ...(takeoverCode ? { takeoverCode } : {}) } });
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
