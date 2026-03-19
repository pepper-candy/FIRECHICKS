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
function EventOverlay({ event, players }: {event: GameEvent;players: Record<string, any>;}) {
  const now = Date.now();
  const aliveChicks = Object.values(players).filter((p: any) => !p.isEagle && p.alive);
  const chickTotal = aliveChicks.reduce((sum: number, p: any) => sum + (event.chickClicks[p.connId] ?? 0), 0);
  const eagleTotal = Object.values(players).filter((p: any) => p.isEagle && p.alive).
  reduce((sum: number, p: any) => sum + (event.eagleClicks[p.connId] ?? 0), 0);
  const timeLeft = Math.max(0, Math.ceil((event.endAt - now) / 1000));

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

        {event.phase === 'active' && event.type === 'mock-exam' && event.questionNum &&
        <>
            <h2 className="text-lg font-pixel text-accent">📝 MOCK EXAM — {timeLeft}s</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-mono text-muted-foreground mb-1">HOST (Layer 1)</p>
                <img src={`/PW/PW_Mock_${event.questionNum}_layer-1.png`} alt="Layer 1" className="w-full rounded border border-border" />
              </div>
              <div>
                <p className="text-xs font-mono text-muted-foreground mb-1">Players (Layer 2)</p>
                <div className="w-full h-full border border-border rounded bg-muted/20 flex items-center justify-center">
                  <span className="text-xs font-mono text-muted-foreground">On phones</span>
                </div>
              </div>
            </div>
            <p className="text-xs font-mono text-muted-foreground">Players check their phones for layer 2!</p>
          </>
        }

        {event.phase === 'active' && event.type === 'hitbox' &&
        <>
            <h2 className="text-lg font-pixel text-accent">👊 HITBOX BATTLE — {timeLeft}s</h2>
            <div className="flex justify-around">
              <div className="text-center">
                <div className="text-4xl font-pixel text-primary">{chickTotal}</div>
                <div className="text-xs font-mono text-muted-foreground">🐤 Chicks</div>
              </div>
              <div className="text-2xl text-muted-foreground">vs</div>
              <div className="text-center">
                <div className="text-4xl font-pixel text-destructive">{eagleTotal}</div>
                <div className="text-xs font-mono text-muted-foreground">🦅 Eagle</div>
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
  const [lobbyPropClaims, setLobbyPropClaims] = useState<Map<string, Set<'speed' | 'heal'>>>(new Map());
  const { roomCode, players, kickPlayer, kickAllPlayers, broadcast, onClientMessage } = useHostRoom(mode);

  useAdvertiseRoom(roomCode, mode);

  const {
    phase, snapshot, videoPlaying, assignments, startGame, handleClientMessage, onVideoComplete
  } = useGameLogic({ players, broadcast, gameMode });

  // Register client message handler — intercept lobby prop scans before game logic
  useEffect(() => {
    onClientMessage((connId, msg) => {
      if ((msg as any).type === 'scan-result') {
        const data = (msg as any).data as string;
        if (data === 'LOBBY-SPEED' || data === 'LOBBY-HEAL') {
          const propType: 'speed' | 'heal' = data === 'LOBBY-SPEED' ? 'speed' : 'heal';
          setLobbyPropClaims((prev) => {
            const next = new Map(prev);
            const existing = new Set(next.get(connId) ?? []);
            if (!existing.has(propType)) {
              existing.add(propType);
              next.set(connId, existing);
              // Use colorIndex so client can identify themselves before game-start
              const playerColorIndex = players.get(connId)?.colorIndex ?? -1;
              broadcast({ type: 'lobby-prop-granted', colorIndex: playerColorIndex, propType });
            }
            return next;
          });
          return; // don't pass lobby prop scans to game logic
        }
      }
      handleClientMessage(connId, msg);
    });
  }, [onClientMessage, handleClientMessage, broadcast]);

  useEffect(() => {preloadVideos();}, []);

  useEffect(() => {
    broadcast({ type: 'game-mode', gameMode });
  }, [gameMode, broadcast]);

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
            onClick={() => startGame(lobbyPropClaims)}
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
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 p-4 bg-background">
        <h1 className="text-2xl font-pixel text-primary text-glow-green tracking-widest animate-pulse">
          GET READY
        </h1>
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-mono text-muted-foreground">Roles are being revealed on each phone...</p>
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
          examState={snapshot.examState} />
        

        {/* Health display top-right */}
        <HealthDisplay players={snapshot.players} />

        {/* Stage progress bottom */}
        <StageProgressBar currentStage={snapshot.stage} stageLabel={snapshot.stageLabel} />

        {/* Game time */}
        <div className="absolute top-2 left-2 z-10 px-3 py-1 rounded bg-card/80 border border-border font-mono text-xs text-muted-foreground">
          ⏱ {Math.floor(snapshot.gameTime)}s
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
        <EventOverlay event={snapshot.activeEvent} players={snapshot.players} />
        }

        <VideoOverlay video={videoPlaying} onComplete={onVideoComplete} />
        <NetworkPerformancePanel players={players} />
      </div>);

  }

  // ─── GAME OVER / TRANSCRIPT ──────────────────────────────────────────────────
  if (phase === 'gameover' && snapshot) {
    const winner = snapshot.winner;
    const sorted = Object.values(snapshot.players).sort((a, b) => {
      const aWin = winner === 'eagle' && a.isEagle || winner === 'chicks' && !a.isEagle;
      const bWin = winner === 'eagle' && b.isEagle || winner === 'chicks' && !b.isEagle;
      if (aWin !== bWin) return aWin ? -1 : 1;
      return b.actionScore - a.actionScore;
    });
    const mvp = sorted[0];

    return (
      <div className="flex flex-col h-screen bg-background overflow-auto">
        {/* Win banner */}
        <div className="py-4 text-center border-b border-border">
          <h1 className="text-xl font-pixel text-accent text-glow-green mb-1">GAME OVER</h1>
          <p
            className="text-lg font-pixel"
            style={{ color: winner === 'eagle' ? 'hsl(0 80% 55%)' : winner === 'chicks' ? 'hsl(145 80% 50%)' : 'hsl(45 100% 55%)' }}>
            
            {winner === 'eagle' ? '🦅 Eagle Wins!' : winner === 'chicks' ? '🐤 Chicks Win!' : '🤝 Draw!'}
          </p>
        </div>

        {/* 3D Character stage */}
        <div className="h-[35vh] relative flex-shrink-0">
          <Canvas camera={{ position: [0, 3, sorted.length * 2.2 + 4], fov: 40 }}>
            <ambientLight intensity={0.8} />
            <directionalLight position={[5, 8, 5]} intensity={1.2} />
            {sorted.map((p, i) => {
              const isWin = winner === 'eagle' && p.isEagle || winner === 'chicks' && !p.isEagle;
              const spacing = 2.2;
              const x = (i - (sorted.length - 1) / 2) * spacing;
              return (
                <group key={p.connId} position={[x, 0, 0]}>
                  <DancingChar chickColor={p.chickColor} isWinner={isWin} delay={i * 0.4} />
                </group>);

            })}
          </Canvas>

          {mvp &&
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 rounded bg-accent/20 border border-accent">
              <Trophy className="w-4 h-4 text-accent" />
              <span className="text-xs font-pixel text-accent">
                MVP: {PLAYER_COLORS[mvp.colorIndex]?.name ?? '?'}
              </span>
            </div>
          }
        </div>

        {/* Transcript table */}
        <div className="flex-1 p-4 overflow-auto">
          <h2 className="text-center text-sm font-pixel text-foreground mb-4 tracking-widest">📋 TRANSCRIPT</h2>
          <div className="max-w-3xl mx-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="py-2 text-left pl-2">Player</th>
                  <th className="py-2 text-center">Grade</th>
                  <th className="py-2 text-center">Survival</th>
                  <th className="py-2 text-center">Damage</th>
                  <th className="py-2 text-center">Score</th>
                  <th className="py-2 text-center">Result</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => {
                  const color = PLAYER_COLORS[p.colorIndex];
                  const letter = gradeToLetter(p.health);
                  const gradeColor = getGradeColor(p.health);
                  const isWin = winner === 'eagle' && p.isEagle || winner === 'chicks' && !p.isEagle;

                  return (
                    <tr key={p.connId} className="border-b border-border/40 hover:bg-card/30">
                      <td className="py-2 pl-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: `hsl(${color?.hsl ?? '0 0% 50%'})` }} />
                          <span style={{ color: `hsl(${color?.hsl ?? '0 0% 50%'})` }}>{color?.name}</span>
                          {p.isEagle ? ' 🦅' : ' 🐤'}
                          {p.isStarStudent && <Star className="w-3 h-3 text-accent fill-accent ml-0.5" />}
                          {i === 0 && <Trophy className="w-3 h-3 text-accent ml-0.5" />}
                        </div>
                      </td>
                      <td className="py-2 text-center">
                        <span className="text-2xl font-bold" style={{ color: gradeColor }}>{letter}</span>
                        <span className="text-[9px] text-muted-foreground block">{p.health.toFixed(1)}</span>
                      </td>
                      <td className="py-2 text-center text-muted-foreground">
                        {Math.floor(p.survivalTime)}s
                      </td>
                      <td className="py-2 text-center text-muted-foreground">
                        {p.isEagle ? `+${p.damageDealt.toFixed(1)}` : `-${p.damageTaken.toFixed(1)}`}
                      </td>
                      <td className="py-2 text-center text-foreground font-bold">
                        {p.actionScore.toFixed(0)}
                      </td>
                      <td className="py-2 text-center">
                        {isWin ?
                        <span className="text-primary font-bold">WIN</span> :
                        <span className="text-destructive">LOSE</span>
                        }
                      </td>
                    </tr>);

                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>);

  }

  return (
    <div className="flex items-center justify-center h-screen text-muted-foreground font-mono">
      Loading...
    </div>);

}

const COUNTDOWN_DURATION_DISPLAY = 10;