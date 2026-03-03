import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export interface JoystickData {
  x: number; // -1 to 1
  y: number; // -1 to 1
}

export function useHostRoom() {
  const [roomCode, setRoomCode] = useState<string>('');
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

export function useClientRoom(roomCode: string) {
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const connect = useCallback(() => {
    if (!roomCode) return;
    const code = roomCode.toUpperCase();
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
