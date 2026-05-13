import { useState, useEffect, useCallback, Suspense, useRef, useMemo } from "react";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { GameEvent, GameStateSnapshot } from "@/lib/gameTypes";
import { useHostRoom, useAdvertiseRoom, useWebRTCRoomBroadcast, type ConnectionMode } from "@/hooks/useGameRoom";
import { useGameLogic } from "@/hooks/useGameLogic";
import LobbyArena from "@/components/LobbyArena";
import GameplayMap from "@/components/GameplayMap";
import HealthDisplay from "@/components/HealthDisplay";
import StageProgressBar from "@/components/StageProgressBar";
import VideoOverlay, { preloadVideos } from "@/components/VideoOverlay";
import ReplayCountdownOverlay from "@/components/ReplayCountdownOverlay";
import StageTransition from "@/components/StageTransition";
import NetworkPerformancePanel from "@/components/NetworkPerformancePanel";
import CrossyRoadHost from "@/components/events/CrossyRoadHost";
import { PLAYER_COLORS, MAX_PLAYERS_1V3, MAX_PLAYERS_2V6 } from "@/lib/playerColors";
import { gradeToLetter, getGradeColor } from "@/lib/gradeSystem";
import { X, Flame, Zap, Trophy, Star, ChevronDown, Palette, Sun, Pause, Play, Bot, Settings, Download } from "lucide-react";
import type { GameMode } from "@/lib/gameTypes";
import CharacterViewer from "@/components/CharacterViewer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { MapId } from "@/lib/mapVariants";
import { MAP_LIST } from "@/lib/mapVariants";
import type { PlayerGameStateSerializable } from "@/lib/gameTypes";
import { assetUrl } from "@/lib/assets";
import ScoreBreakdownModal from "@/components/ScoreBreakdownModal";
import { Bounds } from "@react-three/drei";
import { useImmersive } from "@/context/ImmersiveContext";
import { ColorCodeBalls } from "@/components/ColorCodeBalls";
import { GameEndTransition } from "@/components/GameEndTransition";
import { gameLogger } from "@/lib/gameLogger";
import { STAGE_READY_COUNTDOWN_MS, getStageTransitionVideo } from "@/lib/stageInfo";

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
  const aliveEagles = Object.values(players).filter((p: any) => p.isEagle && p.alive);
  const chickTotal = aliveChicks.reduce((sum: number, p: any) => sum + (event.chickClicks[p.connId] ?? 0), 0);
  const eagleTotal = aliveEagles.reduce((sum: number, p: any) => sum + (event.eagleClicks[p.connId] ?? 0), 0);
  const timeLeft = Math.max(0, Math.ceil((event.endAt - now) / 1000));
  const mockExamCorrectCount = Math.max(
    event.mockExamCorrectCount ?? 0,
    Object.values(event.mockExamCorrectByPlayer ?? {}).filter(Boolean).length,
    aliveChicks.filter((p: any) => (event.chickClicks[p.connId] ?? 0) > 0).length,
  );

  // Mock exam active: show layer 1 inline (tags hidden via hideOverlays)
  if (event.phase === "active" && event.type === "mock-exam" && event.questionNum) {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 max-w-2xl w-full px-6">
          <div className="flex items-center justify-between w-full">
            <h2 className="text-lg font-pixel text-accent">📝 MOCK EXAM</h2>
            <span className="font-mono text-lg font-bold text-primary">{timeLeft}s</span>
          </div>
          <div className="w-full border-2 border-accent/30 rounded-xl overflow-hidden bg-card shadow-lg">
            <img
              src={assetUrl(`/PW/PW_Mock_${event.questionNum}_layer-1.png`)}
              alt="Layer 1"
              className="w-full bg-white"
            />
          </div>
          <p className="text-xs font-mono text-muted-foreground">Players check their phones for layer 2!</p>
        </div>
      </div>
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
              {Math.max(
                1,
                Math.ceil(
                  ((event.countdownRemainingMs ?? Math.max(0, 3000 - (now - event.startedAt))) || 1) / 1000,
                ),
              )}
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
                <div className="text-xs font-mono text-muted-foreground">
                  🦅 Eagle{gameMode === "2v6" ? "s" : ""} (avg: {aliveEagles.length > 0 ? (eagleTotal / aliveEagles.length).toFixed(1) : 0})
                </div>
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
            {event.type === "mock-exam" ? (
              <>
                <p
                  className="text-3xl font-pixel"
                  style={{ color: mockExamCorrectCount > 0 ? "hsl(145 80% 50%)" : "hsl(0 80% 55%)" }}
                >
                  {mockExamCorrectCount > 0 ? "✅ CORRECT" : "❌ INCORRECT"}
                </p>
                {mockExamCorrectCount > 0 && (
                  <p className="text-sm font-mono text-muted-foreground">
                    {mockExamCorrectCount} player{mockExamCorrectCount !== 1 ? "s" : ""} answered correctly
                  </p>
                )}
              </>
            ) : (
              <>
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

function LobbyVideoPanel({ src, side, label }: { src: string; side: 'left' | 'right'; label?: string }) {
  const isLeft = side === 'left';

  return (
    <div className={`absolute top-2 z-10 ${isLeft ? 'left-2' : 'right-2'}`}>
      <div className={`flex flex-col ${isLeft ? 'items-start' : 'items-end'}`}>
        <div className="overflow-hidden rounded-lg border-2 border-white/50 pointer-events-none" style={{ width: '40vw', maxWidth: '400px', aspectRatio: '16/9' }}>
          <video src={src} className="w-full h-full object-cover opacity-90" autoPlay loop muted playsInline />
        </div>
        {label && (
          <p className={`text-sm font-mono text-foreground/70 mt-1 ${isLeft ? 'text-left' : 'text-right'}`}>
            {label}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Host Component ──────────────────────────────────────────────────────────
export default function Host() {
  const [mode, setMode] = useState<ConnectionMode>("webrtc");
  const [devMode, setDevMode] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>("1v3");
  const [startClickAt, setStartClickAt] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<"dark" | "semi" | "light">("semi");
  const [mapId, setMapId] = useState<MapId>(1);
  const [themeHue, setThemeHue] = useState<number | undefined>(undefined);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [revealNow, setRevealNow] = useState(Date.now());
  const [focusPanelOpen, setFocusPanelOpen] = useState(false);
  const { isImmersive } = useImmersive();
  const showDebugControls = import.meta.env.DEV || devMode;
  const effectiveMode: ConnectionMode = isImmersive ? "webrtc" : mode;
  // Stage transition toast notification
  const [stageToast, setStageToast] = useState<{ stage: number; key: number } | null>(null);
  const [dismissedStageTransitionKey, setDismissedStageTransitionKey] = useState<string | null>(null);
  const dismissStageToast = useCallback(() => setStageToast(null), []);
  const prevStageRef = useRef<number | null>(null);
  const [eagleWarningDone, setEagleWarningDone] = useState(false);
  useEffect(() => {
    if (!isImmersive) return;
    if (mode !== "webrtc") setMode("webrtc");
  }, [isImmersive, mode]);
  const {
    roomCode,
    players,
    kickPlayer,
    kickAllPlayers,
    broadcast,
    onClientMessage,
    gameModeRef,
    takeoverCodes,
    addBot,
    fillBots,
    removeBots,
    setPingDiagnosticsEnabled,
  } = useHostRoom(effectiveMode, { forceRelay: isImmersive, useColorCode: isImmersive });
  const [revealedCodes, setRevealedCodes] = useState<Set<string>>(new Set());
  const [botsAdded, setBotsAdded] = useState(false);
  const [gameOverSnapshot, setGameOverSnapshot] = useState<GameStateSnapshot | null>(null);
  const [autoStartRemainingSec, setAutoStartRemainingSec] = useState(60);
  const [autoStartQueued, setAutoStartQueued] = useState(false);
  const prevHumanPlayerCountRef = useRef(0);
  const autoStartTriggeredRef = useRef(false);
  const debugLogRef = useRef<string[]>([]);
  const lastSnapshotLogAtRef = useRef(0);

  const pushDebugLog = useCallback((line: string) => {
    const ts = new Date().toISOString();
    debugLogRef.current.push(`[${ts}] ${line}`);
    if (debugLogRef.current.length > 5000) {
      debugLogRef.current = debugLogRef.current.slice(-5000);
    }
  }, []);

  const replaceHumanWithBot = useCallback((connId: string, botConnId: string, colorIndex: number) => {
    kickPlayer(connId);
    addBot(botConnId, colorIndex);
  }, [addBot, kickPlayer]);

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
    hostSkipActiveEvent,
    togglePause,
    toggleBotsPause,
  } = useGameLogic({
    players,
    broadcast,
    gameMode,
    connectionMode: effectiveMode,
    replacePlayerWithBot: replaceHumanWithBot,
    mapId,
    devMode,
  });

  const [isPaused, setIsPaused] = useState(false);
  const [isBotsPaused, setIsBotsPaused] = useState(false);
  const [showPlayTime, setShowPlayTime] = useState(false);
  // 3s "grab back controls" countdown after manual pause resume
  const [grabBackUntil, setGrabBackUntil] = useState(0);
  // Re-render during grab-back countdown
  const [, forceRender] = useState(0);
  useEffect(() => {
    if (grabBackUntil <= Date.now()) return;
    const id = setInterval(() => {
      if (Date.now() >= grabBackUntil) {
        setGrabBackUntil(0);
        clearInterval(id);
      }
      forceRender((n) => n + 1);
    }, 200);
    return () => clearInterval(id);
  }, [grabBackUntil]);

  useAdvertiseRoom(roomCode, phase === "lobby", effectiveMode);
  const { rebroadcastNow, broadcastBeaconNow } = useWebRTCRoomBroadcast(roomCode);

  // Auto-broadcast room code every 1 second while in active lobby (not gameover/reveal/etc)
  useEffect(() => {
    // Only broadcast during active lobby phase
    if (phase !== "lobby") return;

    const broadcastInterval = setInterval(() => {
      rebroadcastNow().catch(() => {
        // Silently catch broadcast errors - network might be temporarily unavailable
      });
    }, 1000); // Broadcast every 1 second

    return () => clearInterval(broadcastInterval);
  }, [phase, rebroadcastNow]);

  // Release reserved color code as soon as the game leaves the lobby so the
  // permutation is freed up for new lobbies (no players join after lobby).
  const releasedRoomRef = useRef<string>("");
  useEffect(() => {
    if (!isImmersive) return;
    if (!roomCode) return;
    if (phase === "lobby") return;
    if (releasedRoomRef.current === roomCode) return;
    releasedRoomRef.current = roomCode;
    void import("@/lib/colorCode").then(({ releaseColorCode }) => releaseColorCode(roomCode));
  }, [phase, roomCode, isImmersive]);

    // Release regular room code when host leaves lobby without starting game
    useEffect(() => {
        if (!roomCode) return;
        if (phase !== "lobby") return;

        const releaseRoom = async () => {
            try {
                await fetch('/api/release-room', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: roomCode })
                });
            } catch { }
        };

        window.addEventListener('beforeunload', releaseRoom);
        return () => {
            window.removeEventListener('beforeunload', releaseRoom);
            releaseRoom();
        };
    }, [roomCode, phase]);

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

  useEffect(() => {
    if (phase === "gameover" && snapshot) {
      setGameOverSnapshot(snapshot);
      return;
    }
    if (phase !== "gameover") {
      setGameOverSnapshot(null);
    }
  }, [phase, snapshot]);

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

  // Spacebar = Pause/Resume during gameplay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (phase === 'playing' || phase === 'exam')) {
        e.preventDefault();
        if (isPaused) {
          // Resuming: start 3s grab-back, then unpause
          setGrabBackUntil(Date.now() + 3000);
        } else {
          // Pausing: immediate
          togglePause();
          setIsPaused(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, isPaused, togglePause]);

  const stageTransitionKey =
    snapshot && snapshot.stageTransitionUntil > 0
      ? `${snapshot.stage}-${snapshot.stageTransitionUntil}`
      : null;
  const activeStageTransitionKey =
    snapshot && snapshot.stageTransitionUntil > 0
      ? snapshot.stageTransitionUntil - Date.now() > STAGE_READY_COUNTDOWN_MS
        ? stageTransitionKey
        : null
      : null;

  useEffect(() => {
    setDismissedStageTransitionKey(null);
    setEagleWarningDone(false);
  }, [stageTransitionKey]);

  const hostStageTransitionVideo =
    !snapshot || !activeStageTransitionKey || dismissedStageTransitionKey === activeStageTransitionKey
      ? null
      : getStageTransitionVideo(snapshot.stage);

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
  const humanPlayerCount = useMemo(
    () => Array.from(players.keys()).filter((connId) => !connId.startsWith("bot-")).length,
    [players],
  );

  const handleFillBots = useCallback(() => {
    fillBots?.();
    setBotsAdded(true);
  }, [fillBots]);

  const handleStartGame = useCallback(() => {
    setStartClickAt(Date.now());
    startGame();
  }, [startGame]);

  useEffect(() => {
    if (phase !== "lobby") {
      prevHumanPlayerCountRef.current = 0;
      autoStartTriggeredRef.current = false;
      return;
    }

    const previousHumanPlayerCount = prevHumanPlayerCountRef.current;
    if (humanPlayerCount === 0) {
      setAutoStartRemainingSec(60);
      setAutoStartQueued(false);
      setBotsAdded(false);
      autoStartTriggeredRef.current = false;
      removeBots?.();
      prevHumanPlayerCountRef.current = 0;
      return;
    }

    if (previousHumanPlayerCount === 0) {
      setAutoStartRemainingSec(60);
      setAutoStartQueued(false);
      autoStartTriggeredRef.current = false;
    }

    prevHumanPlayerCountRef.current = humanPlayerCount;
  }, [phase, humanPlayerCount, removeBots]);

  useEffect(() => {
    if (phase !== "lobby") return;
    if (humanPlayerCount === 0) return;
    if (autoStartRemainingSec <= 0) return;

    const timeoutId = window.setTimeout(() => {
      setAutoStartRemainingSec((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [phase, humanPlayerCount, autoStartRemainingSec]);

  useEffect(() => {
    if (phase !== "lobby") return;
    if (humanPlayerCount === 0) return;
    if (autoStartRemainingSec > 0) return;
    if (autoStartQueued) return;

    if (!isFull) {
      handleFillBots();
    }
    setAutoStartQueued(true);
  }, [phase, humanPlayerCount, autoStartRemainingSec, autoStartQueued, isFull, handleFillBots]);

  useEffect(() => {
    if (phase !== "lobby") return;
    if (!autoStartQueued) return;
    if (!isFull) return;
    if (autoStartTriggeredRef.current) return;

    autoStartTriggeredRef.current = true;
    handleStartGame();
  }, [phase, autoStartQueued, isFull, handleStartGame]);

  // ─── Damage glitch (immersive) ────────────────────────────────────────────────
  const [hostGlitching, setHostGlitching] = useState(false);
  const prevDamageSumRef = useRef(0);
  const glitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isImmersive || !snapshot) return;
    const totalDamage = Object.values(snapshot.players).reduce((acc, p) => acc + p.damageTaken, 0);
    if (totalDamage > prevDamageSumRef.current) {
      prevDamageSumRef.current = totalDamage;
      setHostGlitching(true);
      if (glitchTimerRef.current) clearTimeout(glitchTimerRef.current);
      glitchTimerRef.current = setTimeout(() => setHostGlitching(false), 240);
    }
    if (snapshot.phase === "lobby") prevDamageSumRef.current = 0;
  }, [isImmersive, snapshot]);

  // Spacebar = Toggle game mode in lobby
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && phase === 'lobby' && !isFull) {
        e.preventDefault();
        handleGameModeToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, isFull, handleGameModeToggle]);


  // ─── LOBBY ────────────────────────────────────────────────────────────────────
  if (phase === "lobby") {
    return (
      <div className={`flex flex-col h-screen p-3 gap-3 relative ${isImmersive ? "bg-black" : ""}`}>
        <GameMusic phase={phase} stage={snapshot?.stage ?? 0} broadcast={broadcast} />
        {isImmersive && <div className="immersive-vignette" />}
        {/* {isImmersive && <div className="immersive-scanline-overlay" style={{ opacity: 0.25 }} />} */}
        {/* Cyber START button — top center absolute */}
        {(isFull || botsAdded) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-3">
            <button
              onClick={handleStartGame}
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
              onClick={handleFillBots}
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
          <div className="flex items-center gap-2">
            <h1
              onClick={() => setDevMode(d => !d)}
              className={`text-sm md:text-base tracking-wider font-pixel cursor-pointer select-none ${
                devMode
                  ? "text-red-500"
                  : isImmersive ? "text-primary ceremony-title-glow" : "text-primary text-glow-green"
              }`}
              title={devMode ? "Dev mode ON — click to disable" : "Click to enable dev mode"}
            >
              LOBBY
            </h1>

            {/* Game mode toggle (only when not full) */}
            {!isFull && (
              <button
                onClick={handleGameModeToggle}
                className={`flex items-center gap-1 px-3 py-1.5 rounded border font-pixel text-xs transition-all pl-[8px] pr-[10px] ${
                  gameMode === "2v6"
                    ? "border-accent bg-accent/10 text-accent hover:bg-accent/20"
                    : "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                }`}
              >
                <Flame className={`w-3 h-3 ${gameMode === "2v6" ? "animate-pulse" : ""}`} />
                {gameMode}
              </button>
            )}

            {/* Room code */}
            <button
              type="button"
              onClick={async () => {
                if (!isImmersive) return;
                const [presenceOk, beaconOk] = await Promise.all([rebroadcastNow(), broadcastBeaconNow()]);
                toast(presenceOk || beaconOk ? "Room rebroadcasted" : "Room rebroadcast failed");
              }}
              className={`px-2 py-1 rounded border border-border bg-card font-mono text-sm ${
                isImmersive ? "hover:bg-card/80 cursor-pointer active:scale-[0.99] transition-all" : "cursor-default"
              }`}
              title={isImmersive ? "Click to rebroadcast room (immersive)" : undefined}
            >
              ROOM:{" "}
              {isImmersive && roomCode.length === 4 ? (
                <ColorCodeBalls code={roomCode} size={16} gap={4} className="ml-1" />
              ) : (
                <span className="text-accent font-bold tracking-widest">{roomCode}</span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs flex-wrap">

            {/* Map selector */}
            {devMode && (
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
            )}

            {/* Connection mode (hidden in immersive) */}
            {!isImmersive && (
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
            )}


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
          
          {/* ── Sliding lobby videos ── */}
          <LobbyVideoPanel
            src={assetUrl('/Animations/Game_Lobby_Intro.mp4')}
            side="left"
            label=" ▶ Press the button to switch game mode"
          />
          <LobbyVideoPanel
            src={assetUrl('/Animations/Game_Lobby_Char_plus_Props_Intro.mp4')}
            side="right"
          />
        </div>

        {/* Instructions */}
        <div className="text-center space-y-1">
          {playerCount === 0 ? (
            <p className="text-xs text-muted-foreground font-mono animate-pulse">
              Open <span className="text-secondary">/client</span> on phones · Room:{" "}
              {isImmersive && roomCode.length === 4 ? (
                <ColorCodeBalls code={roomCode} size={14} gap={4} className="ml-1" />
              ) : (
                <span className="text-accent font-bold">{roomCode}</span>
              )}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground font-mono">
              Starting in <span className="font-bold text-red-500">{autoStartRemainingSec}</span> sec.{" "}
              {isFull
                ? "All players ready!"
                : `Waiting for ${maxPlayers - playerCount} more player${maxPlayers - playerCount !== 1 ? "s" : ""}...`}
            </p>
          )}
        </div>

        <NetworkPerformancePanel
          players={players}
          onOpenChange={(open) => setPingDiagnosticsEnabled?.(open)}
        />
      </div>
    );
  }

  // ─── REVEAL ──────────────────────────────────────────────────────────────────
  if (phase === "reveal") {
    const revealElapsed = startClickAt ? (revealNow - startClickAt) / 1000 : 0;
    const revealSec = Math.max(1, 7 - Math.floor(revealElapsed));

    if (isImmersive) {
      return (
        <div className="relative flex flex-col items-center justify-center h-screen overflow-hidden bg-black">
          <GameMusic phase={phase} stage={snapshot?.stage ?? 0} broadcast={broadcast} />
          <div className="immersive-vignette" />
          {/* <div className="immersive-scanline-overlay" style={{ opacity: 0.4 }} /> */}
          {/* Edge pulse strips */}
              <div className="absolute inset-y-0 left-0 w-1 bg-orange-500/70 animate-pulse"
                  style={{ animationDuration: '1s' }} />
              <div className="absolute inset-y-0 right-0 w-1 bg-orange-500/70 animate-pulse"
                  style={{ animationDuration: '1s' }} />

          <div className="z-10 flex flex-col items-center gap-8">
            <h1
              className="text-3xl font-pixel text-primary tracking-[0.3em] immersive-fade-in"
              style={{ "--delay": "0s", textShadow: "0 0 40px hsl(var(--primary) / 0.8)" } as React.CSSProperties}
            >
              GET READY
            </h1>
            <p
              className="text-sm font-mono text-muted-foreground/60 tracking-widest immersive-fade-in"
              style={{ "--delay": "0.3s" } as React.CSSProperties}
            >
              ROLES REVEALING ON PHONES
            </p>
            <p className="text-xs font-mono text-muted-foreground/40">
              {Object.keys(assignments).length} player{Object.keys(assignments).length !== 1 ? "s" : ""} assigned
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 p-4 bg-background">
        <GameMusic phase={phase} stage={snapshot?.stage ?? 0} broadcast={broadcast} />
        <h1 className="text-2xl font-pixel text-primary text-glow-green tracking-widest animate-pulse">GET READY</h1>
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-mono text-muted-foreground">Roles are being revealed on each phone...</p>
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
    const countSec = Math.ceil(count);

    if (isImmersive) {
      return (
        <div className="relative flex flex-col items-center justify-center h-screen overflow-hidden bg-black">
          <GameMusic phase={phase} stage={snapshot?.stage ?? 0} broadcast={broadcast} />
          <video
            src={assetUrl("/Animations/Entrance_NEW.mp4")}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
          <div className="absolute inset-0 bg-black/30" />
          <div className="immersive-vignette z-10" />
          {/* <div className="immersive-scanline-overlay z-10" style={{ opacity: 0.35 }} /> */}
          <div className="z-20 flex flex-col items-center gap-3">
            <h1 className="text-2xl font-pixel text-primary tracking-[0.3em]">GAME STARTING</h1>
            <div
  key={countSec}
  className="text-[8rem] font-pixel text-accent leading-none host-countdown-pop"
  style={{ textShadow: "0 0 60px hsl(var(--accent) / 0.9), 0 0 120px hsl(var(--accent) / 0.4)" }}
>
  {countSec}
</div>
          </div>
        </div>
      );
    }

    return (
      <div className="relative flex flex-col items-center justify-center h-screen gap-4 p-4 overflow-hidden">
        <GameMusic phase={phase} stage={snapshot?.stage ?? 0} broadcast={broadcast} />
        <video
          src={assetUrl("/Animations/Entrance_NEW.mp4")}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />
        <div className="absolute inset-0 bg-black/35" />
        <h1 className="z-10 text-xl font-pixel text-primary text-glow-green">GAME STARTING</h1>
        <p className="z-10 text-sm font-mono text-muted-foreground">Entrance playing... {countSec}</p>
      </div>
    );
  }

  // ─── PLAYING / EXAM ──────────────────────────────────────────────────────────
  if ((phase === "playing" || phase === "exam") && snapshot) {
    if (phase === "exam" && (snapshot.examTransitionEndsAt ?? 0) > Date.now()) {
      return (
        <>
          <GameMusic phase={phase} stage={snapshot?.stage ?? 0} broadcast={broadcast} />
          <GameEndTransition variant="host" />
        </>
      );
    }
    const alivePlayers = Object.values(snapshot.players).filter((p) => p.alive);
    const isEventOverlay =
      !!snapshot.activeEvent &&
      (snapshot.activeEvent.type === "crossy-road" ||
        snapshot.activeEvent.type === "hitbox" ||
        snapshot.activeEvent.type === "mock-exam");
    const stageTransActiveForHide = snapshot.stageTransitionUntil > 0 && Date.now() < snapshot.stageTransitionUntil;
    const manualGrabBackForHide = !stageTransActiveForHide && grabBackUntil > Date.now();
    const isFinalExam = phase === "exam";
    const shouldHideOverlays =
      isEventOverlay || isFinalExam || isPaused || stageTransActiveForHide || manualGrabBackForHide;

    return (
      <div className="relative h-screen">
        <GameMusic phase={phase} stage={snapshot?.stage ?? 0} broadcast={broadcast} />
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
          immersive={isImmersive}
          themeMode={themeMode}
          hideOverlays={shouldHideOverlays}
          devMode={devMode}
        />

        {/* Focus camera panel toggle button */}
        <button
          onClick={() => setFocusPanelOpen((prev) => !prev)}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-30 w-10 h-6 rounded-full bg-card/90 border border-border flex items-center justify-center hover:bg-card transition-all"
          title="Toggle player cameras"
        >
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${focusPanelOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* Focus camera panel */}
        {focusPanelOpen && (
          <div className="absolute top-10 left-0 right-0 z-30 bg-card/95 border-b border-border p-2">
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
                                animState={
                                  p.frozen
                                    ? "Idle"
                                    : p.isAttacking || (p.isEagle && p.speedMultiplier >= 3)
                                      ? "Attack"
                                      : p.isMoving
                                        ? "Running"
                                        : "Idle"
                                }
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

        {/* Pause controls + Health display top-right */}
        {
          <div className="absolute top-2 right-2 z-50 flex flex-col gap-1 pointer-events-auto">
            <div className="flex gap-1 justify-end">
              {(snapshot.activeEvent || phase === "exam") && (
                <button
                  onClick={() => {
                    if (phase === "exam") hostSkipExam();
                    else hostSkipActiveEvent();
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-all border-destructive/60 bg-destructive/15 text-destructive hover:bg-destructive/25 opacity-100"
                  title="Skip current event/exam"
                >
                  SKIP
                </button>
              )}
              <button
                onClick={() => {
                  if (isPaused) {
                    setGrabBackUntil(Date.now() + 3000);
                    setTimeout(() => {
                      togglePause();
                      setIsPaused(false);
                      setGrabBackUntil(0);
                    }, 3000);
                  } else {
                    togglePause();
                    setIsPaused(true);
                  }
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-all opacity-100 ${
                  isPaused
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-border bg-card/80 text-muted-foreground hover:text-foreground"
                }`}
                title={isPaused ? "Resume game" : "Pause game"}
              >
                {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                {isPaused ? "PLAY" : "PAUSE"}
              </button>
              <button
                onClick={() => {
                  const v = toggleBotsPause();
                  setIsBotsPaused(v);
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-all opacity-100 ${
                  isBotsPaused
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-border bg-card/80 text-muted-foreground hover:text-foreground"
                }`}
                title={isBotsPaused ? "Resume bots" : "Pause bots"}
              >
                <Bot className="w-3 h-3" />
                {isBotsPaused ? "BOTS ▶" : "BOTS ⏸"}
              </button>
            </div>
            <HealthDisplay players={snapshot.players} />
          </div>
        }

        {/* PAUSED overlay — manual pause OR stage transition pause OR grab-back after resume */}
        {(() => {
          const stageTransActive = snapshot.stageTransitionUntil > 0 && Date.now() < snapshot.stageTransitionUntil;
          const stageTransRemainMs = stageTransActive ? snapshot.stageTransitionUntil - Date.now() : 0;
          const isGrabBackPhase = stageTransActive && stageTransRemainMs <= STAGE_READY_COUNTDOWN_MS;
          const isInstructionPhase = stageTransActive && !isGrabBackPhase;
          const manualGrabBack = !stageTransActive && grabBackUntil > Date.now();
          const showOverlay = isPaused || stageTransActive || manualGrabBack;
          if (!showOverlay) return null;

          const grabBackSec = isGrabBackPhase
            ? Math.ceil(stageTransRemainMs / 1000)
            : manualGrabBack
              ? Math.ceil((grabBackUntil - Date.now()) / 1000)
              : 0;

          return (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm pointer-events-none">
              <div className="flex flex-col items-center gap-3">
                {isInstructionPhase ? null : isGrabBackPhase || manualGrabBack ? (
                  <>
                    <span className="text-4xl">🎮</span>
                    <span
                      className="text-3xl font-pixel text-destructive tracking-widest animate-pulse"
                      style={{ textShadow: "0 0 30px hsl(var(--destructive) / 0.6)" }}
                    >
                      GRAB YOUR CONTROLS!
                    </span>
                    <span className="text-sm font-mono text-muted-foreground">Resuming in...</span>
                    <span className="text-5xl font-pixel text-primary animate-pulse">{grabBackSec}</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-20 h-20 text-accent" />
                    <span
                      className="text-5xl font-pixel text-accent tracking-[0.3em]"
                      style={{ textShadow: "0 0 40px hsl(var(--accent) / 0.8)" }}
                    >
                      PAUSED
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* Stage progress bottom */}
        <StageProgressBar currentStage={snapshot.stage} stageLabel={snapshot.stageLabel} />

        {/* Game time — click to toggle total vs play time */}
        {
          <div
            className="absolute top-2 left-2 z-10 px-3 py-1 rounded bg-card/80 border border-border font-mono text-xs cursor-pointer select-none"
            style={{ color: showPlayTime ? "hsl(0 80% 55%)" : "hsl(var(--muted-foreground))" }}
            onClick={() => setShowPlayTime((p) => !p)}
            title={showPlayTime ? "Play time (excluding pauses) — click for total" : "Total time — click for play time"}
          >
            ⏱{" "}
            {showPlayTime
              ? `${Math.floor(snapshot.gameTime - snapshot.totalPauseMs / 1000)}s`
              : `${Math.floor(snapshot.gameTime)}s`}
          </div>
        }
        <button
          onClick={() => setSettingsPanelOpen((p) => !p)}
          className="absolute top-2 left-20 z-10 px-2 py-1 rounded border border-border bg-card/90 hover:bg-card text-muted-foreground"
          title="Toggle settings panel"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
        {showDebugControls && (
          <button
            onClick={exportDebugLog}
            className="absolute top-2 left-[6.5rem] z-10 py-1 rounded border border-border bg-card/90 hover:bg-card text-muted-foreground px-[8px] mx-[13px]"
            title="Download host debug log"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        )}

        {settingsPanelOpen && <div className="absolute left-2 top-12 z-10 px-2 py-2 rounded bg-card/85 border border-border w-44">
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
            <span>Zoom</span>
            <span>{zoomLevel.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.7}
            max={1.5}
            step={0.025}
            value={zoomLevel}
            onChange={(e) => setZoomLevel(Number(e.target.value))}
            className="w-full"
          />

          {/* Light mode torch */}
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => setThemeMode((p) => (p === "semi" ? "light" : p === "light" ? "dark" : "semi"))}
              className={`flex items-center gap-1 text-[10px] font-mono transition-colors ${themeMode === "light" ? "text-yellow-400" : themeMode === "semi" ? "text-blue-300" : "text-muted-foreground hover:text-foreground"}`}
              title="Cycle theme: Semi-Light → Light → Dark"
            >
              <Sun className="w-3 h-3" />
              {themeMode === "semi" ? "Semi" : themeMode === "light" ? "Light" : "Dark"}
            </button>
          </div>

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

          {showDebugControls && (
            <div className="mt-2 flex items-center justify-between">
              <button
                onClick={() => gameLogger.downloadLogs()}
                className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                title="Download action log (for debugging)"
              >
                📋 Logs
              </button>
            </div>
          )}
        </div>}

        {/* Eagle awake countdown */}
        {!snapshot.eagleAwake && (
          <div className="absolute left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded bg-destructive/20 border border-destructive/50 font-mono text-xs text-destructive animate-pulse top-12">
            🦅 Eagle awakens in {Math.max(0, Math.ceil(5 - snapshot.gameTime))}s
          </div>
        )}

        {/* Exam helper layer on host — full-screen portal like mock exam */}
        {snapshot.examState &&
          snapshot.examState.questionNum > 0 &&
          phase === "exam" &&
          snapshot.examState.hostDisplayLayer !== "none" &&
          createPortal(
            <div className="fixed inset-0 flex items-center justify-center bg-white" style={{ zIndex: 9998 }}>
              <div className="flex flex-col items-center gap-4 max-w-2xl w-full px-6">
                <div className="flex items-center justify-between w-full">
                  <h2 className="text-lg font-pixel text-gray-800">📝 FINAL EXAM</h2>
                  <span className="font-mono text-lg font-bold text-gray-800">
                    {Math.ceil(snapshot.examState.timeRemaining)}s
                  </span>
                </div>
                <div className="w-full border-2 border-gray-300 rounded-xl overflow-hidden bg-white shadow-lg">
                  <img
                    src={assetUrl(
                      `/PW/PW_Final_${snapshot.examState.questionNum}_layer-${snapshot.examState.hostDisplayLayer}.png`,
                    )}
                    alt="Final exam layer"
                    className="w-full"
                  />
                </div>
                <p className="text-xs font-mono text-gray-500">Players check their phones for another layer!</p>
              </div>
            </div>,
            document.body,
          )}

        {/* Active event overlay */}
        {snapshot.activeEvent && (
          <EventOverlay event={snapshot.activeEvent} players={snapshot.players} gameMode={gameMode} />
        )}

        <NetworkPerformancePanel
          players={players}
          onOpenChange={(open) => setPingDiagnosticsEnabled?.(open)}
        />

        {/* Stage transition toast — slides in from right under game timer */}
        {stageToast && (
          <StageTransition
            key={stageToast.key}
            stage={stageToast.stage as 0 | 1 | 2 | 3}
            onDismiss={dismissStageToast}
            immersive={isImmersive}
          />
        )}

        {/* Stage transition video overlay (host only) */}
        {/* Stage transition video overlay (host only) */}
        <VideoOverlay
          video={hostStageTransitionVideo}
          onComplete={() => {
            if (hostStageTransitionVideo === 'eagle-warning') {
              if (activeStageTransitionKey) setDismissedStageTransitionKey(activeStageTransitionKey);
              setEagleWarningDone(true);
            } else {
              if (activeStageTransitionKey) setDismissedStageTransitionKey(activeStageTransitionKey);
            }
          }}
          placement="center"
          showBackdrop={false}
          showSkipButton={devMode}
        />

        {/* Follow-up: Stage 2 transition after eagle warning */}
        {eagleWarningDone && (
          <VideoOverlay
            video="stage1-transition"
            onComplete={() => {
              setEagleWarningDone(false);
              if (activeStageTransitionKey) setDismissedStageTransitionKey(activeStageTransitionKey);
            }}
            placement="center"
            showBackdrop={false}
            showSkipButton={devMode}
          />
        )}

        {/* VideoOverlay LAST so it renders on top of everything */}
        <VideoOverlay video={videoPlaying} onComplete={onVideoComplete} showSkipButton={devMode} />

        {/* Replay countdown overlay (after video, before game resumes) */}
        {snapshot.replayCountdown && (
          <ReplayCountdownOverlay
            replayData={snapshot.replayCountdown.replayData}
            secondsLeft={snapshot.replayCountdown.secondsLeft}
          />
        )}
      </div>
    );
  }

  // ─── GAME OVER / TRANSCRIPT ──────────────────────────────────────────────────
  if (phase === "gameover" && gameOverSnapshot) {
    return (
      <>
        <GameMusic phase={phase} stage={snapshot?.stage ?? 0} broadcast={broadcast} />
        <GameOverCeremony snapshot={gameOverSnapshot} gameMode={gameMode} />
      </>
    );
  }

  return <div className="flex items-center justify-center h-screen text-muted-foreground font-mono">Loading...</div>;
}

function CreditButton() {
  const [countdown, setCountdown] = useState(60);
  const [watching, setWatching] = useState(false);
  const [canSkip, setCanSkip] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0 || watching) return;
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [countdown, watching]);

  // Auto-play when countdown hits 0
  useEffect(() => {
    if (countdown <= 0 && !watching) setWatching(true);
  }, [countdown, watching]);

  // Enable skip after 10s of video
  useEffect(() => {
    if (!watching) return;
    const id = setTimeout(() => setCanSkip(true), 10000);
    return () => clearTimeout(id);
  }, [watching]);

  // Spacebar: start video or skip if allowed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!watching) {
          setWatching(true);
        } else if (canSkip) {
          window.location.href = "/";
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [watching, canSkip]);

  if (watching) {
    return (
      <VideoOverlay
        video="credits"
        onComplete={() => { window.location.href = "/"; }}
        fullscreen={true}
        showBackdrop={true}
        showSkipButton={false}
      />
    );
  }

  const sec = countdown.toString().padStart(2, '0');

  return (
    <button
      onClick={() => setWatching(true)}
      className="px-8 py-3 rounded-lg border-2 font-pixel text-sm tracking-widest transition-all border-primary bg-primary/10 text-primary hover:bg-primary/20 hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
    >
      Press to watch credits ({sec})
    </button>
  );
}

// ─── Game Over Ceremony Component ──────────────────────────────────────────────
function GameOverCeremony({ snapshot, gameMode }: { snapshot: GameStateSnapshot; gameMode: string }) {
  const { isImmersive } = useImmersive();
  const [ceremonyPhase, setCeremonyPhase] = useState<"mvp" | "team" | "transcript">("mvp");
  const [showPlayAgain, setShowPlayAgain] = useState(false);

  useEffect(() => {
    if (ceremonyPhase === 'transcript') {
      const id = setTimeout(() => setShowPlayAgain(true), 5000);
      return () => clearTimeout(id);
    } else {
      setShowPlayAgain(false);
    }
  }, [ceremonyPhase]);

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

  const winningTeamPlayers = sorted.filter(
    (p) => (winner === "eagle" && p.isEagle) || (winner === "chicks" && !p.isEagle),
  );

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

  useEffect(() => {
    if (!mvp) {
      setCeremonyPhase("transcript");
    } else {
      setCeremonyPhase("mvp");
    }
  }, [mvp]);

  const mvpColor = mvp ? PLAYER_COLORS[mvp.colorIndex] : null;
  const teamName =
    winner === "eagle"
      ? gameMode === "2v6"
        ? "🦅 GPA Killers Win!"
        : "🦅 GPA Killer Wins!"
      : winner === "chicks"
        ? "🐤 Fire Chicks Win!"
        : "🤝 Draw!";

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
  if (ceremonyPhase === "mvp") {
    // Safety check for mvp undefined
    if (!mvp) {
      console.log('[GameOverCeremony] MVP is undefined, skipping to transcript');
      setCeremonyPhase("transcript");
      return null;
    }
    return (
      <div
        className={`flex flex-col items-center justify-center h-screen gap-6 overflow-hidden relative ${isImmersive ? "bg-black" : "bg-background"}`}
      >
        {isImmersive && <CeremonyParticles />}
        {isImmersive && <div className="immersive-vignette" />}
        <h1
          className={`text-2xl font-pixel text-accent tracking-widest z-10 ${isImmersive ? "immersive-fade-in ceremony-title-glow" : "text-glow-green animate-pulse"}`}
          style={isImmersive ? ({ "--delay": "0.3s" } as React.CSSProperties) : undefined}
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
        <div
          className={`flex items-center gap-3 px-6 py-3 rounded-xl border-2 border-accent z-10 ${isImmersive ? "bg-accent/10 immersive-border-breathe" : "bg-accent/20"}`}
        >
          <Trophy className="w-6 h-6 text-accent" />
          {isImmersive ? (
            <>
              <span
                className="text-2xl font-pixel mvp-name-reveal"
                style={
                  { color: mvpColor ? `hsl(${mvpColor.hsl})` : undefined, "--delay": "1.1s" } as React.CSSProperties
                }
              >
                {mvpColor?.name ?? "?"}
              </span>
              <span
                className="text-sm font-mono text-accent/70 mvp-name-reveal"
                style={{ "--delay": "1.5s" } as React.CSSProperties}
              >
                {mvp.actionScore.toFixed(0)} pts
              </span>
            </>
          ) : (
            <>
              <span className="text-lg font-pixel" style={{ color: mvpColor ? `hsl(${mvpColor.hsl})` : undefined }}>
                {mvpColor?.name ?? "?"}
              </span>
              <span className="text-sm font-mono text-muted-foreground">Score: {mvp.actionScore.toFixed(0)}</span>
            </>
          )}
        </div>
        <p
          className={`text-sm font-mono text-muted-foreground z-10 ${isImmersive ? "immersive-fade-in" : ""}`}
          style={isImmersive ? ({ "--delay": "1.4s" } as React.CSSProperties) : undefined}
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
      <div
        className={`flex flex-col items-center justify-center h-screen gap-6 overflow-hidden relative ${isImmersive ? "bg-black" : "bg-background"}`}
      >
        {isImmersive && <CeremonyParticles />}
        {isImmersive && <div className="immersive-vignette" />}
        <h1
          className={`text-2xl font-pixel tracking-widest z-10 ${isImmersive ? "immersive-fade-in ceremony-title-glow" : ""}`}
          style={{
            color: winner === "eagle" ? "hsl(0 80% 55%)" : "hsl(145 80% 50%)",
            ...(isImmersive ? ({ "--delay": "0.2s" } as React.CSSProperties) : {}),
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
            {isImmersive && (
              <spotLight position={[0, 8, 3]} angle={0.6} penumbra={0.9} intensity={2.5} color="#ffd700" />
            )}
            <group position={[0, -1.8, 0]}>
              {winningTeamPlayers.map((p, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const rowOffset = rows > 1 ? (row % 2 === 0 ? -0.8 : 0.8) : 0;
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
        <p
          className={`text-sm font-mono text-muted-foreground z-10 ${isImmersive ? "immersive-fade-in" : ""}`}
          style={isImmersive ? ({ "--delay": "0.8s" } as React.CSSProperties) : undefined}
        >
          🎉 Congratulations!
        </p>
      </div>
    );
  }

  // Phase 3: 3D lineup sits in upper half with feet just above viewport mid (bottom of canvas ~48–50vh)
  const count = sorted.length;
  const cols = Math.min(4, count);
  const rows = Math.ceil(count / cols);
  const spacingX = Math.min(3.2, 14 / cols);
  const spacingZ = 2.6;
  return (
    <div className={`flex flex-col h-screen overflow-hidden relative ${isImmersive ? "bg-black" : "bg-background"}`}>
      {isImmersive && <CeremonyParticles />}
      {isImmersive && <div className="immersive-vignette" />}
      <div className="h-[50vh] min-h-0 w-full relative flex flex-col justify-end pb-4 shrink-0">
        <div className="flex-1 min-h-0 w-full relative">
          <div className="absolute top-3 left-0 right-0 z-10 text-center pointer-events-none">
            <p className="text-xs sm:text-sm font-mono text-muted-foreground italic px-6">
              "In this game, your value was calculated by your actions. Sound familiar?"
            </p>
          </div>
          <Canvas
            className="h-full w-full"
            style={{ width: "100%", height: "100%" }}
            camera={{ position: [0, 1.8, 6 + rows * 2.2], fov: 45 }}
          >
            <ambientLight intensity={isImmersive ? 0.3 : 0.8} />
            <directionalLight position={[5, 8, 5]} intensity={isImmersive ? 1.4 : 1.2} />
            {isImmersive && <spotLight position={[0, 8, 3]} angle={0.6} penumbra={0.9} intensity={2} color="#ffd700" />}
            <group position={[0, -2.4, (rows - 1) * spacingZ * 0.5]}>
              {sorted.map((p, i) => {
                const isWin = getMatchResult(p) !== "lose";
                const col = i % cols;
                const row = Math.floor(i / cols);
                const rowOffset = rows > 1 ? (row % 2 === 0 ? -0.8 : 0.8) : 0;
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

        <div className={`flex-1 min-h-0 p-3 sm:p-4 overflow-auto relative ${isImmersive ? "transcript-grid-bg" : ""}`}>
          <h2
            className={`text-center text-sm font-pixel mb-3 tracking-widest ${isImmersive ? "text-accent ceremony-title-glow" : "text-foreground"}`}
          >
            📋 TRANSCRIPT
          </h2>
          <div className="w-full max-w-3xl mx-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="py-2 text-left pl-2">Player</th>
                  <th className="py-2 text-center">Grade</th>
                  <th className="py-2 text-center">Survival</th>
                  <th className="py-2 text-center">Damage</th>
                  <th className="py-2 text-center">Action Score</th>
                  <th className="py-2 text-center">Result</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, idx) => {
                  const color = PLAYER_COLORS[p.colorIndex];
                  const letter = gradeToLetter(p.health);
                  const gradeColor = getGradeColor(p.health);
                  const result = getMatchResult(p);

                  return (
                    <tr
                      key={p.connId}
                      className={`border-b border-border/40 hover:bg-card/30 ${isImmersive ? "ceremony-row-reveal" : ""}`}
                      style={
                        isImmersive ? ({ "--row-delay": `${0.3 + idx * 0.15}s` } as React.CSSProperties) : undefined
                      }
                    >
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
                        {p.isEagle ? (
                          <span className="text-lg text-muted-foreground font-sans font-bold">N/A</span>
                        ) : isImmersive ? (
                          <span
                            className="text-2xl font-bold ceremony-grade-bounce"
                            style={
                              {
                                color: gradeColor,
                                "--grade-delay": `${0.3 + idx * 0.15 + 0.2}s`,
                              } as React.CSSProperties
                            }
                          >
                            {letter}
                          </span>
                        ) : (
                          <span className="text-2xl font-bold" style={{ color: gradeColor }}>
                            {letter}
                          </span>
                        )}
                        {!p.isEagle && (
                          <span className="text-[9px] text-muted-foreground block">{p.health.toFixed(1)}</span>
                        )}
                      </td>
                      <td className="py-2 text-center text-muted-foreground">{Math.floor(p.survivalTime)}s</td>
                      <td className="py-2 text-center text-muted-foreground">
                        {p.isEagle ? `+${p.damageDealt.toFixed(1)}` : `-${p.damageTaken.toFixed(1)}`}
                      </td>
                      <td className="py-2 text-center text-foreground font-bold">
                        <span className="inline-flex items-center gap-1">
                          {p.actionScore.toFixed(0)}
                          <ScoreBreakdownModal player={p} />
                        </span>
                      </td>
                      <td className="py-2 text-center">
                        {result === "draw" ? (
                          <span
                            className={`text-yellow-400 font-bold ${isImmersive ? "ceremony-grade-bounce" : ""}`}
                            style={
                              isImmersive
                                ? ({ "--grade-delay": `${0.5 + idx * 0.15}s` } as React.CSSProperties)
                                : undefined
                            }
                          >
                            DRAW
                          </span>
                        ) : result === "win" ? (
                          <span
                            className={`text-primary font-bold ${isImmersive ? "ceremony-grade-bounce" : ""}`}
                            style={
                              isImmersive
                                ? ({ "--grade-delay": `${0.5 + idx * 0.15}s` } as React.CSSProperties)
                                : undefined
                            }
                          >
                            WIN
                          </span>
                        ) : (
                          <span
                            className={`text-destructive ${isImmersive ? "ceremony-grade-bounce" : ""}`}
                            style={
                              isImmersive
                                ? ({ "--grade-delay": `${0.5 + idx * 0.15}s` } as React.CSSProperties)
                                : undefined
                            }
                          >
                            LOSE
                          </span>
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
          {showPlayAgain ? (
            <CreditButton />
          ) : (
            <p className="text-xs font-mono text-muted-foreground animate-pulse">Loading results...</p>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Game Music (exact spec) ──────────────────────────────────────────────────
function GameMusic({ phase, stage, broadcast }: { phase: string; stage: number; broadcast: (msg: any) => void }) {
  // Audio elements
  const arrivalRef = useRef<HTMLAudioElement | null>(null);
  const wingsRef = useRef<HTMLAudioElement | null>(null);
  const oompaRef = useRef<HTMLAudioElement | null>(null);
  const goodGuysRef = useRef<HTMLAudioElement | null>(null);

  // Timers and fade handles
  const transitionTimerRef = useRef<number | null>(null);
  const fadeFrameRef = useRef<number | null>(null);
  const goodGuysStopTimerRef = useRef<number | null>(null);

  // Current state
  const currentTrackRef = useRef<string | null>(null);
  const stage1CompletedRef = useRef(false); // Prevents Wings from playing again at Stage 2
  const stage3CompletedRef = useRef(false);

  const cancelTransitions = useCallback(() => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (fadeFrameRef.current) {
      cancelAnimationFrame(fadeFrameRef.current);
      fadeFrameRef.current = null;
    }
  }, []);

  const stopAndReset = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
  }, []);

  const stopAll = useCallback(() => {
    cancelTransitions();
    stopAndReset(arrivalRef.current);
    stopAndReset(wingsRef.current);
    stopAndReset(oompaRef.current);
    stopAndReset(goodGuysRef.current);
    currentTrackRef.current = null;
  }, [cancelTransitions, stopAndReset]);

  // Initialize audio
  useEffect(() => {
    arrivalRef.current = new Audio(assetUrl('/Music/Arrival_in_the_Shallows.m4a'));
    wingsRef.current = new Audio(assetUrl('/Music/Under_the_Wings.m4a'));
    oompaRef.current = new Audio(assetUrl('/Music/Oompa_Until_You_Croak.mp3'));
    goodGuysRef.current = new Audio(assetUrl('/Music/The_Good_Guys.mp3'));

    if (arrivalRef.current) arrivalRef.current.loop = true;
    if (oompaRef.current) oompaRef.current.loop = true;
    if (wingsRef.current) wingsRef.current.loop = false;
    if (goodGuysRef.current) goodGuysRef.current.loop = false;

    return () => {
      cancelTransitions();
      if (goodGuysStopTimerRef.current) clearTimeout(goodGuysStopTimerRef.current);
      [arrivalRef, wingsRef, oompaRef, goodGuysRef].forEach(ref => {
        if (ref.current) {
          ref.current.pause();
          ref.current.src = '';
          ref.current = null;
        }
      });
    };
  }, [cancelTransitions]);

  // Start Arrival (loop)
  const startArrival = useCallback(() => {
    if (currentTrackRef.current === 'arrival') return;
    stopAll();
    const a = arrivalRef.current;
    if (a) {
      a.currentTime = 0;
      a.volume = 1;
      a.play().catch(console.warn);
      currentTrackRef.current = 'arrival';
    }
  }, [stopAll]);

  // Stage 1: Wings 5s → crossfade to Oompa (only runs once)
  const startStage1 = useCallback(() => {
    if (stage1CompletedRef.current) return;
    if (currentTrackRef.current === 'oompa') return;
    
    stopAll();
    stage1CompletedRef.current = true;

    const wings = wingsRef.current;
    const oompa = oompaRef.current;
    if (!wings || !oompa) return;

    wings.currentTime = 0;
    wings.volume = 1;
    wings.play().catch(console.warn);
    currentTrackRef.current = 'wings';

    transitionTimerRef.current = window.setTimeout(() => {
      oompa.currentTime = 0;
      oompa.volume = 0;
      oompa.play().catch(console.warn);

      const startWingsVol = wings.volume;
      const startTime = performance.now();
      const duration = 3000;
      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        wings.volume = startWingsVol * (1 - t);
        oompa.volume = t;
        if (t < 1) {
          fadeFrameRef.current = requestAnimationFrame(step);
        } else {
          wings.pause();
          wings.currentTime = 0;
          oompa.volume = 1;
          currentTrackRef.current = 'oompa';
          fadeFrameRef.current = null;
        }
      };
      fadeFrameRef.current = requestAnimationFrame(step);
      transitionTimerRef.current = null;
    }, 5000);
  }, [stopAll]);

  // Stage 3: Crossfade Oompa → Wings (Wings plays once, no fade out)
  const startStage3 = useCallback(() => {
    if (stage3CompletedRef.current) return;
    if (currentTrackRef.current === 'wings-final') return;
    
    cancelTransitions();
    stage3CompletedRef.current = true;

    const oompa = oompaRef.current;
    const wings = wingsRef.current;
    if (!oompa || !wings) return;

    wings.currentTime = 0;
    wings.volume = 0;
    wings.play().catch(console.warn);

    const startOompaVol = oompa.volume;
    const startTime = performance.now();
    const duration = 3000;
    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      oompa.volume = startOompaVol * (1 - t);
      wings.volume = t;
      if (t < 1) {
        fadeFrameRef.current = requestAnimationFrame(step);
      } else {
        oompa.pause();
        oompa.currentTime = 0;
        wings.volume = 1;
        currentTrackRef.current = 'wings-final';
        fadeFrameRef.current = null;
        // Wings plays once and stops naturally
      }
    };
    fadeFrameRef.current = requestAnimationFrame(step);
  }, [cancelTransitions]);

  // Exam: Good Guys (41s play, 5s fade out) - does NOT get stopped by gameover
  const startGoodGuys = useCallback(() => {
    if (currentTrackRef.current === 'goodguys') return;
    
    // Don't stop other music? Actually spec says it plays alone, so stop others
    cancelTransitions();
    stopAndReset(arrivalRef.current);
    stopAndReset(wingsRef.current);
    stopAndReset(oompaRef.current);
    
    const good = goodGuysRef.current;
    if (!good) return;
    good.currentTime = 0;
    good.volume = 1;
    good.play().catch(console.warn);
    currentTrackRef.current = 'goodguys';
    broadcast({ type: "play-music", track: "goodguys" });

    if (goodGuysStopTimerRef.current) clearTimeout(goodGuysStopTimerRef.current);
    goodGuysStopTimerRef.current = window.setTimeout(() => {
      if (good && currentTrackRef.current === 'goodguys') {
        const startVol = good.volume;
        const startTime = performance.now();
        const duration = 5000;
        const step = (now: number) => {
          const elapsed = now - startTime;
          const t = Math.min(1, elapsed / duration);
          good.volume = startVol * (1 - t);
          if (t < 1) {
            fadeFrameRef.current = requestAnimationFrame(step);
          } else {
            good.pause();
            good.currentTime = 0;
            if (currentTrackRef.current === 'goodguys') currentTrackRef.current = null;
            fadeFrameRef.current = null;
          }
        };
        fadeFrameRef.current = requestAnimationFrame(step);
      }
      goodGuysStopTimerRef.current = null;
    }, 41000);
  }, [cancelTransitions, stopAndReset, broadcast]);

  // Reset stage flags when leaving playing phase
  useEffect(() => {
    if (phase !== 'playing') {
      stage1CompletedRef.current = false;
      stage3CompletedRef.current = false;
    }
  }, [phase]);

  // Main effect
  useEffect(() => {
    // Lobby
    if (phase === 'lobby') {
      startArrival();
      return;
    }

    // Playing
    if (phase === 'playing') {
      if (stage === 0) {
        startArrival();
      } else if (stage === 1) {
        startStage1();
      } else if (stage === 2) {
        // Do NOTHING - Oompa should already be playing from stage 1
        // If Oompa isn't playing, something went wrong, but don't restart
      } else if (stage === 3) {
        startStage3();
      }
      return;
    }

    // Exam - Good Guys plays and should NOT be stopped by gameover
    if (phase === 'exam') {
      const timer = setTimeout(() => {
        startGoodGuys();
      }, 10000);
      return () => clearTimeout(timer);
    }

    // For reveal/countdown, stop all EXCEPT Good Guys (if playing)
    if (phase === 'reveal' || phase === 'countdown') {
      if (currentTrackRef.current !== 'goodguys') {
        stopAll();
      }
      return;
    }

    // For gameover, do NOT stop Good Guys if it's playing
    if (phase === 'gameover') {
      if (currentTrackRef.current !== 'goodguys') {
        stopAll();
      }
      return;
    }

    // Any other phase
    stopAll();
  }, [phase, stage, startArrival, startStage1, startStage3, startGoodGuys, stopAll]);

  return null;
}

const COUNTDOWN_DURATION_DISPLAY = 7;
