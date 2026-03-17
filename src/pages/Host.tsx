import { useState } from 'react';
import { useHostRoom, useAdvertiseRoom, type ConnectionMode } from '@/hooks/useGameRoom';
import LobbyArena from '@/components/LobbyArena';
import NetworkPerformancePanel from '@/components/NetworkPerformancePanel';
import { PLAYER_COLORS, MAX_PLAYERS } from '@/lib/playerColors';
import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function Host() {
  const [mode, setMode] = useState<ConnectionMode>('webrtc');
  const { roomCode, players, kickPlayer } = useHostRoom(mode);

  useAdvertiseRoom(roomCode, mode);

  const playerCount = players.size;

  return (
    <div className="flex flex-col h-screen p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-sm md:text-lg text-primary text-glow-green tracking-wider">
          LOBBY
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

          {/* Player role indicators */}
          {playerCount > 0 && (
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center gap-1">
                {Array.from(players.entries()).map(([connId, p]) => {
                  const color = PLAYER_COLORS[p.colorIndex] ?? PLAYER_COLORS[0];
                  return (
                    <Tooltip key={connId}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => kickPlayer(connId)}
                          className="group relative w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-125"
                          style={{
                            backgroundColor: `hsl(${color.hsl})`,
                            boxShadow: `0 0 8px hsl(${color.hsl} / 0.5)`,
                          }}
                        >
                          <X className="w-3 h-3 text-black/70 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={3} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs font-mono">
                        Kick {color.name}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* 3D Lobby */}
      <div className="flex-1 min-h-0 relative">
        <LobbyArena players={players} />
      </div>

      {/* Footer hint */}
      {playerCount === 0 && (
        <p className="text-center text-xs text-muted-foreground font-mono animate-pulse">
          Open <span className="text-secondary text-glow-purple">/client</span> on your phone and enter code{' '}
          <span className="text-accent">{roomCode}</span>
        </p>
      )}

      {/* Network Performance Panel */}
      <NetworkPerformancePanel players={players} />
    </div>
  );
}
