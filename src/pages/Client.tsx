import { useState, useCallback } from 'react';
import { useClientRoom, useDiscoverRooms, type ConnectionMode } from '@/hooks/useGameRoom';
import Thumbstick from '@/components/Thumbstick';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function Client() {
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<ConnectionMode>('webrtc');
  const { connected, connect, sendJoystick, disconnect } = useClientRoom(code, mode);
  const discoveredRooms = useDiscoverRooms(mode);

  const handleJoin = (roomCode?: string) => {
    const targetCode = roomCode || code;
    if (targetCode.length >= 4) {
      if (roomCode) setCode(roomCode);
      connect(roomCode);
    }
  };

  const handleMove = useCallback(
    (x: number, y: number) => {
      sendJoystick({ x, y });
    },
    [sendJoystick]
  );

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-8">
        <h1 className="text-lg text-secondary text-glow-purple tracking-wider text-center">
          JOIN GAME
        </h1>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            maxLength={6}
            className="text-center text-2xl tracking-[0.5em] font-pixel bg-card border-border h-14 uppercase"
          />
          <Button
            onClick={() => handleJoin()}
            disabled={code.length < 4}
            className="h-12 text-sm font-pixel bg-secondary hover:bg-secondary/80 text-secondary-foreground"
          >
            CONNECT
          </Button>

          {/* Mode Switch */}
          <div className="flex items-center justify-between px-2 py-3 rounded border border-border bg-card">
            <Label className="text-xs font-mono text-muted-foreground cursor-pointer">
              {mode === 'webrtc' ? (
                <span>
                  <span className="text-primary">WebRTC</span> — Same network
                </span>
              ) : (
                <span>
                  <span className="text-secondary">Supabase</span> — Remote play
                </span>
              )}
            </Label>
            <Switch
              checked={mode === 'supabase'}
              onCheckedChange={(checked) => setMode(checked ? 'supabase' : 'webrtc')}
            />
          </div>

          {/* Discovered rooms in WebRTC mode */}
          {mode === 'webrtc' && discoveredRooms.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-xs text-muted-foreground font-mono text-center">
                ACTIVE ROOMS
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {discoveredRooms.map((roomCode) => (
                  <Button
                    key={roomCode}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCode(roomCode);
                      handleJoin(roomCode);
                    }}
                    className="font-mono text-xs tracking-widest text-accent border-accent/30 hover:bg-accent/10"
                  >
                    {roomCode}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center font-mono">
          {mode === 'webrtc'
            ? 'Enter the room code or tap an active room above'
            : 'Enter the room code shown on the host screen'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-6 select-none">
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
        <div className="w-2 h-2 rounded-full bg-primary glow-green" />
        CONNECTED
        <span className="text-muted-foreground/50">
          ({mode === 'webrtc' ? 'WebRTC' : 'Supabase'})
        </span>
      </div>

      <Thumbstick onMove={handleMove} size={220} />

      <p className="text-xs text-muted-foreground font-mono mt-4">
        Drag to move your character
      </p>

      <Button
        variant="outline"
        size="sm"
        onClick={disconnect}
        className="mt-4 text-xs font-mono text-destructive border-destructive/30"
      >
        DISCONNECT
      </Button>
    </div>
  );
}
