import { useState, useCallback, useEffect, useRef } from "react";
import { useClientRoom, useDiscoverRooms, type ConnectionMode } from "@/hooks/useGameRoom";
import { PLAYER_COLORS, EAGLE_COLOR_INDICES } from "@/lib/playerColors";
import { gradeToLetter, getGradeColor } from "@/lib/gradeSystem";
import Thumbstick from "@/components/Thumbstick";
import ColorPicker from "@/components/ColorPicker";
import CharacterReveal from "@/components/CharacterReveal";
import AttackButton from "@/components/AttackButton";
import ScannerBox from "@/components/ScannerBox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { preloadAllAnimations } from "@/lib/preloadAssets";
import type { GamePhase, GameStateSnapshot, PropType, GameMode, PropItem } from "@/lib/gameTypes";
import type { ChickColor } from "@/components/CharacterViewer";
import QRCode from "react-qr-code";
import { Zap, Heart, Wind, Shield, ChevronUp } from "lucide-react";

// ─── Props Button (inline for compact layout) ──────────────────────────────────
const PROP_COLORS: Record<PropType, string> = {
  speed: "hsl(48 96% 53%)",
  heal: "hsl(145 80% 50%)",
  fly: "hsl(220 80% 55%)",
  invincible: "hsl(45 100% 55%)",
};
const PROP_ICONS: Record<PropType, React.ReactNode> = {
  speed: <Zap className="w-6 h-6" />,
  heal: <Heart className="w-6 h-6" />,
  fly: <Wind className="w-6 h-6" />,
  invincible: <Shield className="w-6 h-6" />,
};

function PropsBtn({ items, onUse }: { items: PropItem[]; onUse: (t: PropType) => void }) {
  const [selIdx, setSelIdx] = useState(0);
  const available = items.filter((i) => i.count > 0);
  const current = available[selIdx % Math.max(1, available.length)];
  const hasMultiple = available.length > 1;

  if (!current) {
    return (
      <div className="w-16 h-16 rounded-full border-2 border-muted bg-muted/20 flex items-center justify-center opacity-40">
        <Zap className="w-6 h-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center">
      {hasMultiple && (
        <button onClick={() => setSelIdx((i) => i + 1)} className="mb-1 text-muted-foreground hover:text-foreground">
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
      <button
        onClick={() => onUse(current.type)}
        className="relative w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all active:scale-90"
        style={{
          borderColor: PROP_COLORS[current.type],
          color: PROP_COLORS[current.type],
          boxShadow: `0 0 12px ${PROP_COLORS[current.type]}55`,
        }}
      >
        {PROP_ICONS[current.type]}
        <span
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center bg-card border"
          style={{ borderColor: PROP_COLORS[current.type], color: PROP_COLORS[current.type] }}
        >
          {current.count}
        </span>
      </button>
    </div>
  );
}

// ─── Hitbox button for eagle ───────────────────────────────────────────────────
function HitboxBtn({ onHit, inZone }: { onHit: () => void; inZone: boolean }) {
  return (
    <button
      onClick={onHit}
      className={`w-full rounded border flex items-center justify-center transition-all active:scale-95 ${
        inZone
          ? "border-destructive/70 bg-destructive/20 hover:bg-destructive/30 animate-pulse"
          : "border-border bg-card/50"
      }`}
      style={{ aspectRatio: "873/457" }}
    >
      <div className="flex flex-col items-center gap-1">
        <span className={`text-lg font-pixel ${inZone ? "text-destructive" : "text-muted-foreground"}`}>
          {inZone ? "⚡ HITBOX" : "HITBOX"}
        </span>
        {inZone && <span className="text-[10px] font-mono text-destructive/70">Tap to damage zone</span>}
      </div>
    </button>
  );
}

// ─── Tips Box ─────────────────────────────────────────────────────────────────
function TipsBox({
  tipIndex,
  stage,
  socialMet,
  totalNeeded,
  hasTip,
  isLoadingTip,
  qrCode,
  tipShareCooldownUntil,
  onTap,
}: {
  tipIndex: 0 | 1;
  stage: number;
  socialMet: number;
  totalNeeded: number;
  hasTip: boolean;
  isLoadingTip: boolean;
  qrCode: string | null;
  tipShareCooldownUntil: number;
  onTap: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  // Stage 0: Social circle indicator
  if (stage === 0) {
    const filled = socialMet > tipIndex;
    return (
      <div
        className={`flex-1 h-14 rounded border flex items-center justify-center text-xs font-mono transition-all ${
          filled ? "border-primary bg-primary/20 text-primary" : "border-border bg-card text-muted-foreground"
        }`}
      >
        {filled ? "✓ Met" : `Meet ${tipIndex + 1}`}
      </div>
    );
  }

  // Stage 1+: Tips box
  const onCooldown = now < tipShareCooldownUntil;
  const cooldownSec = Math.ceil(Math.max(0, tipShareCooldownUntil - now) / 1000);

  if (hasTip && qrCode) {
    // Showing QR code
    return (
      <button
        onClick={onTap}
        className="flex-1 h-auto rounded border-2 border-accent bg-accent/10 flex flex-col items-center justify-center p-1 gap-0.5 active:scale-95"
      >
        <span className="text-[9px] font-mono text-accent">💡 Tips {tipIndex + 1}</span>
        <div className="bg-white p-1 rounded">
          <QRCode value={qrCode} size={52} />
        </div>
        <span className="text-[8px] text-muted-foreground">Others scan this!</span>
      </button>
    );
  }

  if (hasTip) {
    return (
      <button
        onClick={!onCooldown ? onTap : undefined}
        className={`flex-1 h-14 rounded border-2 flex items-center justify-center text-xs font-mono transition-all active:scale-95 ${
          onCooldown
            ? "border-border bg-card/40 text-muted-foreground"
            : "border-accent bg-accent/20 text-accent hover:bg-accent/30"
        }`}
      >
        {onCooldown ? `⏳ ${cooldownSec}s` : `💡 Tips ${tipIndex + 1}`}
      </button>
    );
  }

  // Receiving tip loading
  if (isLoadingTip) {
    return (
      <div className="flex-1 h-14 rounded border border-secondary bg-secondary/10 flex items-center justify-center text-xs font-mono text-secondary animate-pulse">
        📋 Copying...
      </div>
    );
  }

  return (
    <div className="flex-1 h-14 rounded border border-border bg-card flex items-center justify-center text-xs font-mono text-muted-foreground">
      Tips {tipIndex + 1}
    </div>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────
export default function Client() {
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<ConnectionMode>("webrtc");
  const {
    connected,
    connect,
    sendJoystick,
    disconnect,
    colorIndex,
    roomFull,
    kicked,
    setIdle,
    sendToHost,
    onHostMessage,
    requestColorSwap,
    usedColors,
  } = useClientRoom(code, mode);
  const discoveredRooms = useDiscoverRooms(mode);

  const [wasKicked, setWasKicked] = useState(false);
  const [roomFullDismissed, setRoomFullDismissed] = useState(false);

  // Game state
  const [gamePhase, setGamePhase] = useState<GamePhase>("lobby");
  const [gameMode, setGameMode] = useState<GameMode>("1v3");
  const [myAssignment, setMyAssignment] = useState<{
    colorIndex: number;
    isEagle: boolean;
    chickColor: ChickColor;
  } | null>(null);
  const [gameState, setGameState] = useState<GameStateSnapshot | null>(null);
  const [isDead, setIsDead] = useState(false);
  const [colorChosen, setColorChosen] = useState(false);
  const connIdRef = useRef<string>("");

  // Event state
  const [eventAnswer, setEventAnswer] = useState("");

  // Tips state
  const [tipQrCodes, setTipQrCodes] = useState<[string | null, string | null]>([null, null]);
  const [loadingTip, setLoadingTip] = useState<[boolean, boolean]>([false, false]);

  // Exam state
  const [examLayer, setExamLayer] = useState<"1" | "2" | null>(null);
  const [examQuestionNum, setExamQuestionNum] = useState(0);
  const [examAnswer, setExamAnswer] = useState("");
  const [examZoom, setExamZoom] = useState(1);
  const [examOpacity, setExamOpacity] = useState(0.85);
  const examVideoRef = useRef<HTMLVideoElement>(null);
  const examStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    preloadAllAnimations();
  }, []);
  useEffect(() => {
    if (kicked) setWasKicked(true);
  }, [kicked]);

  // Auto-mark color chosen for 2v6 when all 8 slots taken
  useEffect(() => {
    if (gameMode === "2v6" && connected && colorIndex >= 0 && usedColors.size >= 8) {
      setColorChosen(true);
    }
  }, [gameMode, connected, colorIndex, usedColors]);

  // Host message handler
  useEffect(() => {
    onHostMessage((msg: any) => {
      if (msg.type === "game-mode") {
        setGameMode(msg.gameMode);
        setColorChosen(false);
      } else if (msg.type === "game-start") {
        const assigns = msg.assignments as Record<
          string,
          { colorIndex: number; isEagle: boolean; chickColor: ChickColor }
        >;
        for (const [connId, assign] of Object.entries(assigns)) {
          if (assign.colorIndex === colorIndex) {
            connIdRef.current = connId;
            setMyAssignment({ colorIndex: assign.colorIndex, isEagle: assign.isEagle, chickColor: assign.chickColor });
            break;
          }
        }
        setGamePhase("reveal");
      } else if (msg.type === "phase-change") {
        setGamePhase(msg.phase);
      } else if (msg.type === "game-state") {
        setGameState(msg.state);
        if (msg.state?.phase) setGamePhase(msg.state.phase);
      } else if (msg.type === "game-over") {
        setGamePhase("gameover");
      } else if (msg.type === "you-died") {
        if (msg.connId === connIdRef.current) setIsDead(true);
      } else if (msg.type === "tip-qr") {
        if (msg.forConnId === connIdRef.current) {
          setTipQrCodes((prev) => {
            const next: [string | null, string | null] = [...prev] as [string | null, string | null];
            next[msg.tipIndex as 0 | 1] = msg.code;
            return next;
          });
        }
      } else if (msg.type === "exam-start") {
        const myExam = msg.assignments?.[connIdRef.current];
        if (myExam && myExam.questionNum > 0) {
          setExamLayer(myExam.layer);
          setExamQuestionNum(myExam.questionNum);
          setExamAnswer("");
        }
        setGamePhase("exam");
      }
    });
  }, [onHostMessage, colorIndex]);

  // Watch for tips received (tips changed in game state)
  const prevTipsRef = useRef<[boolean, boolean]>([false, false]);
  useEffect(() => {
    if (!gameState) return;
    const myState = Object.values(gameState.players).find(
      (p) => p.colorIndex === (myAssignment?.colorIndex ?? colorIndex),
    );
    if (!myState) return;
    for (let i = 0; i < 2; i++) {
      if (!prevTipsRef.current[i] && myState.tips[i]) {
        // Just received this tip — show loading briefly
        setLoadingTip((prev) => {
          const n: [boolean, boolean] = [...prev] as [boolean, boolean];
          n[i] = true;
          return n;
        });
        setTimeout(() => {
          setLoadingTip((prev) => {
            const n: [boolean, boolean] = [...prev] as [boolean, boolean];
            n[i] = false;
            return n;
          });
        }, 3000);
      }
    }
    prevTipsRef.current = [...myState.tips] as [boolean, boolean];
  }, [gameState, myAssignment, colorIndex]);

  // Exam camera management
  useEffect(() => {
    if (gamePhase === "exam" && examLayer && examLayer !== null) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: { ideal: "environment" } } })
        .then((stream) => {
          examStreamRef.current = stream;
          if (examVideoRef.current) examVideoRef.current.srcObject = stream;
        })
        .catch(console.error);
    }
    return () => {
      examStreamRef.current?.getTracks().forEach((t) => t.stop());
      examStreamRef.current = null;
    };
  }, [gamePhase, examLayer]);

  const playerColor = colorIndex >= 0 ? PLAYER_COLORS[colorIndex] : null;
  const myState = gameState
    ? Object.values(gameState.players).find((p) => p.colorIndex === (myAssignment?.colorIndex ?? colorIndex))
    : null;
  const isEagle = myAssignment?.isEagle ?? myState?.isEagle ?? false;
  const currentColorIndex = myAssignment?.colorIndex ?? colorIndex;
  const displayColor = PLAYER_COLORS[currentColorIndex] ?? playerColor;
  const currentChickColor = myAssignment?.chickColor ?? playerColor?.chickColor ?? "Red";

  const handleMove = useCallback(
    (x: number, y: number) => {
      sendJoystick({ x, y });
    },
    [sendJoystick],
  );
  const handleIdleChange = useCallback(
    (idle: boolean) => {
      setIdle(idle);
    },
    [setIdle],
  );
  const handleAttack = useCallback(() => {
    sendToHost({ type: "attack-press" });
  }, [sendToHost]);
  const handlePropUse = useCallback(
    (t: PropType) => {
      sendToHost({ type: "prop-use", propType: t });
    },
    [sendToHost],
  );
  const handleHitboxClick = useCallback(() => {
    sendToHost({ type: "hitbox-click" });
  }, [sendToHost]);
  const handleScan = useCallback(
    (data: string) => {
      sendToHost({ type: "scan-result", data });
    },
    [sendToHost],
  );
  const handleTipTap = useCallback(
    (tipIndex: 0 | 1) => {
      // If already showing QR, close it
      if (tipQrCodes[tipIndex]) {
        setTipQrCodes((prev) => {
          const n: [string | null, string | null] = [...prev] as [string | null, string | null];
          n[tipIndex] = null;
          return n;
        });
        return;
      }
      sendToHost({ type: "tip-request", tipIndex });
    },
    [sendToHost, tipQrCodes],
  );
  const handleExamSubmit = useCallback(() => {
    if (examAnswer.trim()) {
      sendToHost({ type: "answer-submit", answer: examAnswer.trim() });
      setExamAnswer("");
    }
  }, [sendToHost, examAnswer]);
  const handleJoin = useCallback(
    (roomCode?: string) => {
      const target = roomCode || code;
      if (target.length >= 4) {
        if (roomCode) setCode(roomCode);
        setWasKicked(false);
        setRoomFullDismissed(false);
        setColorChosen(false);
        connect(roomCode);
      }
    },
    [code, connect],
  );

  // ── Eagle-in-zone detection (for hitbox visual cue)
  const isInZone =
    gameState && myState
      ? gameState.buildings.some(
          (b) =>
            b.zoneActive &&
            !b.tipObtained &&
            (() => {
              const dx = myState.position.x - b.position.x;
              const dz = myState.position.z - b.position.z;
              return Math.sqrt(dx * dx + dz * dz) < 4.0;
            })(),
        )
      : false;

  // ─── JOIN SCREEN ─────────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-8">
        <h1 className="text-lg text-secondary text-glow-purple tracking-wider text-center font-pixel">JOIN GAME</h1>

        {wasKicked && (
          <div
            onClick={() => setWasKicked(false)}
            className="w-full max-w-xs px-4 py-3 rounded border border-destructive/50 bg-destructive/10 text-center cursor-pointer"
          >
            <p className="text-sm font-mono text-destructive">DISCONNECTED BY HOST</p>
          </div>
        )}

        {roomFull && !roomFullDismissed && (
          <div
            onClick={() => setRoomFullDismissed(true)}
            className="w-full max-w-xs px-4 py-3 rounded border border-destructive/50 bg-destructive/10 text-center cursor-pointer"
          >
            <p className="text-sm font-mono text-destructive">ROOM IS FULL</p>
          </div>
        )}

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            maxLength={6}
            className="text-center text-2xl tracking-[0.5em] font-pixel bg-card border-border h-14 uppercase"
          />
          <Button
            onClick={() => handleJoin()}
            disabled={code.length < 4}
            className="h-12 text-sm font-pixel bg-secondary hover:bg-secondary/80 text-secondary-foreground"
          >
            CONNECT
          </Button>

          <div className="flex items-center justify-between px-2 py-3 rounded border border-border bg-card">
            <Label className="text-xs font-mono text-muted-foreground cursor-pointer">
              {mode === "webrtc" ? (
                <span>
                  <span className="text-primary">WebRTC</span> — Same network
                </span>
              ) : (
                <span>
                  <span className="text-secondary">Supabase</span> — Remote play
                </span>
              )}
            </Label>
            <Switch
              checked={mode === "supabase"}
              onCheckedChange={(checked) => setMode(checked ? "supabase" : "webrtc")}
            />
          </div>

          {discoveredRooms.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-xs text-muted-foreground font-mono text-center">ACTIVE ROOMS</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {discoveredRooms.map((rc) => (
                  <Button
                    key={rc}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCode(rc);
                      handleJoin(rc);
                    }}
                    className="font-mono text-xs tracking-widest text-accent border-accent/30 hover:bg-accent/10"
                  >
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

  // ─── 2V6 COLOR SELECTION ──────────────────────────────────────────────────────
  if (gameMode === "2v6" && !colorChosen && gamePhase === "lobby") {
    const dc = colorIndex >= 0 ? PLAYER_COLORS[colorIndex] : null;
    const isEagleColor = EAGLE_COLOR_INDICES.includes(colorIndex);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-6">
        <h1 className="text-lg text-accent tracking-wider text-center font-pixel">CHOOSE YOUR COLOR</h1>
        <p className="text-xs text-muted-foreground font-mono text-center">
          🦅 Red border = Eagle role • Pick carefully!
        </p>
        <ColorPicker
          currentColorIndex={colorIndex}
          usedColorIndices={usedColors}
          onColorSelect={requestColorSwap}
          gameMode={gameMode}
        />
        {dc && (
          <div
            className="px-4 py-2 rounded-md"
            style={{ backgroundColor: `hsl(${dc.hsl} / 0.15)`, border: `1px solid hsl(${dc.hsl} / 0.3)` }}
          >
            <p className="text-sm font-mono text-foreground">
              You are{" "}
              <span className="font-bold" style={{ color: `hsl(${dc.hsl})` }}>
                {dc.name}
              </span>
              {isEagleColor ? " 🦅 Eagle" : " 🐤 Chick"}
            </p>
          </div>
        )}
        <Button
          onClick={() => setColorChosen(true)}
          disabled={colorIndex < 0}
          className="h-12 px-8 text-sm font-pixel bg-primary hover:bg-primary/80 text-primary-foreground"
        >
          CONFIRM & ENTER LOBBY
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={disconnect}
          className="text-xs font-mono text-destructive border-destructive/30"
        >
          DISCONNECT
        </Button>
      </div>
    );
  }

  // ─── REVEAL ──────────────────────────────────────────────────────────────────
  if (gamePhase === "reveal") {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-background">
        <CharacterReveal colorIndex={currentColorIndex} isEagle={isEagle} />
      </div>
    );
  }

  // ─── DEAD ────────────────────────────────────────────────────────────────────
  if (isDead && gamePhase !== "gameover") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <div className="text-9xl font-pixel text-destructive" style={{ textShadow: "0 0 30px hsl(0 80% 55% / 0.8)" }}>
          F
        </div>
        <p className="text-xl font-mono text-destructive tracking-widest">ELIMINATED</p>
        <p className="text-xs text-muted-foreground font-mono">Better luck next time...</p>
        <Button
          variant="outline"
          size="sm"
          onClick={disconnect}
          className="mt-4 text-xs font-mono text-destructive border-destructive/30"
        >
          LEAVE
        </Button>
      </div>
    );
  }

  // ─── COUNTDOWN ───────────────────────────────────────────────────────────────
  if (gamePhase === "countdown") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <h2 className="text-lg font-pixel text-primary text-glow-green">GET READY</h2>
        {gameState && (
          <div className="text-7xl font-pixel text-accent animate-pulse">{Math.ceil(gameState.countdownTime)}</div>
        )}
        <p className="text-xs font-mono text-muted-foreground text-center max-w-xs px-4">
          {isEagle
            ? "🦅 You are the Eagle — you will awaken 5 seconds after the chicks"
            : "🐤 You get a 5-second head start!"}
        </p>
      </div>
    );
  }

  // ─── GAME OVER ───────────────────────────────────────────────────────────────
  if (gamePhase === "gameover") {
    const winner = gameState?.winner;
    const amWinner = (winner === "eagle" && isEagle) || (winner === "chicks" && !isEagle);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4">
        <h1 className="text-2xl font-pixel text-accent">GAME OVER</h1>
        {gameState && (
          <p
            className="text-lg font-pixel"
            style={{
              color:
                winner === "eagle" ? "hsl(0 80% 55%)" : winner === "chicks" ? "hsl(145 80% 50%)" : "hsl(45 100% 55%)",
            }}
          >
            {winner === "eagle" ? "🦅 Eagle Wins!" : winner === "chicks" ? "🐤 Chicks Win!" : "🤝 Draw!"}
          </p>
        )}
        {myState && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-4xl font-bold" style={{ color: getGradeColor(myState.health) }}>
              {gradeToLetter(myState.health)}
            </span>
            <span className="text-sm font-mono text-muted-foreground">Your final grade</span>
          </div>
        )}
        {amWinner && <p className="text-lg font-pixel text-primary text-glow-green">🎉 YOU WIN!</p>}
        <Button variant="outline" size="sm" onClick={disconnect} className="text-xs font-mono">
          LEAVE
        </Button>
      </div>
    );
  }

  // ─── ACTIVE EVENT PHASE ──────────────────────────────────────────────────────
  const activeEvent = gameState?.activeEvent;
  if (activeEvent && gamePhase === "playing") {
    const now = Date.now();
    const timeLeft = Math.max(0, Math.ceil((activeEvent.endAt - now) / 1000));

    if (activeEvent.phase === "countdown") {
      const cdSec = Math.max(1, 3 - Math.floor((now - activeEvent.startedAt) / 1000));
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h2 className="text-lg font-pixel text-accent">
            {activeEvent.type === "mock-exam" ? "📝 MOCK EXAM" : "👊 HITBOX CHALLENGE"}
          </h2>
          <div className="text-7xl font-pixel text-primary animate-pulse">{cdSec}</div>
        </div>
      );
    }

    if (activeEvent.phase === "active" && activeEvent.type === "hitbox") {
      return (
        <div className="flex flex-col items-center justify-between min-h-screen p-4">
          <div className="text-center">
            <h2 className="text-lg font-pixel text-accent">👊 HITBOX BATTLE</h2>
            <p className="text-2xl font-pixel text-primary">{timeLeft}s</p>
          </div>
          <button
            onClick={() => sendToHost({ type: "event-hitbox-click" })}
            className="w-48 h-48 rounded-full border-4 border-accent bg-accent/20 active:scale-90 transition-all flex items-center justify-center"
            style={{ boxShadow: "0 0 30px hsl(var(--accent) / 0.5)" }}
          >
            <span className="text-3xl font-pixel text-accent">HIT!</span>
          </button>
          <p className="text-xs font-mono text-muted-foreground">
            {isEagle ? "🦅 Eagle" : "🐤 Chick"} — tap as fast as you can!
          </p>
        </div>
      );
    }

    if (activeEvent.phase === "active" && activeEvent.type === "mock-exam") {
      return (
        <div className="flex flex-col min-h-screen p-4 gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-pixel text-accent">MOCK EXAM</h2>
            <span className="font-mono text-sm text-accent">{timeLeft}s</span>
          </div>
          {isEagle ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm font-mono text-muted-foreground text-center">
                🦅 Watch the host screen — layer 1 is displayed there!
              </p>
            </div>
          ) : (
            <>
              <img
                src={`/PW/PW_Mock_${activeEvent.questionNum}_layer-2.png`}
                alt="Mock exam layer 2"
                className="w-full rounded border border-border"
              />
              <div className="flex gap-2 mt-auto">
                <Input
                  placeholder="Answer..."
                  value={eventAnswer}
                  onChange={(e) => setEventAnswer(e.target.value.toUpperCase())}
                  className="flex-1 uppercase font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && eventAnswer.trim()) {
                      sendToHost({ type: "event-answer", answer: eventAnswer.trim() });
                      setEventAnswer("");
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    if (eventAnswer.trim()) {
                      sendToHost({ type: "event-answer", answer: eventAnswer.trim() });
                      setEventAnswer("");
                    }
                  }}
                  className="font-pixel text-xs"
                >
                  SUBMIT
                </Button>
              </div>
            </>
          )}
        </div>
      );
    }

    if (activeEvent.phase === "result") {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h2 className="text-xl font-pixel text-accent">EVENT RESULT</h2>
          <p
            className="text-2xl font-pixel"
            style={{ color: activeEvent.result === "chick" ? "hsl(145 80% 50%)" : "hsl(0 80% 55%)" }}
          >
            {activeEvent.result === "chick" ? "🐤 Chicks Win!" : "🦅 Eagle Wins!"}
          </p>
          <p className="text-xs font-mono text-muted-foreground">
            {activeEvent.result === "chick" ? "+2 grades!" : "-2 grades for chicks"}
          </p>
        </div>
      );
    }
  }

  // ─── EXAM PHASE ──────────────────────────────────────────────────────────────
  if (gamePhase === "exam") {
    // Eagle sees distract message
    if (isEagle) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-6">
          <div className="text-4xl">🦅</div>
          <p className="text-lg font-pixel text-destructive text-center">DISTRACT THE CHICKS!</p>
          <p className="text-sm font-mono text-muted-foreground text-center max-w-xs">
            The chicks are doing their exam now. Make noise, distract them in real life!
          </p>
          {gameState?.examState && (
            <div className="px-4 py-2 rounded border border-border font-mono text-sm text-muted-foreground">
              ⏱ {Math.ceil(gameState.examState.timeRemaining)}s remaining
            </div>
          )}
        </div>
      );
    }

    // No layer assigned — shouldn't happen but fallback
    if (!examLayer || examQuestionNum === 0) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-sm font-mono text-muted-foreground animate-pulse">Loading exam...</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col min-h-screen bg-background">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <span className="text-xs font-pixel text-muted-foreground">
            Layer {examLayer} {examLayer === "1" ? "(You have layer 1!)" : "(layer 2)"}
          </span>
          {gameState?.examState && (
            <span
              className={`text-sm font-bold font-mono ${gameState.examState.timeRemaining < 10 ? "text-destructive animate-pulse" : "text-accent"}`}
            >
              ⏱ {Math.ceil(gameState.examState.timeRemaining)}s
            </span>
          )}
        </div>

        {/* Camera + overlay */}
        <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: "873/457" }}>
          <video
            ref={examVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          <img
            src={`/PW/PW_Final_${examQuestionNum}_layer-${examLayer}.png`}
            alt={`Layer ${examLayer}`}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            style={{ opacity: examOpacity, transform: `scale(${examZoom})`, transformOrigin: "center center" }}
          />
        </div>

        {/* Sliders */}
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground w-14 shrink-0">Zoom</span>
            <Slider
              value={[examZoom]}
              onValueChange={([v]) => setExamZoom(v)}
              min={0.5}
              max={1.5}
              step={0.05}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-10 text-right">{examZoom.toFixed(2)}×</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground w-14 shrink-0">Opacity</span>
            <Slider
              value={[examOpacity]}
              onValueChange={([v]) => setExamOpacity(v)}
              min={0}
              max={1}
              step={0.05}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(examOpacity * 100)}%</span>
          </div>
        </div>

        {/* Answer submit */}
        <div className="flex gap-2 px-3 pb-4">
          <Input
            placeholder="Type your answer..."
            value={examAnswer}
            onChange={(e) => setExamAnswer(e.target.value.toUpperCase())}
            className="flex-1 uppercase font-mono"
            onKeyDown={(e) => e.key === "Enter" && handleExamSubmit()}
          />
          <Button onClick={handleExamSubmit} className="font-pixel text-xs bg-primary">
            SUBMIT
          </Button>
        </div>
      </div>
    );
  }

  // ─── LOBBY / GAMEPLAY CONTROLLER ─────────────────────────────────────────────
  const stage = gameState?.stage ?? 0;
  const socialMet = myState?.socialCircleMet?.length ?? 0;

  return (
    <div className="flex flex-col min-h-screen p-3 gap-2 select-none">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono">
          {displayColor && (
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: `hsl(${displayColor.hsl})`,
                boxShadow: `0 0 8px hsl(${displayColor.hsl} / 0.5)`,
              }}
            />
          )}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-primary">LIVE</span>
          </div>
          <span className="text-muted-foreground/60">({mode})</span>
        </div>

        {/* Health */}
        {gamePhase === "playing" && myState && (
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-card border border-border">
            <span className="text-base font-bold font-mono" style={{ color: getGradeColor(myState.health) }}>
              {gradeToLetter(myState.health)}
            </span>
            <span className="text-[10px] text-muted-foreground">{myState.health.toFixed(1)}</span>
            {myState.isStarStudent && <span className="text-accent">⭐</span>}
          </div>
        )}

        {/* Disconnect */}
        <Button
          variant="ghost"
          size="sm"
          onClick={disconnect}
          className="text-[10px] font-mono text-muted-foreground/60 h-6 px-2"
        >
          ✕
        </Button>
      </div>

      {/* ── EAGLE LAYOUT ── */}
      {isEagle && (
        <>
          {/* Top: Hitbox */}
          <div className="w-full">
            <HitboxBtn onHit={handleHitboxClick} inZone={!!isInZone} />
          </div>

          {/* Middle: Thumbstick */}
          <div className="flex-1 flex items-center justify-center">
            <Thumbstick
              onMove={handleMove}
              onIdleChange={handleIdleChange}
              size={200}
              color={displayColor ? `hsl(${displayColor.hsl})` : undefined}
            />
          </div>

          {/* Bottom: Attack + Props */}
          <div className="flex items-center justify-center gap-6">
            {gamePhase === "playing" && myState && (
              <>
                <AttackButton
                  onAttack={handleAttack}
                  cooldownUntil={myState.attackCooldownUntil}
                  disabled={myState.frozen}
                />
                <PropsBtn items={myState.props ?? []} onUse={handlePropUse} />
              </>
            )}
          </div>
        </>
      )}

      {/* ── CHICK LAYOUT ── */}
      {!isEagle && (
        <>
          {/* Top: Scanner */}
          <div className="w-full">
            <ScannerBox onScan={handleScan} label="SCANNER — scan props & tips" aspectRatio="873/457" />
          </div>

          {/* Middle: Thumbstick */}
          <div className="flex-1 flex items-center justify-center">
            <Thumbstick
              onMove={handleMove}
              onIdleChange={handleIdleChange}
              size={200}
              color={displayColor ? `hsl(${displayColor.hsl})` : undefined}
            />
          </div>

          {/* Bottom: Color picker in lobby, tips boxes + props in gameplay */}
          {gamePhase === "lobby" && (
            <div className="flex flex-col items-center gap-2">
              <ColorPicker
                currentColorIndex={colorIndex}
                usedColorIndices={usedColors}
                onColorSelect={requestColorSwap}
                gameMode={gameMode}
              />
            </div>
          )}

          {gamePhase === "playing" && myState && (
            <div className="flex items-end gap-2 w-full">
              {/* Tips box 0 */}
              <TipsBox
                tipIndex={0}
                stage={stage}
                socialMet={socialMet}
                totalNeeded={2}
                hasTip={myState.tips[0]}
                isLoadingTip={loadingTip[0]}
                qrCode={tipQrCodes[0]}
                tipShareCooldownUntil={myState.tipShareCooldownUntil}
                onTap={() => handleTipTap(0)}
              />
              {/* Tips box 1 */}
              <TipsBox
                tipIndex={1}
                stage={stage}
                socialMet={socialMet}
                totalNeeded={2}
                hasTip={myState.tips[1]}
                isLoadingTip={loadingTip[1]}
                qrCode={tipQrCodes[1]}
                tipShareCooldownUntil={myState.tipShareCooldownUntil}
                onTap={() => handleTipTap(1)}
              />
              {/* Props button */}
              <div className="flex-shrink-0">
                <PropsBtn items={myState.props ?? []} onUse={handlePropUse} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Role indicator */}
      {displayColor && (
        <div
          className="px-3 py-1 rounded text-center inline-block w-fit mx-auto"
          style={{ background: `hsl(${displayColor.hsl} / 0.1)`, border: `1px solid hsl(${displayColor.hsl} / 0.25)` }}
        >
          <p className="text-xs font-mono inline">
            <span style={{ color: `hsl(${displayColor.hsl})` }}>{displayColor.name}</span>
            {isEagle ? " 🦅 Eagle" : " 🐤 Chick"}
            {myState?.isStarStudent ? " ⭐ Star Student" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
