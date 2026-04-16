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
const JOYSTICK_SEND_INTERVAL = 45;
const JOYSTICK_DEADZONE = 0.04;
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function getIceServers() {
  const raw = import.meta.env.VITE_ICE_SERVERS as string | undefined;
  if (!raw) return DEFAULT_ICE_SERVERS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return DEFAULT_ICE_SERVERS;
}

type IceServer = RTCIceServer;

let turnIceServersCache: IceServer[] | null | undefined = undefined;
let turnIceServersInFlight: Promise<IceServer[] | null> | null = null;

async function fetchTurnIceServers(): Promise<IceServer[] | null> {
  if (turnIceServersCache !== undefined) return turnIceServersCache;
  if (turnIceServersInFlight) return turnIceServersInFlight;

  turnIceServersInFlight = (async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3500);
    try {
      const resp = await fetch('/api/turn-credentials', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!resp.ok) {
        turnIceServersCache = null;
        return null;
      }
      const data = (await resp.json()) as { iceServers?: IceServer[] };
      if (!Array.isArray(data.iceServers) || data.iceServers.length === 0) {
        turnIceServersCache = null;
        return null;
      }
      turnIceServersCache = data.iceServers;
      return data.iceServers;
    } catch {
      turnIceServersCache = null;
      return null;
    } finally {
      clearTimeout(timeoutId);
      turnIceServersInFlight = null;
    }
  })();

  return turnIceServersInFlight;
}

function dedupeIceServers(servers: IceServer[]): IceServer[] {
  const seen = new Set<string>();
  const out: IceServer[] = [];
  for (const s of servers) {
    const key = JSON.stringify(s);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

async function getIceServersWithTurn(): Promise<IceServer[]> {
  const base = getIceServers() as IceServer[];
  const turn = await fetchTurnIceServers();
  return dedupeIceServers(turn ? [...turn, ...base] : [...base]);
}

type WebRtcOptions = {
  /**
   * When true, prefer TURN-only relay in WebRTC config.
   * Safety: only applied when Cloudflare TURN credentials were successfully fetched.
   */
  forceRelay?: boolean;
};

async function buildPeerRtcConfig(opts?: WebRtcOptions): Promise<RTCConfiguration> {
  const base = getIceServers() as IceServer[];
  const turn = await fetchTurnIceServers();
  const iceServers = dedupeIceServers(turn ? [...turn, ...base] : [...base]);

  const cfg: RTCConfiguration = {
    iceServers,
    iceCandidatePoolSize: 4,
  };

  if (opts?.forceRelay && turn && turn.length > 0) {
    cfg.iceTransportPolicy = 'relay';
  }

  return cfg;
}

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
function useHostWebRTC(enabled: boolean, opts?: WebRtcOptions) {
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
  const clientAliasRef = useRef<Map<string, string>>(new Map()); // newClientId → oldClientId
  const [takeoverCodes, setTakeoverCodes] = useState<Record<string, string>>({});
  const pingDiagnosticsEnabledRef = useRef(false);
  const setPingDiagnosticsEnabled = useCallback((enabled: boolean) => {
    pingDiagnosticsEnabledRef.current = enabled;
  }, []);
  const resolveClientId = useCallback((clientId: string) => clientAliasRef.current.get(clientId) ?? clientId, []);

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
    if (!enabled) {
      setRoomCode('');
      setPlayers(new Map());
      return;
    }

    const code = generateRoomCode();
    setRoomCode(code);

    let cancelled = false;
    let peer: Peer | null = null;
    let pingInterval: number | null = null;

    void (async () => {
      const rtcConfig = await buildPeerRtcConfig({ forceRelay: opts?.forceRelay });
      if (cancelled) return;

      peer = new Peer(`${PEER_PREFIX}${code}`, {
        config: rtcConfig,
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
            conn.send(JSON.stringify({ type: 'game-mode', gameMode: gameModeRef.current }));
            void newCode; // used via slotDataRef side-effect
          } else {
            const mode = gameModeRef.current;
            const maxSlots = mode === '2v6' ? MAX_PLAYERS_2V6 : MAX_PLAYERS_1V3;
            if (usedColorsRef.current.size >= maxSlots) {
              // Try to replace a bot
              const botEntry = Array.from(connColorMapRef.current.entries()).find(([id]) => id.startsWith('bot-'));
              if (botEntry) {
                const [botId, botColor] = botEntry;
                usedColorsRef.current.delete(botColor);
                connColorMapRef.current.delete(botId);
                slotDataRef.current.delete(botId);
                setTakeoverCodes((prev) => {
                  if (!(botId in prev)) return prev;
                  const next = { ...prev };
                  delete next[botId];
                  return next;
                });
                setPlayers((prev) => { const next = new Map(prev); next.delete(botId); return next; });
              } else {
                conn.send(JSON.stringify({ type: 'room-full' }));
                setTimeout(() => conn.close(), 200);
                return;
              }
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
            conn.send(JSON.stringify({ type: 'game-mode', gameMode: gameModeRef.current }));
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
        } else if (typeof data === 'object' && data !== null && (data as any).type === 'joystick') {
          const msgData = data as { x: number; y: number };
          setPlayers((prev) => {
            const next = new Map(prev);
            const existing = next.get(effectiveConnId);
            if (existing) {
              next.set(effectiveConnId, { ...existing, joystick: { x: msgData.x, y: msgData.y } });
            }
            return next;
          });
        } else {
          let msg: any = null;
          if (typeof data === 'string') {
            try { msg = JSON.parse(data); } catch {}
          } else if (typeof data === 'object' && data !== null) {
            msg = data;
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

      pingInterval = window.setInterval(() => {
        if (!pingDiagnosticsEnabledRef.current) return;
        const ts = Date.now();
        connsRef.current.forEach((conn) => {
          try { conn.send(JSON.stringify({ type: 'ping', ts })); } catch {}
        });
      }, 500);
    })();

    return () => {
      cancelled = true;
      if (pingInterval) clearInterval(pingInterval);
      connsRef.current.forEach((c) => c.close());
      connsRef.current.clear();
      peer?.destroy();
    };
  }, [enabled, removePlayer, handleColorSwap, opts?.forceRelay]);

  const addBot = useCallback((connId: string, colorIndex: number) => {
    usedColorsRef.current.add(colorIndex);
    connColorMapRef.current.set(connId, colorIndex);
    recordSlot(connId, colorIndex);
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
    slotDataRef.current.delete(connId);
    setTakeoverCodes((prev) => {
      if (!(connId in prev)) return prev;
      const next = { ...prev };
      delete next[connId];
      return next;
    });
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

  return { roomCode, players, kickPlayer, kickAllPlayers, broadcast, onClientMessage, usedColors: usedColorsRef, gameModeRef, takeoverCodes, sendToClient, addBot, removeBot, fillBots, removeBots, setPingDiagnosticsEnabled };
}

// ─── HOST: Supabase ─────────────────────────────────────────
function useHostSupabase(enabled: boolean) {
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
  const pingDiagnosticsEnabledRef = useRef(false);
  const setPingDiagnosticsEnabled = useCallback((enabled: boolean) => {
    pingDiagnosticsEnabledRef.current = enabled;
  }, []);
  const resolveClientId = useCallback((clientId: string) => clientAliasRef.current.get(clientId) ?? clientId, []);

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
    const resolvedId = resolveClientId(clientId);
    const colorIdx = clientColorMapRef.current.get(resolvedId);
    if (colorIdx !== undefined) {
      usedColorsRef.current.delete(colorIdx);
      clientColorMapRef.current.delete(resolvedId);
    }
    // Remove current-client mapping for the disconnected id.
    for (const [slotId, currentId] of currentClientRef.current.entries()) {
      if (slotId === resolvedId || currentId === clientId) {
        currentClientRef.current.delete(slotId);
      }
    }
    // Clear alias entries for this connected client and slot id.
    clientAliasRef.current.delete(clientId);
    for (const [newId, oldId] of clientAliasRef.current.entries()) {
      if (oldId === resolvedId) clientAliasRef.current.delete(newId);
    }
    setPlayers((prev) => {
      const next = new Map(prev);
      next.delete(resolvedId);
      return next;
    });
  }, [resolveClientId]);

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
    currentClientRef.current.clear();
    clientAliasRef.current.clear();
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
    if (!enabled) {
      setRoomCode('');
      setPlayers(new Map());
      return;
    }

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
              channel.send({ type: 'broadcast', event: 'host-direct', payload: { targetId: clientId, type: 'game-mode', gameMode: gameModeRef.current } });
              return;
            }
          }
          // Invalid code — fall through to normal join
        }

        const mode = gameModeRef.current;
        const maxSlots = mode === '2v6' ? MAX_PLAYERS_2V6 : MAX_PLAYERS_1V3;
        if (usedColorsRef.current.size >= maxSlots) {
          // Try to replace a bot
          const botEntry = Array.from(clientColorMapRef.current.entries()).find(([id]) => id.startsWith('bot-'));
          if (botEntry) {
            const [botId, botColor] = botEntry;
            usedColorsRef.current.delete(botColor);
            clientColorMapRef.current.delete(botId);
            slotDataRef.current.delete(botId);
            setTakeoverCodes((prev) => {
              if (!(botId in prev)) return prev;
              const next = { ...prev };
              delete next[botId];
              return next;
            });
            setPlayers((prev) => { const next = new Map(prev); next.delete(botId); return next; });
          } else {
            channel.send({ type: 'broadcast', event: 'room-full', payload: { clientId } });
            return;
          }
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
        channel.send({ type: 'broadcast', event: 'host-direct', payload: { targetId: clientId, type: 'game-mode', gameMode: gameModeRef.current } });
      })
      .on('broadcast', { event: 'client-leave' }, (payload) => {
        const { clientId } = payload.payload as { clientId: string };
        removePlayer(resolveClientId(clientId));
      })
      .on('broadcast', { event: 'color-swap' }, (payload) => {
        const { clientId, requestedColor } = payload.payload as { clientId: string; requestedColor: number };
        handleColorSwap(resolveClientId(clientId), requestedColor);
      })
      .on('broadcast', { event: 'client-action' }, (payload) => {
        const { clientId, ...msg } = payload.payload as { clientId: string; [key: string]: any };
        // Resolve alias: new clientId may map to old connId for game logic
        const resolvedId = clientAliasRef.current.get(clientId) ?? clientId;
        clientMsgCallbackRef.current?.(resolvedId, msg);
      })
      .on('broadcast', { event: 'pong' }, (payload) => {
        const { clientId, ts } = payload.payload as { clientId: string; ts: number };
        const resolvedId = resolveClientId(clientId);
        const rtt = Date.now() - ts;
        setPlayers((prev) => {
          const next = new Map(prev);
          const existing = next.get(resolvedId);
          if (existing) next.set(resolvedId, { ...existing, ping: rtt, lastPongAt: Date.now() });
          return next;
        });
      })
      .subscribe();

    channelRef.current = channel;

    const pingInterval = window.setInterval(() => {
      if (!pingDiagnosticsEnabledRef.current) return;
      channel.send({ type: 'broadcast', event: 'ping', payload: { ts: Date.now() } });
    }, 500);

    return () => {
      clearInterval(pingInterval);
      channel.unsubscribe();
    };
  }, [enabled, removePlayer, handleColorSwap, resolveClientId]);

  const addBot = useCallback((connId: string, colorIndex: number) => {
    usedColorsRef.current.add(colorIndex);
    clientColorMapRef.current.set(connId, colorIndex);
    recordSlot(connId, colorIndex);
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
    slotDataRef.current.delete(connId);
    setTakeoverCodes((prev) => {
      if (!(connId in prev)) return prev;
      const next = { ...prev };
      delete next[connId];
      return next;
    });
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

  return { roomCode, players, kickPlayer, kickAllPlayers, broadcast, onClientMessage, usedColors: usedColorsRef, gameModeRef, takeoverCodes, sendToClient, addBot, removeBot, fillBots, removeBots, setPingDiagnosticsEnabled };
}

// ─── CLIENT: WebRTC ─────────────────────────────────────────
function useClientWebRTC(roomCode: string, enabled: boolean, opts?: WebRtcOptions) {
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
  const lastSentJoystickRef = useRef<JoystickData>({ x: 0, y: 0 });
  const idleRef = useRef(true);
  const inputLockedRef = useRef(false);
  const colorIndexRef = useRef(-1);
  const hostMsgCallbackRef = useRef<((msg: any) => void) | null>(null);

  const connect = useCallback(async (overrideCode?: string, takeoverCode?: string) => {
    if (!enabled) return;
    const targetCode = overrideCode || roomCode;
    if (!targetCode) return;

    // Guard: prevent duplicate simultaneous connections
    if (peerRef.current !== null && !peerRef.current.destroyed) {
      console.warn("WebRTC connection already in progress");
      return;
    }

    const code = targetCode.toUpperCase();
    setKicked(false);
    setRoomFull(false);
    inputLockedRef.current = false;
    joystickRef.current = { x: 0, y: 0 };

    const rtcConfig = await buildPeerRtcConfig({ forceRelay: opts?.forceRelay });

    const peer = new Peer(undefined as any, {
      config: rtcConfig,
    });
    peerRef.current = peer;

    peer.on('open', () => {
      setClientId(peer.id);
      const conn = peer.connect(`${PEER_PREFIX}${code}`, {
        serialization: 'json',
        reliable: false,
        metadata: takeoverCode ? { takeoverCode } : undefined,
      });
      connRef.current = conn;

      conn.on('open', () => {
        setConnected(true);
        intervalRef.current = window.setInterval(() => {
          if (colorIndexRef.current >= 0 && !idleRef.current && !inputLockedRef.current) {
            const next = joystickRef.current;
            const last = lastSentJoystickRef.current;
            const dx = next.x - last.x;
            const dy = next.y - last.y;
            const movedEnough = Math.hypot(dx, dy) >= JOYSTICK_DEADZONE;
            if (!movedEnough) return;
            try {
              conn.send({
                type: 'joystick',
                colorIndex: colorIndexRef.current,
                x: next.x,
                y: next.y,
              });
              lastSentJoystickRef.current = next;
            } catch {}
          }
        }, JOYSTICK_SEND_INTERVAL);
      });

      conn.on('data', (data) => {
        let msg: any = null;
        if (typeof data === 'string') {
          try { msg = JSON.parse(data); } catch {}
        } else if (data instanceof ArrayBuffer) {
          try { msg = JSON.parse(new TextDecoder().decode(data)); } catch {}
        } else if (typeof data === 'object' && data !== null) {
          msg = data;
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
            try { conn.send({ type: 'pong', ts: msg.ts }); } catch {}
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
  }, [enabled, roomCode, opts?.forceRelay]);

  const doDisconnect = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    connRef.current?.close();
    connRef.current = null;
    peerRef.current?.destroy();
    peerRef.current = null;
    inputLockedRef.current = false;
    joystickRef.current = { x: 0, y: 0 };
    setConnected(false);
    setColorIndex(-1);
    colorIndexRef.current = -1;
  }, []);

  const disconnect = useCallback(() => { doDisconnect(); }, [doDisconnect]);

  const sendJoystick = useCallback((data: JoystickData) => {
    joystickRef.current = data;
    if (!idleRef.current && !inputLockedRef.current && connRef.current && colorIndexRef.current >= 0) {
      const last = lastSentJoystickRef.current;
      const dx = data.x - last.x;
      const dy = data.y - last.y;
      const movedEnough = Math.hypot(dx, dy) >= JOYSTICK_DEADZONE;
      if (!movedEnough) return;
      try {
        connRef.current.send({
          type: 'joystick',
          colorIndex: colorIndexRef.current,
          x: data.x,
          y: data.y,
        });
        lastSentJoystickRef.current = data;
      } catch {}
    }
  }, []);

  const setIdle = useCallback((idle: boolean) => { idleRef.current = idle; }, []);

  const setInputLocked = useCallback((locked: boolean) => {
    inputLockedRef.current = locked;
    if (!locked) return;
    joystickRef.current = { x: 0, y: 0 };
    if (connRef.current && colorIndexRef.current >= 0) {
      try { connRef.current.send({ type: 'joystick', colorIndex: colorIndexRef.current, x: 0, y: 0 }); } catch {}
    }
  }, []);

  const sendToHost = useCallback((msg: any) => {
    if (inputLockedRef.current) return;
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

  return { connected, connect, sendJoystick, disconnect, colorIndex, roomFull, kicked, clientId, setIdle, setInputLocked, sendToHost, onHostMessage, requestColorSwap, usedColors };
}

// ─── CLIENT: Supabase ───────────────────────────────────────
function useClientSupabase(roomCode: string, enabled: boolean) {
  const [connected, setConnected] = useState(false);
  const [colorIndex, setColorIndex] = useState<number>(-1);
  const [clientId, setClientId] = useState<string>("");
  const [roomFull, setRoomFull] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [usedColors, setUsedColors] = useState<Set<number>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientIdRef = useRef(Math.random().toString(36).substring(2, 10));
  const idleRef = useRef(true);
  const inputLockedRef = useRef(false);
  const hostMsgCallbackRef = useRef<((msg: any) => void) | null>(null);

  const connect = useCallback((overrideCode?: string, takeoverCode?: string) => {
    if (!enabled) return;
    const targetCode = overrideCode || roomCode;
    if (!targetCode) return;

    // Guard: prevent duplicate simultaneous connections
    if (channelRef.current !== null) {
      console.warn("Supabase connection already in progress");
      return;
    }

    const code = targetCode.toUpperCase();
    setKicked(false);
    setRoomFull(false);
    inputLockedRef.current = false;

    clientIdRef.current = Math.random().toString(36).substring(2, 10);
    setClientId(clientIdRef.current);

    const channel = supabase.channel(`game-room-${code}`, {
      config: { broadcast: { self: false } },
    });

    // Add a timeout to validate that a host is actually using this room code
    let validationTimeoutId: NodeJS.Timeout | null = null;
    let hostValidated = false;

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
        hostValidated = true;
        hostMsgCallbackRef.current?.(payload.payload);
      })
      .on('broadcast', { event: 'host-direct' }, (payload) => {
        hostValidated = true;
        const { targetId, ...msg } = payload.payload as { targetId: string; [key: string]: any };
        if (targetId !== clientIdRef.current) return;
        if (msg.type === 'takeover-accepted') {
          setColorIndex(msg.colorIndex);
        }
        hostMsgCallbackRef.current?.(msg);
      })
      .on('broadcast', { event: 'ping' }, (payload) => {
        hostValidated = true;
        // Always respond to pings regardless of idle state for connection health
        const { ts } = payload.payload as { ts: number };
        channel.send({ type: 'broadcast', event: 'pong', payload: { clientId: clientIdRef.current, ts } });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Set a validation timeout: if no host message is received within 8 seconds, disconnect
          validationTimeoutId = setTimeout(() => {
            if (!hostValidated && channelRef.current === channel) {
              // No host activity detected — invalid room code
              channel.unsubscribe();
              channelRef.current = null;
              setConnected(false);
              // Notify via a kicked event to show error
              setKicked(true);
            }
          }, 8000);

          setConnected(true);
          channel.send({ type: 'broadcast', event: 'client-join', payload: { clientId: clientIdRef.current, ...(takeoverCode ? { takeoverCode } : {}) } });
        }
      });

    channelRef.current = channel;
  }, [enabled, roomCode]);

  const sendJoystick = useCallback((data: JoystickData) => {
    if (idleRef.current || inputLockedRef.current) return;
    channelRef.current?.send({
      type: 'broadcast', event: 'joystick',
      payload: { clientId: clientIdRef.current, ...data },
    });
  }, []);

  const setIdle = useCallback((idle: boolean) => { idleRef.current = idle; }, []);

  const setInputLocked = useCallback((locked: boolean) => {
    inputLockedRef.current = locked;
    if (!locked) return;
    channelRef.current?.send({
      type: 'broadcast', event: 'joystick',
      payload: { clientId: clientIdRef.current, x: 0, y: 0 },
    });
  }, []);

  const sendToHost = useCallback((msg: any) => {
    if (inputLockedRef.current) return;
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
    inputLockedRef.current = false;
    channelRef.current?.send({ type: 'broadcast', event: 'client-leave', payload: { clientId: clientIdRef.current } });
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setConnected(false);
    setColorIndex(-1);
  }, []);

  useEffect(() => {
    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  return { connected, connect, sendJoystick, disconnect, colorIndex, roomFull, kicked, clientId, setIdle, setInputLocked, sendToHost, onHostMessage, requestColorSwap, usedColors };
}

// ─── Public hooks ───────────────────────────────────────────
const NOOP_HOST = {
  roomCode: '', players: new Map(), kickPlayer: () => {}, kickAllPlayers: () => {},
  broadcast: () => {}, onClientMessage: () => {}, usedColors: { current: new Set<number>() },
  gameModeRef: { current: '1v3' as const }, takeoverCodes: {}, sendToClient: () => {},
  addBot: () => {}, removeBot: () => {}, fillBots: () => {}, removeBots: () => {},
  setPingDiagnosticsEnabled: () => {},
};

const NOOP_CLIENT = {
  connected: false, connect: () => {}, sendJoystick: () => {}, disconnect: () => {},
  colorIndex: -1, roomFull: false, kicked: false, clientId: '', setIdle: () => {}, setInputLocked: () => {},
  sendToHost: () => {}, onHostMessage: () => {}, requestColorSwap: () => {},
  usedColors: new Set<number>(),
};

export function useHostRoom(mode: ConnectionMode = 'webrtc', opts?: WebRtcOptions) {
  const webrtc = useHostWebRTC(mode === 'webrtc', opts);
  const supa = useHostSupabase(mode === 'supabase');
  return mode === 'webrtc' ? webrtc : supa;
}

export function useClientRoom(roomCode: string, mode: ConnectionMode = 'webrtc', opts?: WebRtcOptions) {
  const webrtc = useClientWebRTC(roomCode, mode === 'webrtc', opts);
  const supa = useClientSupabase(roomCode, mode === 'supabase');
  return mode === 'webrtc' ? webrtc : supa;
}

// ─── Room discovery ─────────────────────────────────────────
const LOBBY_CHANNEL = 'game-lobby';
const WEBRTC_BROADCAST_CHANNEL = 'webrtc-rooms'; // For WebRTC broadcast persistence

/**
 * Advertises room code:
 * - Supabase: Only during lobby phase (clears on game start for cleaner lobby list)
 * - WebRTC: Continuously broadcasts to Supabase for rejoin scenarios
 */
export function useAdvertiseRoom(roomCode: string, isLobby: boolean, _mode: ConnectionMode) {
  useEffect(() => {
    if (!roomCode || !isLobby) {
      // If not in lobby, don't advertise to this channel
      return;
    }

    const channel = supabase.channel(LOBBY_CHANNEL, { config: { presence: { key: `host-${roomCode}` } } });
    let alive = true;

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && alive) {
        await channel.track({ roomCode, ts: Date.now() });
      }
    });

    // Re-track periodically to keep presence alive
    const heartbeat = window.setInterval(async () => {
      if (alive) {
        try { await channel.track({ roomCode, ts: Date.now() }); } catch {}
      }
    }, 5_000);

    return () => {
      alive = false;
      clearInterval(heartbeat);
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [roomCode, isLobby]);
}

/**
 * Broadcasts room code via WebRTC to Supabase for persistence during active game (rejoin support)
 * This runs independently and keeps the room discoverable even after game starts
 */
export function useWebRTCRoomBroadcast(roomCode: string) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const aliveRef = useRef(false);
  const roomCodeRef = useRef(roomCode);
  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  const rebroadcastNow = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || !aliveRef.current || !roomCodeRef.current) return false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await channel.track({ roomCode: roomCodeRef.current, ts: Date.now(), source: 'webrtc' });
        return true;
      } catch {
        await new Promise((r) => window.setTimeout(r, 120));
      }
    }
    return false;
  }, []);

  const broadcastBeaconNow = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || !aliveRef.current || !roomCodeRef.current) return false;
    try {
      await channel.send({
        type: 'broadcast',
        event: 'room-beacon',
        payload: { roomCode: roomCodeRef.current, ts: Date.now(), source: 'webrtc-click' },
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    const channel = supabase.channel(WEBRTC_BROADCAST_CHANNEL, {
      config: {
        presence: { key: `webrtc-${roomCode}` },
        broadcast: { self: false },
      },
    });
    let alive = true;
    channelRef.current = channel;
    aliveRef.current = true;

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && alive) {
        // Broadcast room code via WebRTC channel (persistent, including during gameplay)
        await channel.track({ roomCode, ts: Date.now(), source: 'webrtc' });
      }
    });

    // Re-track periodically to keep WebRTC broadcast alive - use 5s to reduce network overhead
    const heartbeat = window.setInterval(async () => {
      if (alive) {
        try { await channel.track({ roomCode, ts: Date.now(), source: 'webrtc' }); } catch {}
      }
    }, 1_000);

    return () => {
      alive = false;
      aliveRef.current = false;
      channelRef.current = null;
      clearInterval(heartbeat);
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  return {
    rebroadcastNow,
    broadcastBeaconNow,
  };
}

/**
 * Discovers rooms from both sources:
 * - Supabase LOBBY_CHANNEL: Active lobby rooms only (cleared on game start)
 * - Supabase WEBRTC_BROADCAST_CHANNEL: All rooms including active games (for rejoin)
 * - Deduplicates and combines both lists
 */
export function useDiscoverRooms(mode: ConnectionMode) {
  const [rooms, setRooms] = useState<string[]>([]);
  useEffect(() => {
    const discoveredRooms = new Set<string>();
    const beaconRooms = new Map<string, number>(); // roomCode -> expiresAt

    // Channel 1: Discover lobby rooms (clears on game start)
    const lobbyChannel = supabase.channel(LOBBY_CHANNEL, { 
      config: { presence: { key: `discover-lobby-${Math.random().toString(36).slice(2, 6)}` } } 
    });

    const updateRooms = () => {
      discoveredRooms.clear();
      const now = Date.now();

      for (const [code, expiresAt] of beaconRooms.entries()) {
        if (expiresAt <= now) {
          beaconRooms.delete(code);
          continue;
        }
        discoveredRooms.add(code);
      }

      // Get rooms from lobby channel (active lobby rooms)
      if (mode === 'supabase') {
        const lobbyState = lobbyChannel.presenceState();
        const lobbyCodes = Object.values(lobbyState)
          .flat()
          .map((p: any) => p.roomCode as string)
          .filter(Boolean);
        lobbyCodes.forEach(code => discoveredRooms.add(code));
      }

      // WebRTC mode uses the persistent broadcast channel; supabase mode merges both.
      if (mode === 'webrtc' || mode === 'supabase') {
        const webrtcState = webrtcChannel.presenceState();
        const webrtcCodes = Object.values(webrtcState)
          .flat()
          .map((p: any) => p.roomCode as string)
          .filter(Boolean);
        webrtcCodes.forEach(code => discoveredRooms.add(code));
      }

      setRooms(Array.from(discoveredRooms).sort());
    };

    lobbyChannel.on('presence', { event: 'sync' }, updateRooms);
    lobbyChannel.on('presence', { event: 'join' }, updateRooms);
    lobbyChannel.on('presence', { event: 'leave' }, updateRooms);

    // Channel 2: Discover WebRTC broadcasts (persistent, includes active games)
    const webrtcChannel = supabase.channel(WEBRTC_BROADCAST_CHANNEL, {
      config: {
        presence: { key: `discover-webrtc-${Math.random().toString(36).slice(2, 6)}` },
        broadcast: { self: false },
      },
    });

    webrtcChannel.on('presence', { event: 'sync' }, updateRooms);
    webrtcChannel.on('presence', { event: 'join' }, updateRooms);
    webrtcChannel.on('presence', { event: 'leave' }, updateRooms);
    webrtcChannel.on('broadcast', { event: 'room-beacon' }, (payload) => {
      const p = payload.payload as { roomCode?: string; ts?: number };
      if (!p?.roomCode) return;
      // Keep beacons visible briefly as a fallback in case presence lags/drops.
      beaconRooms.set(p.roomCode, Date.now() + 15000);
      updateRooms();
    });

    lobbyChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') updateRooms();
    });
    webrtcChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') updateRooms();
    });

    const cleanup = window.setInterval(updateRooms, 2000);

    return () => {
      clearInterval(cleanup);
      supabase.removeChannel(lobbyChannel);
      supabase.removeChannel(webrtcChannel);
    };
  }, [mode]);
  return rooms;
}
