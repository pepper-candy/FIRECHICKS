import { useState, useEffect, useCallback } from 'react';
import { useHostRoom, useAdvertiseRoom, type ConnectionMode } from '@/hooks/useGameRoom';
import { useGameLogic } from '@/hooks/useGameLogic';
import LobbyArena from '@/components/LobbyArena';
import GameplayMap from '@/components/GameplayMap';
import HealthDisplay from '@/components/HealthDisplay';
import StageProgressBar from '@/components/StageProgressBar';
import VideoOverlay, { preloadVideos } from '@/components/VideoOverlay';
import NetworkPerformancePanel from '@/components/NetworkPerformancePanel';
import { PLAYER_COLORS, MAX_PLAYERS_1V3, MAX_PLAYERS_2V6 } from '@/lib/playerColors';
import { X, Zap, Flame } from 'lucide-react';
import type { GameMode } from '@/lib/gameTypes';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

export default function Host() {
  const [mode, setMode] = useState<ConnectionMode>('webrtc');
  const [gameMode, setGameMode] = useState<GameMode>('1v3');
  const { roomCode, players, kickPlayer, broadcast, onClientMessage } = useHostRoom(mode);

  useAdvertiseRoom(roomCode, mode);

  const {
    phase, snapshot, videoPlaying, assignments, startGame, handleClientMessage, onVideoComplete,
  } = useGameLogic({ players, broadcast, gameMode });

  // Register client message handler
  useEffect(() => {
    onClientMessage((connId, msg) => {
      handleClientMessage(connId, msg);
    });
  }, [onClientMessage, handleClientMessage]);

  // Preload videos
  useEffect(() => { preloadVideos(); }, []);

  // Broadcast game mode to clients
  useEffect(() => {
    broadcast({ type: 'game-mode', gameMode });
  }, [gameMode, broadcast]);

  const playerCount = players.size;
  const maxPlayers = gameMode === '1v3' ? MAX_PLAYERS_1V3 : MAX_PLAYERS_2V6;
  const canStart = playerCount >= 2; // min 2 for testing

  // ─── LOBBY PHASE ─────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="flex flex-col h-screen p-4 gap-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-sm md:text-lg text-primary text-glow-green tracking-wider">LOBBY</h1>

          <div className="flex items-center gap-3 font-mono text-xs flex-wrap">
            {/* Game mode torch */}
            <button
              onClick={() => setGameMode((prev) => (prev === '1v3' ? '2v6' : '1v3'))}
              className={`relative flex items-center gap-2 px-4 py-2 rounded border-2 font-pixel text-sm tracking-wider transition-all ${
                gameMode === '2v6'
                  ? 'border-accent bg-accent/10 text-accent hover:bg-accent/20 shadow-[0_0_20px_hsl(var(--accent)/0.3)]'
                  : 'border-primary bg-primary/10 text-primary hover:bg-primary/20 shadow-[0_0_20px_hsl(var(--primary)/0.3)]'
              }`}
            >
              <Flame className={`w-4 h-4 ${gameMode === '2v6' ? 'animate-pulse' : ''}`} />
              {gameMode}
            </button>

            {/* Start button */}
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
            <span className="text-muted-foreground">{playerCount}/{maxPlayers} PLAYERS</span>

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
  // Host shows an 8-second countdown (5s reveal + 3s countdown) without revealing who is which color
  if (phase === 'reveal' || phase === 'countdown') {
    const totalSeconds = phase === 'reveal'
      ? (snapshot ? Math.ceil(snapshot.countdownTime) + 3 : 8)  // during reveal, show ~8 going down
      : (snapshot ? Math.ceil(snapshot.countdownTime) : 3);

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 p-4">
        <h1 className="text-xl font-pixel text-primary text-glow-green">
          GET READY
        </h1>
        <div className="text-8xl font-pixel text-accent animate-pulse">
          {phase === 'reveal' ? '...' : Math.ceil(snapshot?.countdownTime ?? 3)}
        </div>
        <p className="text-sm font-mono text-muted-foreground">
          {phase === 'reveal' ? 'Assigning roles...' : 'Game starting soon!'}
        </p>
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
