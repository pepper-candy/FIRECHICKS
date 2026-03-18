import { useState, useEffect, useCallback } from 'react';
import { useHostRoom, useAdvertiseRoom, type ConnectionMode } from '@/hooks/useGameRoom';
import { useGameLogic } from '@/hooks/useGameLogic';
import LobbyArena from '@/components/LobbyArena';
import GameplayMap from '@/components/GameplayMap';
import HealthDisplay from '@/components/HealthDisplay';
import StageProgressBar from '@/components/StageProgressBar';
import VideoOverlay, { preloadVideos } from '@/components/VideoOverlay';
import NetworkPerformancePanel from '@/components/NetworkPerformancePanel';
import { PLAYER_COLORS, MAX_PLAYERS_1V3 } from '@/lib/playerColors';
import { X, Zap } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

export default function Host() {
  const [mode, setMode] = useState<ConnectionMode>('webrtc');
  const { roomCode, players, kickPlayer, broadcast, onClientMessage } = useHostRoom(mode);

  useAdvertiseRoom(roomCode, mode);

  const {
    phase, snapshot, videoPlaying, assignments, startGame, handleClientMessage, onVideoComplete,
  } = useGameLogic({ players, broadcast, gameMode: '1v3' });

  // Register client message handler
  useEffect(() => {
    onClientMessage((connId, msg) => {
      handleClientMessage(connId, msg);
    });
  }, [onClientMessage, handleClientMessage]);

  // Preload videos
  useEffect(() => { preloadVideos(); }, []);

  const playerCount = players.size;
  const canStart = playerCount >= 2; // min 2 for testing, ideally MAX_PLAYERS_1V3

  // ─── LOBBY PHASE ─────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="flex flex-col h-screen p-4 gap-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-sm md:text-lg text-primary text-glow-green tracking-wider">LOBBY</h1>

          <div className="flex items-center gap-3 font-mono text-xs flex-wrap">
            {/* Start button - top center, cyber style */}
            {canStart && (
              <button
                onClick={startGame}
                className="relative px-6 py-2 rounded border-2 border-primary bg-primary/10 text-primary font-pixel text-sm tracking-widest
                  hover:bg-primary/20 hover:shadow-[0_0_30px_hsl(var(--primary)/0.4)] transition-all
                  before:absolute before:inset-0 before:rounded before:border before:border-primary/30 before:animate-pulse"
              >
                <Zap className="inline w-4 h-4 mr-1 -mt-0.5" />
                START GAME
              </button>
            )}

            {/* Mode dropdown */}
            <Select value={mode} onValueChange={(v) => setMode(v as ConnectionMode)}>
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
            <span className="text-muted-foreground">{playerCount}/{MAX_PLAYERS_1V3} PLAYERS</span>

            {/* Player dots */}
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
                        <TooltipContent side="bottom" className="text-xs font-mono">Kick {color.name}</TooltipContent>
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

        {playerCount === 0 && (
          <p className="text-center text-xs text-muted-foreground font-mono animate-pulse">
            Open <span className="text-secondary text-glow-purple">/client</span> on your phone and enter code{' '}
            <span className="text-accent">{roomCode}</span>
          </p>
        )}

        <NetworkPerformancePanel players={players} />
      </div>
    );
  }

  // ─── REVEAL / COUNTDOWN PHASE ─────────────────────
  if (phase === 'reveal' || phase === 'countdown') {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 p-4">
        <h1 className="text-xl font-pixel text-primary text-glow-green">
          {phase === 'reveal' ? 'ROLE ASSIGNMENT' : 'GET READY'}
        </h1>
        {phase === 'countdown' && snapshot && (
          <div className="text-6xl font-pixel text-accent animate-pulse">
            {Math.ceil(snapshot.countdownTime)}
          </div>
        )}
        <div className="flex flex-wrap gap-4 justify-center">
          {Object.entries(assignments).map(([connId, assign]) => {
            const color = PLAYER_COLORS[assign.colorIndex];
            return (
              <div key={connId} className="flex flex-col items-center gap-2 p-3 rounded border border-border bg-card">
                <div
                  className="w-8 h-8 rounded-full"
                  style={{
                    backgroundColor: `hsl(${color?.hsl ?? '0 0% 50%'})`,
                    boxShadow: `0 0 12px hsl(${color?.hsl ?? '0 0% 50%'} / 0.5)`,
                  }}
                />
                <span className="text-xs font-mono" style={{ color: `hsl(${color?.hsl ?? '0 0% 50%'})` }}>
                  {color?.name} {assign.isEagle ? '🦅' : '🐤'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── GAMEPLAY PHASE ───────────────────────────────
  if ((phase === 'playing' || phase === 'exam') && snapshot) {
    return (
      <div className="relative h-screen">
        <GameplayMap
          players={snapshot.players}
          buildings={snapshot.buildings}
          eagleAwake={snapshot.eagleAwake}
        />
        <HealthDisplay players={snapshot.players} />
        <StageProgressBar currentStage={snapshot.stage} stageLabel={snapshot.stageLabel} />

        {/* Game time */}
        <div className="absolute top-2 left-2 z-10 px-3 py-1 rounded bg-card/80 border border-border font-mono text-xs text-muted-foreground">
          ⏱ {Math.floor(snapshot.gameTime)}s
        </div>

        {/* Eagle status */}
        {!snapshot.eagleAwake && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded bg-destructive/20 border border-destructive/50 font-mono text-xs text-destructive animate-pulse">
            🦅 Eagle awakens in {Math.max(0, Math.ceil(5 - snapshot.gameTime))}s
          </div>
        )}

        <VideoOverlay video={videoPlaying} onComplete={onVideoComplete} />
        <NetworkPerformancePanel players={players} />
      </div>
    );
  }

  // ─── GAME OVER ────────────────────────────────────
  if (phase === 'gameover' && snapshot) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 p-4">
        <h1 className="text-2xl font-pixel text-accent text-glow-green">GAME OVER</h1>
        <p className="text-lg font-pixel" style={{ color: snapshot.winner === 'eagle' ? 'hsl(0 80% 55%)' : 'hsl(145 80% 50%)' }}>
          {snapshot.winner === 'eagle' ? '🦅 Eagle Wins!' : '🐤 Chicks Win!'}
        </p>
        <HealthDisplay players={snapshot.players} />
      </div>
    );
  }

  return <div className="flex items-center justify-center h-screen text-muted-foreground font-mono">Loading...</div>;
}
