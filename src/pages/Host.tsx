import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { GameEvent } from '@/lib/gameTypes';
import { useHostRoom, useAdvertiseRoom, type ConnectionMode } from '@/hooks/useGameRoom';
import { useGameLogic } from '@/hooks/useGameLogic';
import LobbyArena from '@/components/LobbyArena';
import GameplayMap from '@/components/GameplayMap';
import HealthDisplay from '@/components/HealthDisplay';
import StageProgressBar from '@/components/StageProgressBar';
import VideoOverlay, { preloadVideos } from '@/components/VideoOverlay';
import NetworkPerformancePanel from '@/components/NetworkPerformancePanel';
import { PLAYER_COLORS, MAX_PLAYERS_1V3, MAX_PLAYERS_2V6 } from '@/lib/playerColors';
import { gradeToLetter, getGradeColor } from '@/lib/gradeSystem';
import { X, Flame, Zap, Trophy, Star } from 'lucide-react';
import type { GameMode } from '@/lib/gameTypes';
import CharacterViewer from '@/components/CharacterViewer';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from
'@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from
'@/components/ui/tooltip';
import type { PlayerGameStateSerializable } from '@/lib/gameTypes';

// ─── Event Overlay (shows during mystery box events) ─────────────────────────
function EventOverlay({ event, players, gameMode }: {event: GameEvent;players: Record<string, any>; gameMode?: string;}) {
  const now = Date.now();
  const aliveChicks = Object.values(players).filter((p: any) => !p.isEagle && p.alive);
  const chickTotal = aliveChicks.reduce((sum: number, p: any) => sum + (event.chickClicks[p.connId] ?? 0), 0);
  const eagleTotal = Object.values(players).filter((p: any) => p.isEagle && p.alive).
  reduce((sum: number, p: any) => sum + (event.eagleClicks[p.connId] ?? 0), 0);
  const timeLeft = Math.max(0, Math.ceil((event.endAt - now) / 1000));

  // Mock exam active: show layer 1 full-screen centered with white bg
  if (event.phase === 'active' && event.type === 'mock-exam' && event.questionNum) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4 max-w-2xl w-full px-6">
          <div className="flex items-center justify-between w-full">
            <h2 className="text-lg font-pixel text-gray-800">📝 MOCK EXAM</h2>
            <span className="font-mono text-lg font-bold text-gray-800">{timeLeft}s</span>
          </div>
          <div className="w-full border-2 border-gray-300 rounded-xl overflow-hidden bg-white shadow-lg">
            <img src={`/PW/PW_Mock_${event.questionNum}_layer-1.png`} alt="Layer 1" className="w-full" />
          </div>
          <p className="text-xs font-mono text-gray-500">Players check their phones for layer 2!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border-2 border-accent rounded-xl p-6 max-w-lg w-full mx-4 text-center space-y-4">
        {event.phase === 'countdown' &&
        <>
            <h2 className="text-2xl font-pixel text-accent">
              {event.type === 'mock-exam' ? '📝 MOCK EXAM' : '👊 HITBOX CHALLENGE'}
            </h2>
            <div className="text-6xl font-pixel text-primary animate-pulse">
              {Math.max(1, 3 - Math.floor((now - event.startedAt) / 1000))}
            </div>
            <p className="text-sm font-mono text-muted-foreground">Get ready!</p>
          </>
        }

        {event.phase === 'active' && event.type === 'hitbox' &&
        <>
            <h2 className="text-lg font-pixel text-accent">👊 HITBOX BATTLE — {timeLeft}s</h2>
            <div className="flex justify-around">
              <div className="text-center">
                <div className="text-4xl font-pixel text-primary">{chickTotal}</div>
                <div className="text-xs font-mono text-muted-foreground">🐤 Chicks (avg: {aliveChicks.length > 0 ? (chickTotal / aliveChicks.length).toFixed(1) : 0})</div>
              </div>
              <div className="text-2xl text-muted-foreground">vs</div>
              <div className="text-center">
                <div className="text-4xl font-pixel text-destructive">{eagleTotal}</div>
                <div className="text-xs font-mono text-muted-foreground">🦅 Eagle{gameMode === '2v6' ? 's' : ''}</div>
              </div>
            </div>
            <p className="text-xs font-mono text-muted-foreground">TAP HITBOX AS FAST AS POSSIBLE!</p>
          </>
        }

        {event.phase === 'result' &&
        <>
            <h2 className="text-xl font-pixel text-accent">RESULT</h2>
            <p className="text-2xl font-pixel" style={{ color: event.result === 'chick' ? 'hsl(145 80% 50%)' : 'hsl(0 80% 55%)' }}>
              {event.result === 'chick' ? '🐤 Chicks Win!' : '🦅 Eagle Wins!'}
            </p>
            <p className="text-xs font-mono text-muted-foreground">
              {event.result === 'chick' ? '+2 grades for everyone!' : '-2 grades for chicks'}
            </p>
          </>
        }
      </div>
    </div>);

}

// ─── Transcript 3D Character ──────────────────────────────────────────────────
function DancingChar({ chickColor, isWinner, delay }: {chickColor: string;isWinner: boolean;delay: number;}) {
  const angleRef = useRef(delay);
  useFrame((_, d) => {angleRef.current += d * (isWinner ? 1.5 : 0.4);});
  return (
    <Suspense fallback={null}>
      <CharacterViewer color={chickColor as any} animState={isWinner ? 'Victory' : 'Idle'} facingAngle={angleRef.current} />
    </Suspense>);

}

// ─── Host Component ──────────────────────────────────────────────────────────
export default function Host() {
  const [mode, setMode] = useState<ConnectionMode>('webrtc');
  const [gameMode, setGameMode] = useState<GameMode>('1v3');
  const [startClickAt, setStartClickAt] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [revealNow, setRevealNow] = useState(Date.now());
  const { roomCode, players, kickPlayer, kickAllPlayers, broadcast, onClientMessage } = useHostRoom(mode);

  useAdvertiseRoom(roomCode, mode);

  const {
    phase,
    snapshot,
    videoPlaying,
    assignments,
    startGame,
    handleClientMessage,
    onVideoComplete,
    hostDragBegin,
    hostDragUpdate,
    hostDragEnd,
  } = useGameLogic({ players, broadcast, gameMode });

  // Register client message handler
  useEffect(() => {
    onClientMessage((connId, msg) => {
      handleClientMessage(connId, msg);
    });
  }, [onClientMessage, handleClientMessage]);

  useEffect(() => {preloadVideos();}, []);

  useEffect(() => {
    broadcast({ type: 'game-mode', gameMode });
  }, [gameMode, broadcast]);
  useEffect(() => {
    if (phase !== 'reveal') return;
    const id = setInterval(() => setRevealNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [phase]);

  const handleGameModeToggle = useCallback(() => {
    const newMode: GameMode = gameMode === '1v3' ? '2v6' : '1v3';
    kickAllPlayers();
    setGameMode(newMode);
  }, [gameMode, kickAllPlayers]);

  const handleConnectionModeChange = useCallback((v: string) => {
    kickAllPlayers();
    setMode(v as ConnectionMode);
  }, [kickAllPlayers]);

  const playerCount = players.size;
  const maxPlayers = gameMode === '1v3' ? MAX_PLAYERS_1V3 : MAX_PLAYERS_2V6;
  const isFull = playerCount === maxPlayers;

  // ─── LOBBY ────────────────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="flex flex-col h-screen p-3 gap-3">
        {/* Cyber START button — top center absolute */}
        {isFull &&
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
            <button
            onClick={() => {
              setStartClickAt(Date.now());
              startGame();
            }}
            className="relative px-10 py-3 font-pixel text-base tracking-[0.3em] uppercase
                text-primary border-2 border-primary bg-primary/10
                hover:bg-primary/25 transition-all duration-200
                shadow-[0_0_25px_hsl(var(--primary)/0.5),inset_0_0_20px_hsl(var(--primary)/0.1)]
                hover:shadow-[0_0_40px_hsl(var(--primary)/0.7),inset_0_0_30px_hsl(var(--primary)/0.2)]
                before:absolute before:inset-0 before:border before:border-primary/40 before:animate-pulse
                after:absolute after:inset-[-3px] after:border after:border-primary/20">
            
              <Zap className="inline w-5 h-5 mr-2 -mt-0.5 text-primary" />
              ▶ START GAME
            </button>
          </div>
        }

        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-2 z-10">
          <h1 className="text-sm md:text-base text-primary text-glow-green tracking-wider font-pixel">
             LOBBY
          </h1>

          <div className="flex items-center gap-2 font-mono text-xs flex-wrap">
            {/* Game mode toggle (only when not full) */}
            {!isFull &&
            <button
              onClick={handleGameModeToggle}
              className={`flex items-center gap-1 px-3 py-1.5 rounded border font-pixel text-xs transition-all ${
              gameMode === '2v6' ?
              'border-accent bg-accent/10 text-accent hover:bg-accent/20' :
              'border-primary bg-primary/10 text-primary hover:bg-primary/20'}`
              }>
              
                <Flame className={`w-3 h-3 ${gameMode === '2v6' ? 'animate-pulse' : ''}`} />
                {gameMode}
              </button>
            }

            {/* Connection mode */}
            <Select value={mode} onValueChange={handleConnectionModeChange}>
              <SelectTrigger className="h-7 w-[120px] text-xs font-mono bg-card border-border">
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
            <div className="px-2 py-1 rounded border border-border bg-card text-xs">
              ROOM: <span className="text-accent font-bold tracking-widest">{roomCode}</span>
            </div>

            <span className="text-muted-foreground">{playerCount}/{maxPlayers}</span>

            {/* Player color dots with kick */}
            {playerCount > 0 &&
            <TooltipProvider delayDuration={200}>
                <div className="flex items-center gap-1">
                  {Array.from(players.entries()).map(([connId, p]) => {
                  const color = PLAYER_COLORS[p.colorIndex] ?? PLAYER_COLORS[0];
                  return (
                    <Tooltip key={connId}>
                        <TooltipTrigger asChild>
                          <button
                          onClick={() => kickPlayer(connId)}
                          className="group relative w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-125"
                          style={{ backgroundColor: `hsl(${color.hsl})`, boxShadow: `0 0 6px hsl(${color.hsl} / 0.5)` }}>
                          
                            <X className="w-3 h-3 text-black/70 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={3} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs font-mono">Kick {color.name}</TooltipContent>
                      </Tooltip>);

                })}
                </div>
              </TooltipProvider>
            }
          </div>
        </div>

        {/* 3D Lobby */}
        <div className="flex-1 min-h-0 relative">
          <LobbyArena players={players} />
        </div>

        {/* Instructions */}
        <div className="text-center space-y-1">
          {playerCount === 0 ?
          <p className="text-xs text-muted-foreground font-mono animate-pulse">
              Open <span className="text-secondary">/client</span> on phones · Room:{' '}
              <span className="text-accent font-bold">{roomCode}</span>
            </p> :
          !isFull ?
          <p className="text-xs text-muted-foreground font-mono">
              Waiting for {maxPlayers - playerCount} more player{maxPlayers - playerCount !== 1 ? 's' : ''}...
            </p> :

          <p className="text-xs text-primary font-mono animate-pulse">
              All players ready! Press START GAME ↑
            </p>
          }
        </div>

        <NetworkPerformancePanel players={players} />
      </div>);

  }

  // ─── REVEAL ──────────────────────────────────────────────────────────────────
  if (phase === 'reveal') {
    const revealCountdown = startClickAt ? Math.max(0, 8 - (revealNow - startClickAt) / 1000) : 8;
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 p-4 bg-background">
        <h1 className="text-2xl font-pixel text-primary text-glow-green tracking-widest animate-pulse">
          GET READY
        </h1>
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-mono text-muted-foreground">Roles are being revealed on each phone...</p>
          <div className="text-6xl font-pixel text-accent animate-pulse">{Math.ceil(revealCountdown)}</div>
          <div className="flex gap-1.5 mt-2">
            {[...Array(3)].map((_, i) =>
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }} />

            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-2 opacity-60">
            {Object.keys(assignments).length} player{Object.keys(assignments).length !== 1 ? 's' : ''} assigned
          </p>
        </div>
      </div>);

  }

  // ─── COUNTDOWN ───────────────────────────────────────────────────────────────
  if (phase === 'countdown') {
    const count = snapshot?.countdownTime ?? COUNTDOWN_DURATION_DISPLAY;
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-4">
        <h1 className="text-xl font-pixel text-primary text-glow-green">GET READY</h1>
        <div
          className="text-8xl font-pixel text-accent animate-pulse"
          style={{ textShadow: '0 0 30px hsl(var(--accent) / 0.8)' }}>
          
          {Math.ceil(count)}
        </div>
        <p className="text-sm font-mono text-muted-foreground">Game starting soon!</p>
      </div>);

  }

  // ─── PLAYING / EXAM ──────────────────────────────────────────────────────────
  if ((phase === 'playing' || phase === 'exam') && snapshot) {
    return (
      <div className="relative h-screen">
        <GameplayMap
          players={snapshot.players}
          buildings={snapshot.buildings}
          eagleAwake={snapshot.eagleAwake}
          propSpawns={snapshot.propSpawns}
          mysteryBoxes={snapshot.mysteryBoxes}
          examState={snapshot.examState}
          zoomLevel={zoomLevel}
          enableHostDrag={phase === 'playing'}
          onHostDragBegin={hostDragBegin}
          onHostDragUpdate={hostDragUpdate}
          onHostDragEnd={hostDragEnd}
        />

        {/* Tip obtain countdowns — stacked in flex column to avoid overlap */}
        {snapshot.tipObtainTimers && Object.keys(snapshot.tipObtainTimers).length > 0 && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex flex-col gap-1 items-center">
            {Object.entries(snapshot.tipObtainTimers).map(([connId, timer]) => {
              const player = snapshot.players[connId];
              if (!player) return null;
              const color = PLAYER_COLORS[player.colorIndex];
              const sec = Math.ceil(timer.remainingMs / 1000);
              if (sec <= 0) return null;
              return (
                <div key={connId} className="px-3 py-1 rounded bg-accent/20 border border-accent font-mono text-xs text-accent whitespace-nowrap">
                  📖 {color?.name ?? '?'} obtaining tips... {sec}s
                </div>
              );
            })}
          </div>
        )}

        {/* Health display top-right */}
        <HealthDisplay players={snapshot.players} />

        {/* Stage progress bottom */}
        <StageProgressBar currentStage={snapshot.stage} stageLabel={snapshot.stageLabel} />

        {/* Game time */}
        <div className="absolute top-2 left-2 z-10 px-3 py-1 rounded bg-card/80 border border-border font-mono text-xs text-muted-foreground">
          ⏱ {Math.floor(snapshot.gameTime)}s
        </div>
        <div className="absolute top-12 left-2 z-10 px-2 py-2 rounded bg-card/85 border border-border w-44">
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
            <span>Zoom</span>
            <span>{zoomLevel.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.65}
            max={1.5}
            step={0.05}
            value={zoomLevel}
            onChange={(e) => setZoomLevel(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Eagle awake countdown */}
        {!snapshot.eagleAwake &&
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded bg-destructive/20 border border-destructive/50 font-mono text-xs text-destructive animate-pulse">
            🦅 Eagle awakens in {Math.max(0, Math.ceil(5 - snapshot.gameTime))}s
          </div>
        }

        {/* Exam layer 1 on screen when holder is dead */}
        {snapshot.examState?.layer1Dead &&
        <div className="absolute top-1/2 left-2 -translate-y-1/2 z-20 bg-card/95 border-2 border-accent rounded-lg p-3 max-w-[200px]">
            <p className="text-[9px] font-mono text-accent mb-1">📜 EXAM LAYER 1</p>
            <img
            src={`/PW/PW_Final_${snapshot.examState.questionNum}_layer-1.png`}
            alt="Layer 1"
            className="w-full rounded" />
          
          </div>
        }

        {/* Active event overlay */}
        {snapshot.activeEvent &&
        <EventOverlay event={snapshot.activeEvent} players={snapshot.players} gameMode={gameMode} />
        }

        <NetworkPerformancePanel players={players} />

        {/* VideoOverlay LAST so it renders on top of everything */}
        <VideoOverlay video={videoPlaying} onComplete={onVideoComplete} />
      </div>);

  }

  // ─── GAME OVER / TRANSCRIPT ──────────────────────────────────────────────────
  if (phase === 'gameover' && snapshot) {
    return <GameOverCeremony snapshot={snapshot} gameMode={gameMode} />;
  }
          </div>
        </div>
      </div>);

  }

  return (
    <div className="flex items-center justify-center h-screen text-muted-foreground font-mono">
      Loading...
    </div>);

}

const COUNTDOWN_DURATION_DISPLAY = 3;