import { useState, useCallback, useEffect, useRef } from "react";
import { useClientRoom, useDiscoverRooms, type ConnectionMode } from "@/hooks/useGameRoom";
import { PLAYER_COLORS, EAGLE_COLOR_INDICES } from "@/lib/playerColors";
import { gradeToLetter, getGradeColor } from "@/lib/gradeSystem";
import Thumbstick from "@/components/Thumbstick";
import ColorPicker from "@/components/ColorPicker";
import CharacterReveal from "@/components/CharacterReveal";
import AttackButton from "@/components/AttackButton";
import PropsButton from "@/components/PropsButton";
import ScannerBox from "@/components/ScannerBox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { preloadAllAnimations } from "@/lib/preloadAssets";
import type { GamePhase, GameStateSnapshot, PropType, GameMode } from "@/lib/gameTypes";
import type { ChickColor } from "@/components/CharacterViewer";

export default function Client() {
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<ConnectionMode>("webrtc");
  const {
    connected, connect, sendJoystick, disconnect, colorIndex,
    roomFull, kicked, setIdle, sendToHost, onHostMessage, requestColorSwap, usedColors,
  } = useClientRoom(code, mode);
  const discoveredRooms = useDiscoverRooms(mode);
  const [wasKicked, setWasKicked] = useState(false);
  const [roomFullDismissed, setRoomFullDismissed] = useState(false);

  // Game state received from host
  const [gamePhase, setGamePhase] = useState<GamePhase>('lobby');
  const [gameMode, setGameMode] = useState<GameMode>('1v3');
  const [myAssignment, setMyAssignment] = useState<{ colorIndex: number; isEagle: boolean; chickColor: ChickColor } | null>(null);
  const [gameState, setGameState] = useState<GameStateSnapshot | null>(null);
  const [isDead, setIsDead] = useState(false);
  const connIdRef = useRef<string>('');

  const playerColor = colorIndex >= 0 ? PLAYER_COLORS[colorIndex] : null;

  useEffect(() => { preloadAllAnimations(); }, []);

  useEffect(() => {
    if (kicked) setWasKicked(true);
  }, [kicked]);

  // Listen for host messages
  useEffect(() => {
    onHostMessage((msg: any) => {
      if (msg.type === 'game-mode') {
        setGameMode(msg.gameMode);
      } else if (msg.type === 'game-start') {
        const assigns = msg.assignments as Record<string, { colorIndex: number; isEagle: boolean; chickColor: ChickColor }>;
        // Find our assignment by matching our current colorIndex
        for (const [connId, assign] of Object.entries(assigns)) {
          if (assign.colorIndex === colorIndex) {
            connIdRef.current = connId;
            setMyAssignment({
              colorIndex: assign.colorIndex,
              isEagle: assign.isEagle,
              chickColor: assign.chickColor,
            });
            break;
          }
        }
        setGamePhase('reveal');
      } else if (msg.type === 'phase-change') {
        setGamePhase(msg.phase);
      } else if (msg.type === 'game-state') {
        setGameState(msg.state);
        if (msg.state?.phase) setGamePhase(msg.state.phase);
      } else if (msg.type === 'game-over') {
        setGamePhase('gameover');
      } else if (msg.type === 'you-died') {
        setIsDead(true);
      } else if (msg.type === 'color-update') {
        setMyAssignment({
          colorIndex: msg.colorIndex,
          isEagle: msg.isEagle ?? false,
          chickColor: PLAYER_COLORS[msg.colorIndex]?.chickColor ?? 'Red',
        });
      }
    });
  }, [onHostMessage, colorIndex]);

  // Find our player state from game snapshot
  const myState = gameState ? Object.values(gameState.players).find(
    (p) => p.colorIndex === (myAssignment?.colorIndex ?? colorIndex)
  ) : null;

  const isEagle = myAssignment?.isEagle ?? myState?.isEagle ?? false;
  const currentChickColor = myAssignment?.chickColor ?? playerColor?.chickColor ?? 'Red';
  const currentColorIndex = myAssignment?.colorIndex ?? colorIndex;

  const handleJoin = (roomCode?: string) => {
    const targetCode = roomCode || code;
    if (targetCode.length >= 4) {
      if (roomCode) setCode(roomCode);
      setWasKicked(false);
      setRoomFullDismissed(false);
      connect(roomCode);
    }
  };

  const handleMove = useCallback((x: number, y: number) => { sendJoystick({ x, y }); }, [sendJoystick]);
  const handleIdleChange = useCallback((idle: boolean) => { setIdle(idle); }, [setIdle]);

  const handleAttack = useCallback(() => { sendToHost({ type: 'attack-press' }); }, [sendToHost]);
  const handlePropUse = useCallback((propType: PropType) => { sendToHost({ type: 'prop-use', propType }); }, [sendToHost]);
  const handleHitboxClick = useCallback(() => { sendToHost({ type: 'hitbox-click' }); }, [sendToHost]);
  const handleScan = useCallback((data: string) => { sendToHost({ type: 'scan-result', data }); }, [sendToHost]);
  const handleColorSwap = useCallback((ci: number) => { requestColorSwap(ci); }, [requestColorSwap]);

  // ─── JOIN SCREEN ──────────────────────────────────
  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-8">
        <h1 className="text-lg text-secondary text-glow-purple tracking-wider text-center">JOIN GAME</h1>

        {wasKicked && (
          <div onClick={() => setWasKicked(false)} className="w-full max-w-xs px-4 py-3 rounded border border-destructive/50 bg-destructive/10 text-center cursor-pointer">
            <p className="text-sm font-mono text-destructive">DISCONNECTED BY HOST</p>
          </div>
        )}

        {roomFull && !roomFullDismissed && (
          <div onClick={() => setRoomFullDismissed(true)} className="w-full max-w-xs px-4 py-3 rounded border border-destructive/50 bg-destructive/10 text-center cursor-pointer">
            <p className="text-sm font-mono text-destructive">ROOM IS FULL</p>
          </div>
        )}

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            maxLength={6}
            className="text-center text-2xl tracking-[0.5em] font-pixel bg-card border-border h-14 uppercase"
          />
          <Button onClick={() => handleJoin()} disabled={code.length < 4} className="h-12 text-sm font-pixel bg-secondary hover:bg-secondary/80 text-secondary-foreground">
            CONNECT
          </Button>

          <div className="flex items-center justify-between px-2 py-3 rounded border border-border bg-card">
            <Label className="text-xs font-mono text-muted-foreground cursor-pointer">
              {mode === "webrtc" ? <span><span className="text-primary">WebRTC</span> — Same network</span> : <span><span className="text-secondary">Supabase</span> — Remote play</span>}
            </Label>
            <Switch checked={mode === "supabase"} onCheckedChange={(checked) => setMode(checked ? "supabase" : "webrtc")} />
          </div>

          {discoveredRooms.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-xs text-muted-foreground font-mono text-center">ACTIVE ROOMS</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {discoveredRooms.map((rc) => (
                  <Button key={rc} variant="outline" size="sm" onClick={() => { setCode(rc); handleJoin(rc); }} className="font-mono text-xs tracking-widest text-accent border-accent/30 hover:bg-accent/10">
                    {rc}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── REVEAL PHASE ─────────────────────────────────
  if (gamePhase === 'reveal') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-background">
        <CharacterReveal colorIndex={currentColorIndex} isEagle={isEagle} />
      </div>
    );
  }

  // ─── DEAD SCREEN ──────────────────────────────────
  if (isDead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <div className="text-8xl font-pixel text-destructive animate-pulse">F</div>
        <p className="text-lg font-mono text-destructive">ELIMINATED</p>
        <Button variant="outline" size="sm" onClick={disconnect} className="mt-4 text-xs font-mono text-destructive border-destructive/30">
          LEAVE
        </Button>
      </div>
    );
  }

  // ─── COUNTDOWN PHASE ─────────────────────────────
  if (gamePhase === 'countdown') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <h2 className="text-lg font-pixel text-primary text-glow-green">GET READY</h2>
        {gameState && (
          <div className="text-6xl font-pixel text-accent animate-pulse">
            {Math.ceil(gameState.countdownTime)}
          </div>
        )}
        <p className="text-xs font-mono text-muted-foreground">
          {isEagle ? 'You will awaken 5 seconds after the chicks' : 'You get a 5-second head start!'}
        </p>
      </div>
    );
  }

  // ─── GAME OVER ────────────────────────────────────
  if (gamePhase === 'gameover') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <h1 className="text-2xl font-pixel text-accent">GAME OVER</h1>
        {gameState && (
          <p className="text-lg font-pixel" style={{ color: gameState.winner === 'eagle' ? 'hsl(0 80% 55%)' : 'hsl(145 80% 50%)' }}>
            {gameState.winner === 'eagle' ? '🦅 Eagle Wins!' : '🐤 Chicks Win!'}
          </p>
        )}
        {myState && (
          <p className="text-sm font-mono" style={{ color: getGradeColor(myState.health) }}>
            Your Grade: {gradeToLetter(myState.health)}
          </p>
        )}
        <Button variant="outline" size="sm" onClick={disconnect} className="text-xs font-mono">LEAVE</Button>
      </div>
    );
  }

  // ─── GAMEPLAY CONTROLLER (LOBBY or PLAYING) ───────
  const displayColor = PLAYER_COLORS[currentColorIndex] ?? playerColor;

  return (
    <div className="flex flex-col items-center justify-between min-h-screen p-4 select-none">
      {/* Top section */}
      <div className="w-full flex flex-col items-center gap-2">
        {/* Status bar */}
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          {displayColor && (
            <div className="w-4 h-4 rounded-full" style={{
              backgroundColor: `hsl(${displayColor.hsl})`,
              boxShadow: `0 0 12px hsl(${displayColor.hsl} / 0.5)`,
            }} />
          )}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary glow-green" />
            CONNECTED
          </div>
          <span className="text-muted-foreground/50">({mode === "webrtc" ? "WebRTC" : "Supabase"})</span>
        </div>

        {/* Health display for playing phase */}
        {gamePhase === 'playing' && myState && (
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-card border border-border">
            <span className="text-sm font-bold font-mono" style={{ color: getGradeColor(myState.health) }}>
              {gradeToLetter(myState.health)}
            </span>
            <span className="text-[10px] text-muted-foreground">{myState.health.toFixed(1)}</span>
          </div>
        )}

        {/* Scanner / Hitbox for gameplay */}
        {gamePhase === 'playing' && !isEagle && (
          <div className="w-full max-w-xs">
            <ScannerBox onScan={handleScan} label="SCANNER" aspectRatio="873/457" />
          </div>
        )}
        {gamePhase === 'playing' && isEagle && (
          <button
            onClick={handleHitboxClick}
            className="w-full max-w-xs rounded border border-destructive/50 bg-destructive/10 flex items-center justify-center py-8 active:bg-destructive/20 transition-colors"
            style={{ aspectRatio: '873/457' }}
          >
            <span className="text-lg font-pixel text-destructive">HITBOX</span>
          </button>
        )}
      </div>

      {/* Middle: Thumbstick */}
      <div className="flex-shrink-0">
        <Thumbstick
          onMove={handleMove}
          onIdleChange={handleIdleChange}
          size={200}
          color={displayColor ? `hsl(${displayColor.hsl})` : undefined}
        />
      </div>

      {/* Bottom section */}
      <div className="w-full max-w-xs flex flex-col items-center gap-3">
        {/* Color picker (lobby only) */}
        {gamePhase === 'lobby' && (
          <ColorPicker
            currentColorIndex={colorIndex}
            usedColorIndices={usedColors}
            onColorSelect={handleColorSwap}
          />
        )}

        {/* Gameplay controls */}
        {gamePhase === 'playing' && (
          <div className="flex items-center justify-center gap-4 w-full">
            {!isEagle ? (
              <>
                {/* Social circle / Tips boxes */}
                <div className="flex gap-2 flex-1">
                  {myState && [0, 1].map((i) => {
                    const met = myState.socialCircleMet ?? [];
                    const tipHeld = myState.tips[i];
                    const socialDone = gameState && gameState.stage >= 1;
                    const isGreen = !socialDone ? (met.length > i) : false;

                    return (
                      <div
                        key={i}
                        className={`flex-1 h-14 rounded border flex items-center justify-center text-xs font-mono transition-all ${
                          tipHeld
                            ? 'border-accent bg-accent/20 text-accent'
                            : isGreen
                              ? 'border-primary bg-primary/20 text-primary'
                              : 'border-border bg-card text-muted-foreground'
                        }`}
                      >
                        {tipHeld ? `💡Tips ${i + 1}` : isGreen ? '✓' : `Box ${i + 1}`}
                      </div>
                    );
                  })}
                </div>
                {/* Props button */}
                <PropsButton items={myState?.props ?? []} onUse={handlePropUse} />
              </>
            ) : (
              <>
                {/* Eagle: Attack button + Props */}
                <AttackButton
                  onAttack={handleAttack}
                  cooldownUntil={myState?.attackCooldownUntil ?? 0}
                  disabled={myState?.frozen}
                />
                <PropsButton items={myState?.props ?? []} onUse={handlePropUse} />
              </>
            )}
          </div>
        )}

        {/* Role indicator with background */}
        {displayColor && (
          <div
            className="px-3 py-1.5 rounded-md"
            style={{
              backgroundColor: `hsl(${displayColor.hsl} / 0.15)`,
              border: `1px solid hsl(${displayColor.hsl} / 0.3)`,
            }}
          >
            <p className="text-xs font-mono text-foreground">
              You are <span className="font-bold" style={{ color: `hsl(${displayColor.hsl})` }}>{displayColor.name}</span>
              {isEagle ? ' 🦅' : ' 🐤'}
            </p>
          </div>
        )}

        <Button variant="outline" size="sm" onClick={disconnect} className="text-xs font-mono text-destructive border-destructive/30">
          DISCONNECT
        </Button>
      </div>
    </div>
  );
}
