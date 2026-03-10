import { useState } from 'react';
import { useHostRoom, useAdvertiseRoom, type ConnectionMode } from '@/hooks/useGameRoom';
import GameArena from '@/components/GameArena';
import { PLAYER_COLORS, MAX_PLAYERS } from '@/lib/playerColors';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Host() {
  const [mode, setMode] = useState<ConnectionMode>('webrtc');
  const { roomCode, players } = useHostRoom(mode);

  useAdvertiseRoom(roomCode, mode);

  const playerCount = players.size;

  return (
    <div className="flex flex-col h-screen p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-sm md:text-lg text-primary text-glow-green tracking-wider">
          ARENA
        </h1>
        <div className="flex items-center gap-3 font-mono text-xs flex-wrap">
          {/* Mode dropdown */}
          <Select
            value={mode}
            onValueChange={(v) => setMode(v as ConnectionMode)}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs font-mono bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="webrtc" className="text-xs font-mono">
                <span className="text-primary">WebRTC</span>
              </SelectItem>
              <SelectItem value="supabase" className="text-xs font-mono">
                <span className="text-secondary">Supabase</span>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Room code */}
          <div className="px-3 py-1.5 rounded border border-border bg-card">
            ROOM: <span className="text-accent font-bold tracking-widest">{roomCode}</span>
          </div>

          {/* Player count */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
            {playerCount}/{MAX_PLAYERS} PLAYERS
            </span>
          </div>

          {/* Connected player color dots */}
          {playerCount > 0 && (
            <div className="flex items-center gap-1">
              {Array.from(players.values()).map((p, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: `hsl(${PLAYER_COLORS[p.colorIndex]?.hsl ?? PLAYER_COLORS[0].hsl})`,
                    boxShadow: `0 0 8px hsl(${PLAYER_COLORS[p.colorIndex]?.hsl ?? PLAYER_COLORS[0].hsl} / 0.5)`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Arena */}
      <div className="flex-1 min-h-0">
        <GameArena players={players} />
      </div>

      {/* Footer hint */}
      {playerCount === 0 && (
        <p className="text-center text-xs text-muted-foreground font-mono animate-pulse">
          Open <span className="text-secondary text-glow-purple">/client</span> on your phone and enter code{' '}
          <span className="text-accent">{roomCode}</span>
        </p>
      )}
    </div>
  );
}
