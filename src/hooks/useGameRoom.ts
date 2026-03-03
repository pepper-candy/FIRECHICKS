import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const PEER_PREFIX = 'evsc-';

export interface JoystickData {
  x: number; // -1 to 1
  y: number; // -1 to 1
}

export function useHostRoom() {
  const [roomCode, setRoomCode] = useState<string>('');
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

export function useClientRoom(roomCode: string) {
  const [connected, setConnected] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  const connect = useCallback(() => {
    if (!roomCode) return;
    const code = roomCode.toUpperCase();

    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', () => {
      const conn = peer.connect(`${PEER_PREFIX}${code}`, { reliable: false });
      connRef.current = conn;
      conn.on('open', () => setConnected(true));
      conn.on('close', () => setConnected(false));
    });
  }, [roomCode]);

  const sendJoystick = useCallback((data: JoystickData) => {
    connRef.current?.send(data);
  }, []);

  const disconnect = useCallback(() => {
    connRef.current?.close();
    connRef.current = null;
    peerRef.current?.destroy();
    peerRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    return () => {
      connRef.current?.close();
      peerRef.current?.destroy();
    };
  }, []);

  return { connected, connect, sendJoystick, disconnect };
}
