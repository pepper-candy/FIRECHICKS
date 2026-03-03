import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type ConnectionMode = 'webrtc' | 'supabase';

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const PEER_PREFIX = 'evsc-';
const JOYSTICK_SEND_INTERVAL = 33; // ~30Hz continuous send for WebRTC

export interface JoystickData {
  x: number; // -1 to 1
  y: number; // -1 to 1
}

// ─── HOST: WebRTC ───────────────────────────────────────────
function useHostWebRTC() {
  const [roomCode, setRoomCode] = useState('');
  const [clientConnected, setClientConnected] = useState(false);
  const [joystick, setJoystick] = useState<JoystickData>({ x: 0, y: 0 });
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  useEffect(() => {
    const code = generateRoomCode();
    setRoomCode(code);

    const peer = new Peer(`${PEER_PREFIX}${code}`);
    peerRef.current = peer;

    peer.on('connection', (conn) => {
      connRef.current = conn;
      conn.on('open', () => setClientConnected(true));
      conn.on('data', (data) => setJoystick(data as JoystickData));
      conn.on('close', () => {
        setClientConnected(false);
        setJoystick({ x: 0, y: 0 });
        connRef.current = null;
      });
    });

    return () => {
      connRef.current?.close();
      peer.destroy();
    };
  }, []);

  return { roomCode, clientConnected, joystick };
}

// ─── HOST: Supabase ─────────────────────────────────────────
function useHostSupabase() {
  const [roomCode, setRoomCode] = useState('');
  const [clientConnected, setClientConnected] = useState(false);
  const [joystick, setJoystick] = useState<JoystickData>({ x: 0, y: 0 });
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const code = generateRoomCode();
    setRoomCode(code);

    const channel = supabase.channel(`game-room-${code}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'joystick' }, (payload) => {
        setJoystick(payload.payload as JoystickData);
      })
      .on('broadcast', { event: 'client-join' }, () => {
        setClientConnected(true);
      })
      .on('broadcast', { event: 'client-leave' }, () => {
        setClientConnected(false);
        setJoystick({ x: 0, y: 0 });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return { roomCode, clientConnected, joystick };
}

// ─── CLIENT: WebRTC ─────────────────────────────────────────
function useClientWebRTC(roomCode: string) {
  const [connected, setConnected] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const joystickRef = useRef<JoystickData>({ x: 0, y: 0 });
  const intervalRef = useRef<number | null>(null);

  const connect = useCallback((overrideCode?: string) => {
    const targetCode = overrideCode || roomCode;
    if (!targetCode) return;
    const code = targetCode.toUpperCase();

    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', () => {
      const conn = peer.connect(`${PEER_PREFIX}${code}`, { reliable: false });
      connRef.current = conn;
      conn.on('open', () => {
        setConnected(true);
        // Start continuous send loop
        intervalRef.current = window.setInterval(() => {
          conn.send(joystickRef.current);
        }, JOYSTICK_SEND_INTERVAL);
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
    connRef.current?.send(data);
  }, []);

  const disconnect = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    connRef.current?.close();
    connRef.current = null;
    peerRef.current?.destroy();
    peerRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      connRef.current?.close();
      peerRef.current?.destroy();
    };
  }, []);

  return { connected, connect, sendJoystick, disconnect };
}

// ─── CLIENT: Supabase ───────────────────────────────────────
function useClientSupabase(roomCode: string) {
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const connect = useCallback((overrideCode?: string) => {
    const targetCode = overrideCode || roomCode;
    if (!targetCode) return;
    const code = targetCode.toUpperCase();
    const channel = supabase.channel(`game-room-${code}`, {
      config: { broadcast: { self: false } },
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true);
        channel.send({ type: 'broadcast', event: 'client-join', payload: {} });
      }
    });

    channelRef.current = channel;
  }, [roomCode]);

  const sendJoystick = useCallback((data: JoystickData) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'joystick',
      payload: data,
    });
  }, []);

  const disconnect = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'client-leave', payload: {} });
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);

  return { connected, connect, sendJoystick, disconnect };
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
// Uses Supabase presence to advertise active WebRTC rooms
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
