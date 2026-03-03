import { useSearchParams } from 'react-router-dom';
import { useHostRoom, useAdvertiseRoom, type ConnectionMode } from '@/hooks/useGameRoom';
import GameArena from '@/components/GameArena';

export default function Host() {
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') as ConnectionMode) || 'webrtc';
  const { roomCode, clientConnected, joystick } = useHostRoom(mode);

  useAdvertiseRoom(roomCode, mode);

  return (
    <div className="flex flex-col h-screen p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-sm md:text-lg text-primary text-glow-green tracking-wider">
          ARENA
        </h1>
        <div className="flex items-center gap-4 font-mono text-xs">
          <div className="px-2 py-1 rounded border border-border bg-card text-xs">
            {mode === 'webrtc' ? (
              <span className="text-primary">WebRTC</span>
            ) : (
              <span className="text-secondary">Supabase</span>
            )}
          </div>
          <div className="px-3 py-1.5 rounded border border-border bg-card">
            ROOM: <span className="text-accent font-bold tracking-widest">{roomCode}</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                clientConnected ? 'bg-primary glow-green' : 'bg-muted-foreground'
              }`}
            />
            <span className="text-muted-foreground">
              {clientConnected ? 'PLAYER CONNECTED' : 'WAITING...'}
            </span>
          </div>
        </div>
      </div>

      {/* Arena */}
      <div className="flex-1 min-h-0">
        <GameArena joystick={joystick} />
      </div>

      {/* Footer hint */}
      {!clientConnected && (
        <p className="text-center text-xs text-muted-foreground font-mono animate-pulse">
          Open <span className="text-secondary text-glow-purple">/client</span> on your phone and enter code{' '}
          <span className="text-accent">{roomCode}</span>
        </p>
      )}
    </div>
  );
}
