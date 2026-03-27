import { useState, useEffect, useCallback, Suspense, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { GameEvent, GameStateSnapshot } from "@/lib/gameTypes";
import { useHostRoom, useAdvertiseRoom, type ConnectionMode } from "@/hooks/useGameRoom";
import { useGameLogic } from "@/hooks/useGameLogic";
import LobbyArena from "@/components/LobbyArena";
import GameplayMap from "@/components/GameplayMap";
import HealthDisplay from "@/components/HealthDisplay";
import StageProgressBar from "@/components/StageProgressBar";
import VideoOverlay, { preloadVideos } from "@/components/VideoOverlay";
import StageTransition from "@/components/StageTransition";
import NetworkPerformancePanel from "@/components/NetworkPerformancePanel";
import CrossyRoadHost from "@/components/events/CrossyRoadHost";
import { PLAYER_COLORS, MAX_PLAYERS_1V3, MAX_PLAYERS_2V6 } from "@/lib/playerColors";
import { gradeToLetter, getGradeColor } from "@/lib/gradeSystem";
import { X, Flame, Zap, Trophy, Star, ChevronDown, Palette } from "lucide-react";
import type { GameMode } from "@/lib/gameTypes";
import CharacterViewer from "@/components/CharacterViewer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { MapId } from "@/lib/mapVariants";
import { MAP_LIST } from "@/lib/mapVariants";
import type { PlayerGameStateSerializable } from "@/lib/gameTypes";
import { assetUrl } from "@/lib/assets";
import { Bounds } from "@react-three/drei";
import { useImmersive } from "@/context/ImmersiveContext";

// ─── Event Overlay (shows during mystery box events) ─────────────────────────
function EventOverlay({
  event,
  players,
  gameMode,
}: {
  event: GameEvent;
  players: Record<string, any>;
  gameMode?: string;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  const aliveChicks = Object.values(players).filter((p: any) => !p.isEagle && p.alive);
  const chickTotal = aliveChicks.reduce((sum: number, p: any) => sum + (event.chickClicks[p.connId] ?? 0), 0);
  const eagleTotal = Object.values(players)
    .filter((p: any) => p.isEagle && p.alive)
    .reduce((sum: number, p: any) => sum + (event.eagleClicks[p.connId] ?? 0), 0);
  const timeLeft = Math.max(0, Math.ceil((event.endAt - now) / 1000));

  // Mock exam active: show layer 1 full-screen centered with white bg — via portal
  if (event.phase === "active" && event.type === "mock-exam" && event.questionNum) {
    return createPortal(
      <div className="fixed inset-0 flex items-center justify-center bg-white" style={{ zIndex: 9998 }}>
        <div className="flex flex-col items-center gap-4 max-w-2xl w-full px-6">
          <div className="flex items-center justify-between w-full">
            <h2 className="text-lg font-pixel text-gray-800">📝 MOCK EXAM</h2>
            <span className="font-mono text-lg font-bold text-gray-800">{timeLeft}s</span>
          </div>
          <div className="w-full border-2 border-gray-300 rounded-xl overflow-hidden bg-white shadow-lg">
            <img src={assetUrl(`/PW/PW_Mock_${event.questionNum}_layer-1.png`)} alt="Layer 1" className="w-full" />
          </div>
          <p className="text-xs font-mono text-gray-500">Players check their phones for layer 2!</p>
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border-2 border-accent rounded-xl p-6 max-w-lg w-full mx-4 text-center space-y-4">
        {event.phase === "countdown" && (
          <>
            <h2 className="text-2xl font-pixel text-accent">
              {event.type === "mock-exam"
                ? "📝 MOCK EXAM"
                : event.type === "hitbox"
                  ? "👊 HITBOX CHALLENGE"
                  : "🐔 CROSSY ROAD"}
            </h2>
            <div className="text-6xl font-pixel text-primary animate-pulse">
              {Math.max(1, 3 - Math.floor((now - event.startedAt) / 1000))}
            </div>
            <p className="text-sm font-mono text-muted-foreground">Get ready!</p>
          </>
        )}

        {event.phase === "active" && event.type === "hitbox" && (
          <>
            <h2 className="text-lg font-pixel text-accent">👊 HITBOX BATTLE — {timeLeft}s</h2>
            <div className="flex justify-around">
              <div className="text-center">
                <div className="text-4xl font-pixel text-primary">{chickTotal}</div>
                <div className="text-xs font-mono text-muted-foreground">
                  🐤 Chicks (avg: {aliveChicks.length > 0 ? (chickTotal / aliveChicks.length).toFixed(1) : 0})
                </div>
              </div>
              <div className="text-2xl text-muted-foreground">vs</div>
              <div className="text-center">
                <div className="text-4xl font-pixel text-destructive">{eagleTotal}</div>
                <div className="text-xs font-mono text-muted-foreground">🦅 Eagle{gameMode === "2v6" ? "s" : ""}</div>
              </div>
            </div>
            <p className="text-xs font-mono text-muted-foreground">TAP HITBOX AS FAST AS POSSIBLE!</p>
          </>
        )}

        {event.phase === "active" && event.type === "crossy-road" && (
          <CrossyRoadHost event={event} players={players} gameMode={gameMode} />
        )}

        {event.phase === "result" && (
          <>
            <h2 className="text-xl font-pixel text-accent">RESULT</h2>
            <p
              className="text-2xl font-pixel"
              style={{ color: event.result === "chick" ? "hsl(145 80% 50%)" : "hsl(0 80% 55%)" }}
            >
              {event.result === "chick" ? "🐤 Chicks Win!" : "🦅 Eagle Wins!"}
            </p>
            <p className="text-xs font-mono text-muted-foreground">
              {event.result === "chick" ? "+2 grades for everyone!" : "-2 grades for chicks"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// Final transcript: GLB scale vs earlier tiny lineup (was 0.2; 7.5x for readability).
const TRANSCRIPT_CEREMONY_MODEL_SCALE = 1.5;

// ─── Transcript 3D Character ──────────────────────────────────────────────────
function DancingChar({ chickColor, isWinner, delay }: { chickColor: string; isWinner: boolean; delay: number }) {
  const angleRef = useRef(delay + Math.PI);
  useFrame((_, d) => {
    angleRef.current += d * (isWinner ? 1.5 : 0.4);
  });
  return (
    <Suspense fallback={null}>
      <CharacterViewer
        color={chickColor as any}
        animState={isWinner ? "Victory" : "Idle"}
        facingAngle={angleRef.current}
      />
    </Suspense>
  );
}

// ─── Focus Camera for individual player ──────────────────────────────────────
function PlayerFocusCamera({ target }: { target: { x: number; z: number } }) {
  const { camera } = useThree();
  useFrame(() => {
    camera.position.set(target.x, 8, target.z + 6);
    camera.lookAt(target.x, 0, target.z);
  });
  return null;
}

// ─── Host Component ──────────────────────────────────────────────────────────
export default function Host() {
  const [mode, setMode] = useState<ConnectionMode>("webrtc");
  const [gameMode, setGameMode] = useState<GameMode>("1v3");
  const [startClickAt, setStartClickAt] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [mapId, setMapId] = useState<MapId>(1);
  const [themeHue, setThemeHue] = useState<number | undefined>(undefined);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [revealNow, setRevealNow] = useState(Date.now());
  const [focusPanelOpen, setFocusPanelOpen] = useState(false);
  // Stage transition toast notification
  const [stageToast, setStageToast] = useState<{ stage: number; key: number } | null>(null);
  const dismissStageToast = useCallback(() => setStageToast(null), []);
  const prevStageRef = useRef<number | null>(null);
  const {
    roomCode,
    players,
    kickPlayer,
    kickAllPlayers,
    broadcast,
    onClientMessage,
    gameModeRef,
    takeoverCodes,
    fillBots,
    removeBots,
  } = useHostRoom(mode);
  const [revealedCodes, setRevealedCodes] = useState<Set<string>>(new Set());
  const [botsAdded, setBotsAdded] = useState(false);
  const debugLogRef = useRef<string[]>([]);
  const lastSnapshotLogAtRef = useRef(0);

  const pushDebugLog = useCallback((line: string) => {
    const ts = new Date().toISOString();
    debugLogRef.current.push(`[${ts}] ${line}`);
    if (debugLogRef.current.length > 5000) {
      debugLogRef.current = debugLogRef.current.slice(-5000);
    }
  }, []);

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
    hostSkipExam,
  } = useGameLogic({ players, broadcast, gameMode, connectionMode: mode, mapId });

  useAdvertiseRoom(phase === "lobby" ? roomCode : "", mode);

  // Register client message handler
  useEffect(() => {
    onClientMessage((connId, msg) => {
      pushDebugLog(`client-msg conn=${connId} type=${msg?.type ?? "unknown"} payload=${JSON.stringify(msg)}`);
      handleClientMessage(connId, msg);
    });
  }, [onClientMessage, handleClientMessage, pushDebugLog]);

  useEffect(() => {
    if (!snapshot) return;
    const now = Date.now();
    // Periodic state snapshot for movement/stage tracing without spamming every frame.
    if (now - lastSnapshotLogAtRef.current < 1000) return;
    lastSnapshotLogAtRef.current = now;
    const playerSummary = Object.values(snapshot.players)
      .map(
        (p) =>
          `${p.connId}:${p.isEagle ? "E" : "C"}@(${p.position.x.toFixed(1)},${p.position.z.toFixed(1)}) props=${p.props.map((pi) => `${pi.type}:${pi.count}`).join("|")}`,
      )
      .join(" ; ");
    const eventType = snapshot.activeEvent ? `${snapshot.activeEvent.type}/${snapshot.activeEvent.phase}` : "none";
    pushDebugLog(
      `state phase=${snapshot.phase} stage=${snapshot.stage} label="${snapshot.stageLabel}" event=${eventType} players=[${playerSummary}]`,
    );
  }, [snapshot, pushDebugLog]);

  const exportDebugLog = useCallback(() => {
    const content = debugLogRef.current.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `firechick-debug-${Date.now()}.log`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    preloadVideos();
  }, []);

  useEffect(() => {
    broadcast({ type: "game-mode", gameMode });
    if (gameModeRef) gameModeRef.current = gameMode;
  }, [gameMode, broadcast, gameModeRef]);

  // Fire toast when stage advances during gameplay
  useEffect(() => {
    if (!snapshot || (phase !== "playing" && phase !== "exam")) return;
    const currentStage = snapshot.stage;
    if (prevStageRef.current === null) {
      setStageToast({ stage: currentStage, key: Date.now() });
    } else if (prevStageRef.current !== currentStage) {
      setStageToast({ stage: currentStage, key: Date.now() });
    }
    prevStageRef.current = currentStage;
  }, [snapshot?.stage, phase]);
  useEffect(() => {
    if (phase !== "reveal") return;
    const id = setInterval(() => setRevealNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [phase]);

  const handleGameModeToggle = useCallback(() => {
    const newMode: GameMode = gameMode === "1v3" ? "2v6" : "1v3";
    kickAllPlayers();
    setGameMode(newMode);
  }, [gameMode, kickAllPlayers]);

  const handleConnectionModeChange = useCallback(
    (v: string) => {
      kickAllPlayers();
      setMode(v as ConnectionMode);
    },
    [kickAllPlayers],
  );

  const playerCount = players.size;
  const maxPlayers = gameMode === "1v3" ? MAX_PLAYERS_1V3 : MAX_PLAYERS_2V6;
  const isFull = playerCount === maxPlayers;

  // ─── LOBBY ────────────────────────────────────────────────────────────────────
  if (phase === "lobby") {
    return (
      <div className="flex flex-col h-screen p-3 gap-3">
        {/* Cyber START button — top center absolute */}
        {(isFull || botsAdded) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-3">
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
                after:absolute after:inset-[-3px] after:border after:border-primary/20"
            >
              <Zap className="inline w-5 h-5 mr-2 -mt-0.5 text-primary" />▶ START GAME
            </button>
          </div>
        )}

        {/* Fill bots button — only when not full */}
        {!isFull && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={() => {
                fillBots?.();
                setBotsAdded(true);
              }}
              className="px-6 py-2.5 font-pixel text-sm tracking-widest uppercase
                text-accent border-2 border-accent bg-accent/10
                hover:bg-accent/25 transition-all duration-200
                shadow-[0_0_15px_hsl(var(--accent)/0.3)]
                hover:shadow-[0_0_25px_hsl(var(--accent)/0.5)]"
            >
              🤖 FILL BOTS
            </button>
          </div>
        )}

        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-2 z-10">
          <h1 className="text-sm md:text-base text-primary text-glow-green tracking-wider font-pixel">LOBBY</h1>

          <div className="flex items-center gap-2 font-mono text-xs flex-wrap">
            {/* Game mode toggle (only when not full) */}
            {!isFull && (
              <button
                onClick={handleGameModeToggle}
                className={`flex items-center gap-1 px-3 py-1.5 rounded border font-pixel text-xs transition-all ${
                  gameMode === "2v6"
                    ? "border-accent bg-accent/10 text-accent hover:bg-accent/20"
                    : "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                }`}
              >
                <Flame className={`w-3 h-3 ${gameMode === "2v6" ? "animate-pulse" : ""}`} />
                {gameMode}
              </button>
            )}

            {/* Map selector */}
            <Select value={String(mapId)} onValueChange={(v) => setMapId(Number(v) as MapId)}>
              <SelectTrigger className="h-7 min-w-[130px] w-auto text-xs font-mono bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAP_LIST.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)} className="text-xs font-mono">
                    🗺️ {m.name}&nbsp;
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

            <span className="text-muted-foreground">
              {playerCount}/{maxPlayers}
            </span>

            {/* Player color dots with kick */}
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
                            className="group relative w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-125"
                            style={{
                              backgroundColor: `hsl(${color.hsl})`,
                              boxShadow: `0 0 6px hsl(${color.hsl} / 0.5)`,
                            }}
                          >
                            {connId.startsWith("bot-") ? (
                              <span className="text-[8px]">🤖</span>
                            ) : (
                              <X
                                className="w-3 h-3 text-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                                strokeWidth={3}
                              />
                            )}
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

        {/* Instructions */}
        <div className="text-center space-y-1">
          {playerCount === 0 ? (
            <p className="text-xs text-muted-foreground font-mono animate-pulse">
              Open <span className="text-secondary">/client</span> on phones · Room:{" "}
              <span className="text-accent font-bold">{roomCode}</span>
            </p>
          ) : !isFull ? (
            <p className="text-xs text-muted-foreground font-mono">
              Waiting for {maxPlayers - playerCount} more player{maxPlayers - playerCount !== 1 ? "s" : ""}...
            </p>
          ) : (
            <p className="text-xs text-primary font-mono animate-pulse">All players ready! Press START GAME ↑</p>
          )}
        </div>

        <NetworkPerformancePanel players={players} />
      </div>
    );
  }

  // ─── REVEAL ──────────────────────────────────────────────────────────────────
  if (phase === "reveal") {
    const revealCountdown = startClickAt ? Math.max(0, 10 - (revealNow - startClickAt) / 1000) : 10;
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 p-4 bg-background">
        <h1 className="text-2xl font-pixel text-primary text-glow-green tracking-widest animate-pulse">GET READY</h1>
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-mono text-muted-foreground">Roles are being revealed on each phone...</p>
          <div className="text-6xl font-pixel text-accent animate-pulse">{Math.ceil(revealCountdown)}</div>
          <div className="flex gap-1.5 mt-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-2 opacity-60">
            {Object.keys(assignments).length} player{Object.keys(assignments).length !== 1 ? "s" : ""} assigned
          </p>
        </div>
      </div>
    );
  }

  // ─── COUNTDOWN ───────────────────────────────────────────────────────────────
  if (phase === "countdown") {
    const count = snapshot?.countdownTime ?? COUNTDOWN_DURATION_DISPLAY;
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-4">
        <h1 className="text-xl font-pixel text-primary text-glow-green">GET READY</h1>
        <div
          className="text-8xl font-pixel text-accent animate-pulse"
          style={{ textShadow: "0 0 30px hsl(var(--accent) / 0.8)" }}
        >
          {Math.ceil(count)}
        </div>
        <p className="text-sm font-mono text-muted-foreground">Game starting soon!</p>
      </div>
    );
  }

  // ─── PLAYING / EXAM ──────────────────────────────────────────────────────────
  if ((phase === "playing" || phase === "exam") && snapshot) {
    const alivePlayers = Object.values(snapshot.players).filter((p) => p.alive);

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
          enableHostDrag={phase === "playing"}
          onHostDragBegin={hostDragBegin}
          onHostDragUpdate={hostDragUpdate}
          onHostDragEnd={hostDragEnd}
          activeTipShareConnIds={snapshot.activeTipShareConnIds}
          onHostSkipExam={phase === "exam" ? hostSkipExam : undefined}
          mapId={mapId}
          themeHue={themeHue}
        />

        {/* Focus camera panel toggle button */}
        <button
          onClick={() => setFocusPanelOpen((prev) => !prev)}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-10 h-6 rounded-full bg-card/90 border border-border flex items-center justify-center hover:bg-card transition-all"
          title="Toggle player cameras"
        >
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${focusPanelOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* Focus camera panel */}
        {focusPanelOpen && (
          <div className="absolute top-10 left-0 right-0 z-20 bg-card/95 border-b border-border p-2">
            <div className="flex gap-2 overflow-x-auto">
              {Object.values(snapshot.players).map((p) => {
                const color = PLAYER_COLORS[p.colorIndex];
                const code = takeoverCodes[p.connId];
                const isRevealed = revealedCodes.has(p.connId);
                const isDisconnected = !players.has(p.connId);
                return (
                  <div key={p.connId} className="flex-shrink-0 flex flex-col items-center gap-1">
                    {p.alive ? (
                      <div
                        className="w-[140px] h-[100px] rounded border overflow-hidden"
                        style={{ borderColor: `hsl(${color?.hsl ?? "0 0% 50%"})`, opacity: isDisconnected ? 0.5 : 1 }}
                      >
                        <Canvas camera={{ position: [p.position.x, 8, p.position.z + 6], fov: 40 }}>
                          <ambientLight intensity={0.7} />
                          <directionalLight position={[5, 8, 5]} intensity={1} />
                          <PlayerFocusCamera target={p.position} />
                          <OrbitControls
                            target={[p.position.x, 0, p.position.z]}
                            enablePan={false}
                            enableZoom={true}
                            enableRotate={true}
                            minDistance={3}
                            maxDistance={15}
                          />
                          <gridHelper args={[40, 40, "hsl(0 0% 20%)", "hsl(0 0% 15%)"]} />
                          <Suspense fallback={null}>
                            <group position={[p.position.x, 0, p.position.z]}>
                              <CharacterViewer
                                color={p.chickColor as any}
                                animState={p.isMoving ? "Running" : "Idle"}
                                facingAngle={p.facingAngle}
                              />
                            </group>
                          </Suspense>
                        </Canvas>
                      </div>
                    ) : (
                      <div className="w-[140px] h-[100px] rounded border border-muted bg-muted/10 flex items-center justify-center">
                        <span className="text-[10px] font-mono text-muted-foreground">eliminated</span>
                      </div>
                    )}
                    <span className="text-[9px] font-mono" style={{ color: `hsl(${color?.hsl ?? "0 0% 50%"})` }}>
                      {color?.name} {p.isEagle ? "🦅" : "🐤"}
                      {isDisconnected ? " ⚡" : ""}
                    </span>
                    {/* Takeover code — blurred until host clicks */}
                    {code && (
                      <button
                        onClick={() =>
                          setRevealedCodes((prev) => {
                            const next = new Set(prev);
                            if (next.has(p.connId)) next.delete(p.connId);
                            else next.add(p.connId);
                            return next;
                          })
                        }
                        className="text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded bg-muted/20 border border-muted/30 transition-all"
                        style={{ filter: isRevealed ? "none" : "blur(4px)", color: "hsl(var(--accent))" }}
                        title={isRevealed ? "Click to hide" : "Click to reveal rejoin code"}
                      >
                        {code}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tip obtain countdowns — stacked at top */}
        {snapshot.tipObtainTimers && Object.keys(snapshot.tipObtainTimers).length > 0 && (
          <div className="absolute left-1/2 -translate-x-1/2 z-10 flex flex-col gap-1 items-center top-10">
            {Object.entries(snapshot.tipObtainTimers).map(([connId, timer]) => {
              const player = snapshot.players[connId];
              if (!player) return null;
              const color = PLAYER_COLORS[player.colorIndex];
              const sec = Math.ceil(timer.remainingMs / 1000);
              if (sec <= 0) return null;
              return (
                <div
                  key={connId}
                  className="px-3 py-1 rounded bg-accent/20 border border-accent font-mono text-xs text-accent whitespace-nowrap"
                >
                  📖 {color?.name ?? "?"} obtaining tips... {sec}s
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
        <button
          onClick={exportDebugLog}
          className="absolute top-2 left-28 z-10 px-2 py-1 rounded border border-border bg-card/90 hover:bg-card text-[11px] font-mono text-muted-foreground"
          title="Download host debug log"
        >
          ⬇ LOG
        </button>
        <div className="absolute left-2 top-12 z-10 px-2 py-2 rounded bg-card/85 border border-border w-44">
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

          {/* Color picker trigger */}
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => setColorPickerOpen((p) => !p)}
              className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              <Palette className="w-3 h-3" />
              Theme
            </button>
            {themeHue !== undefined && (
              <button
                onClick={() => setThemeHue(undefined)}
                className="text-[9px] font-mono text-muted-foreground hover:text-destructive"
              >
                Reset
              </button>
            )}
          </div>

          {/* Circular hue picker */}
          {colorPickerOpen && (
            <div className="mt-2 flex flex-col items-center gap-2">
              <div
                className="relative w-32 h-32 rounded-full cursor-pointer"
                style={{
                  background:
                    "conic-gradient(from 0deg, hsl(0,70%,50%), hsl(60,70%,50%), hsl(120,70%,50%), hsl(180,70%,50%), hsl(240,70%,50%), hsl(300,70%,50%), hsl(360,70%,50%))",
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const cx = rect.width / 2;
                  const cy = rect.height / 2;
                  const dx = e.clientX - rect.left - cx;
                  const dy = e.clientY - rect.top - cy;
                  const angle = Math.atan2(dy, dx);
                  const hue = ((angle * 180) / Math.PI + 360 + 90) % 360;
                  setThemeHue(Math.round(hue));
                }}
              >
                {/* Center indicator */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 border-foreground/30"
                  style={{
                    backgroundColor: themeHue !== undefined ? `hsl(${themeHue}, 50%, 30%)` : "hsl(var(--card))",
                  }}
                />
                {/* Hue indicator dot */}
                {themeHue !== undefined &&
                  (() => {
                    const rad = ((themeHue - 90) * Math.PI) / 180;
                    const r = 52;
                    return (
                      <div
                        className="absolute w-4 h-4 rounded-full border-2 border-foreground shadow-md"
                        style={{
                          backgroundColor: `hsl(${themeHue}, 70%, 50%)`,
                          left: `calc(50% + ${Math.cos(rad) * r}px - 8px)`,
                          top: `calc(50% + ${Math.sin(rad) * r}px - 8px)`,
                        }}
                      />
                    );
                  })()}
              </div>
              <span className="text-[9px] font-mono text-muted-foreground">
                {themeHue !== undefined ? `Hue: ${themeHue}°` : "Click wheel to pick"}
              </span>
            </div>
          )}
        </div>

        {/* Eagle awake countdown */}
        {!snapshot.eagleAwake && (
          <div className="absolute left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded bg-destructive/20 border border-destructive/50 font-mono text-xs text-destructive animate-pulse top-12">
            🦅 Eagle awakens in {Math.max(0, Math.ceil(5 - snapshot.gameTime))}s
          </div>
        )}

        {/* Exam helper layer on host (rule-based visibility) */}
        {snapshot.examState &&
          snapshot.examState.questionNum > 0 &&
          phase === "exam" &&
          snapshot.examState.hostDisplayLayer !== "none" && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-[#fefcf5] border-2 border-accent rounded-xl p-4 max-w-md w-[90%] shadow-2xl">
              <p className="text-[10px] font-mono text-gray-500 mb-1 text-center">HOST EXAM LAYER</p>
              <img
                src={assetUrl(
                  `/PW/PW_Final_${snapshot.examState.questionNum}_layer-${snapshot.examState.hostDisplayLayer}.png`,
                )}
                alt="Final exam"
                className="w-full rounded"
              />
            </div>
          )}

        {/* Active event overlay */}
        {snapshot.activeEvent && (
          <EventOverlay event={snapshot.activeEvent} players={snapshot.players} gameMode={gameMode} />
        )}

        <NetworkPerformancePanel players={players} />

        {/* Stage transition toast — slides in from right under game timer */}
        {stageToast && (
          <StageTransition
            key={stageToast.key}
            stage={stageToast.stage as 0 | 1 | 2 | 3}
            onDismiss={dismissStageToast}
          />
        )}

        {/* VideoOverlay LAST so it renders on top of everything */}
        <VideoOverlay video={videoPlaying} onComplete={onVideoComplete} />
      </div>
    );
  }

  // ─── GAME OVER / TRANSCRIPT ──────────────────────────────────────────────────
  if (phase === "gameover" && snapshot) {
    return <GameOverCeremony snapshot={snapshot} gameMode={gameMode} />;
  }

  return <div className="flex items-center justify-center h-screen text-muted-foreground font-mono">Loading...</div>;
}

// ─── Game Over Ceremony Component ──────────────────────────────────────────────
function GameOverCeremony({ snapshot, gameMode }: { snapshot: GameStateSnapshot; gameMode: string }) {
  const { isImmersive } = useImmersive();
  const [ceremonyPhase, setCeremonyPhase] = useState<"mvp" | "team" | "transcript">("mvp");

  const winner = snapshot.winner;
  const getMatchResult = (p: PlayerGameStateSerializable): "draw" | "win" | "lose" => {
    if (winner === "draw" || winner === null) return "draw";
    if ((winner === "eagle" && p.isEagle) || (winner === "chicks" && !p.isEagle)) return "win";
    return "lose";
  };
  const sorted: PlayerGameStateSerializable[] = Object.values(snapshot.players).sort((a, b) => {
    const aWin = getMatchResult(a) !== "lose";
    const bWin = getMatchResult(b) !== "lose";
    if (aWin !== bWin) return aWin ? -1 : 1;
    return b.actionScore - a.actionScore;
  });

  // Determine MVP
  const mvp = (() => {
    if (winner === "draw") {
      return sorted[0];
    }
    const winningTeam = sorted.filter((p) => (winner === "eagle" && p.isEagle) || (winner === "chicks" && !p.isEagle));
    return winningTeam.length > 0 ? winningTeam.sort((a, b) => b.actionScore - a.actionScore)[0] : sorted[0];
  })();

  const winningTeamPlayers = sorted
    .filter((p) => (winner === "eagle" && p.isEagle) || (winner === "chicks" && !p.isEagle));

  const skipTeamPhase =
    winner === "draw" || (winner === "eagle" && gameMode === "1v3") || winningTeamPlayers.length === 0;

  useEffect(() => {
    const t1 = setTimeout(() => {
      if (skipTeamPhase) {
        setCeremonyPhase("transcript");
      } else {
        setCeremonyPhase("team");
      }
    }, 5000);

    const t2 = skipTeamPhase
      ? null
      : setTimeout(() => {
          setCeremonyPhase("transcript");
        }, 10000);

    return () => {
      clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [skipTeamPhase]);

  const mvpColor = mvp ? PLAYER_COLORS[mvp.colorIndex] : null;
  const teamName =
    winner === "eagle" ? "🦅 GAP Killers Win!" : winner === "chicks" ? "🐤 Fire Chicks Win!" : "🤝 Draw!";

  // Immersive floating particles for ceremony
  const ceremonyParticles = useMemo(
    () =>
      isImmersive
        ? Array.from({ length: 60 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            duration: 6 + Math.random() * 10,
            delay: Math.random() * 8,
            size: 4 + Math.random() * 16,
            opacity: 0.2 + Math.random() * 0.4,
          }))
        : [],
    [isImmersive],
  );

  const CeremonyParticles = () =>
    isImmersive ? (
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {ceremonyParticles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              bottom: "-10%",
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: `radial-gradient(circle at 30% 30%, rgba(255,215,0,0.9), rgba(255,215,0,0.3), rgba(255,215,0,0.05))`,
              opacity: p.opacity,
              animation: `bubble-float ${p.duration}s linear ${p.delay}s infinite, bubble-sway ${p.duration * 0.5}s ease-in-out ${p.delay}s infinite`,
              filter: "blur(1px)",
              boxShadow: "0 0 12px rgba(255,215,0,0.4)",
            }}
          />
        ))}
      </div>
    ) : null;

  // Phase 1: MVP showcase
  if (ceremonyPhase === "mvp" && mvp) {
    return (
      <div className={`flex flex-col items-center justify-center h-screen gap-6 overflow-hidden relative ${isImmersive ? "bg-black" : "bg-background"}`}>
        {isImmersive && <CeremonyParticles />}
        {isImmersive && <div className="immersive-vignette" />}
        <h1 className={`text-2xl font-pixel text-accent tracking-widest z-10 ${isImmersive ? "immersive-fade-in ceremony-title-glow" : "text-glow-green animate-pulse"}`}
          style={isImmersive ? { "--delay": "0.3s" } as React.CSSProperties : undefined}
        >
          🏆 MVP
        </h1>
        <div className="h-[50vh] w-full min-h-[280px] z-10">
          <Canvas
            className="h-full w-full"
            style={{ width: "100%", height: "100%" }}
            camera={{ position: [0, 0.8, 5.8], fov: 45 }}
          >
            <ambientLight intensity={isImmersive ? 0.4 : 0.8} />
            <directionalLight position={[5, 8, 5]} intensity={isImmersive ? 1.6 : 1.2} />
            {isImmersive && <spotLight position={[0, 6, 2]} angle={0.4} penumbra={0.8} intensity={3} color="#ffd700" />}
            <group position={[0, -1.8, 0]}>
              <group scale={1.5}>
                <DancingChar chickColor={mvp.chickColor} isWinner={true} delay={0} />
              </group>
            </group>
          </Canvas>
        </div>
        <div className={`flex items-center gap-3 px-6 py-3 rounded-xl border-2 border-accent z-10 ${isImmersive ? "bg-accent/10 immersive-fade-in immersive-border-breathe" : "bg-accent/20"}`}
          style={isImmersive ? { "--delay": "1.0s" } as React.CSSProperties : undefined}
        >
          <Trophy className="w-6 h-6 text-accent" />
          <span className="text-lg font-pixel" style={{ color: mvpColor ? `hsl(${mvpColor.hsl})` : undefined }}>
            {mvpColor?.name ?? "?"}
          </span>
          <span className="text-sm font-mono text-muted-foreground">Score: {mvp.actionScore.toFixed(0)}</span>
        </div>
        <p className={`text-sm font-mono text-muted-foreground z-10 ${isImmersive ? "immersive-fade-in" : ""}`}
          style={isImmersive ? { "--delay": "1.4s" } as React.CSSProperties : undefined}
        >
          🎉 Congratulations!
        </p>
      </div>
    );
  }

  // Phase 2: Winning team
  if (ceremonyPhase === "team") {
    const count = winningTeamPlayers.length;
    const cols = Math.min(3, count);
    const rows = Math.ceil(count / cols);
    const spacingX = 2.8;
    const spacingZ = 2.4;
    return (
      <div className={`flex flex-col items-center justify-center h-screen gap-6 overflow-hidden relative ${isImmersive ? "bg-black" : "bg-background"}`}>
        {isImmersive && <CeremonyParticles />}
        {isImmersive && <div className="immersive-vignette" />}
        <h1
          className={`text-2xl font-pixel tracking-widest z-10 ${isImmersive ? "immersive-fade-in ceremony-title-glow" : ""}`}
          style={{
            color: winner === "eagle" ? "hsl(0 80% 55%)" : "hsl(145 80% 50%)",
            ...(isImmersive ? { "--delay": "0.2s" } as React.CSSProperties : {}),
          }}
        >
          {teamName}
        </h1>
        <div className="h-[50vh] w-full min-h-[280px] z-10">
          <Canvas
            className="h-full w-full"
            style={{ width: "100%", height: "100%" }}
            camera={{ position: [0, 1.2, 6 + rows * 2.2], fov: 45 }}
          >
            <ambientLight intensity={isImmersive ? 0.3 : 0.8} />
            <directionalLight position={[5, 8, 5]} intensity={isImmersive ? 1.4 : 1.2} />
            {isImmersive && <spotLight position={[0, 8, 3]} angle={0.6} penumbra={0.9} intensity={2.5} color="#ffd700" />}
            <group position={[0, -1.8, 0]}>
              {winningTeamPlayers.map((p, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const rowOffset = row % 2 === 0 ? -0.8 : 0.8;
                const x = (col - (cols - 1) / 2) * spacingX + rowOffset;
                const z = -row * spacingZ;
                return (
                  <group key={p.connId} position={[x, 0.1, z]}>
                    <group scale={Math.min(1.5, 8 / cols)}>
                      <DancingChar chickColor={p.chickColor} isWinner={true} delay={i * 0.4} />
                    </group>
                  </group>
                );
              })}
            </group>
          </Canvas>
        </div>
        <p className={`text-sm font-mono text-muted-foreground z-10 ${isImmersive ? "immersive-fade-in" : ""}`}
          style={isImmersive ? { "--delay": "0.8s" } as React.CSSProperties : undefined}
        >
          🎉 Congratulations!
        </p>
      </div>
    );
  }

  // Phase 3: 3D lineup sits in upper half with feet just above viewport mid (bottom of canvas ~48–50vh)
  const count = sorted.length;
  const cols = Math.min(6, count);
  const rows = Math.ceil(count / cols);
  const spacingX = Math.min(3.2, 14 / cols);
  const spacingZ = 2.6;
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <div className="h-[50vh] min-h-0 w-full relative flex flex-col justify-end pb-4 shrink-0">
        <div className="flex-1 min-h-0 w-full">
          <Canvas
            className="h-full w-full"
            style={{ width: "100%", height: "100%" }}
            camera={{ position: [0, 1.8, 6 + rows * 2.2], fov: 45 }}
          >
            <ambientLight intensity={0.8} />
            <directionalLight position={[5, 8, 5]} intensity={1.2} />
            <group position={[0, -2.4, (rows - 1) * spacingZ * 0.5]}>
              {sorted.map((p, i) => {
                const isWin = getMatchResult(p) !== "lose";
                const col = i % cols;
                const row = Math.floor(i / cols);
                const rowOffset = row % 2 === 0 ? -0.8 : 0.8;
                const x = (col - (cols - 1) / 2) * spacingX + rowOffset;
                const z = -row * spacingZ;
                return (
                  <group key={p.connId} position={[x, 0.1 + row * 0.05, z]}>
                    <group scale={Math.min(1.8, 8 / cols)}>
                      <DancingChar chickColor={p.chickColor} isWinner={isWin} delay={i * 0.4} />
                    </group>
                  </group>
                );
              })}
            </group>
          </Canvas>
        </div>

        {mvp && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 rounded bg-accent/20 border border-accent pointer-events-none">
            <Trophy className="w-4 h-4 text-accent" />
            <span className="text-xs font-pixel text-accent">MVP: {PLAYER_COLORS[mvp.colorIndex]?.name ?? "?"}</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col border-t border-border overflow-hidden">
        <div className="py-3 px-2 text-center border-b border-border flex-shrink-0">
          <h1 className="text-lg sm:text-xl font-pixel text-accent text-glow-green mb-1">GAME OVER</h1>
          <p
            className="text-base sm:text-lg font-pixel"
            style={{
              color:
                winner === "eagle" ? "hsl(0 80% 55%)" : winner === "chicks" ? "hsl(145 80% 50%)" : "hsl(45 100% 55%)",
            }}
          >
            {teamName}
          </p>
        </div>

        <div className="flex-1 min-h-0 p-3 sm:p-4 overflow-auto">
          <h2 className="text-center text-sm font-pixel text-foreground mb-3 tracking-widest">📋 TRANSCRIPT</h2>
          <div className="w-full max-w-3xl mx-auto">
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
                {sorted.map((p) => {
                  const color = PLAYER_COLORS[p.colorIndex];
                  const letter = gradeToLetter(p.health);
                  const gradeColor = getGradeColor(p.health);
                  const result = getMatchResult(p);

                  return (
                    <tr key={p.connId} className="border-b border-border/40 hover:bg-card/30">
                      <td className="py-2 pl-2">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: `hsl(${color?.hsl ?? "0 0% 50%"})` }}
                          />
                          <span style={{ color: `hsl(${color?.hsl ?? "0 0% 50%"})` }}>{color?.name}</span>
                          {p.isEagle ? " 🦅" : " 🐤"}
                          {p.isStarStudent && <Star className="w-3 h-3 text-accent fill-accent ml-0.5" />}
                          {p.connId === mvp?.connId && <Trophy className="w-3 h-3 text-accent ml-0.5" />}
                        </div>
                      </td>
                      <td className="py-2 text-center">
                        <span className="text-2xl font-bold" style={{ color: gradeColor }}>
                          {letter}
                        </span>
                        <span className="text-[9px] text-muted-foreground block">{p.health.toFixed(1)}</span>
                      </td>
                      <td className="py-2 text-center text-muted-foreground">{Math.floor(p.survivalTime)}s</td>
                      <td className="py-2 text-center text-muted-foreground">
                        {p.isEagle ? `+${p.damageDealt.toFixed(1)}` : `-${p.damageTaken.toFixed(1)}`}
                      </td>
                      <td className="py-2 text-center text-foreground font-bold">{p.actionScore.toFixed(0)}</td>
                      <td className="py-2 text-center">
                        {result === "draw" ? (
                          <span className="text-yellow-400 font-bold">DRAW</span>
                        ) : result === "win" ? (
                          <span className="text-primary font-bold">WIN</span>
                        ) : (
                          <span className="text-destructive">LOSE</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="py-3 text-center border-t border-border flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="px-8 py-3 rounded-lg border-2 border-primary bg-primary/10 text-primary font-pixel text-sm tracking-widest hover:bg-primary/20 transition-all"
          >
            ▶ PLAY AGAIN
          </button>
        </div>
      </div>
    </div>
  );
}

const COUNTDOWN_DURATION_DISPLAY = 3;
