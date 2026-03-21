import { useState, useCallback, useEffect, useRef } from "react";
import { useFullscreen } from "@/hooks/useFullscreen";
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
import { assetUrl } from "@/lib/assets";
import type { GamePhase, GameStateSnapshot, PropType, GameMode, PropItem } from "@/lib/gameTypes";
import type { ChickColor } from "@/components/CharacterViewer";
import QRCode from "react-qr-code";
import { Zap, Heart, Wind, Shield, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

function PropsBtn({ items, onUse, isEagle, flyCooldownUntil }: { items: PropItem[]; onUse: (t: PropType) => void; isEagle?: boolean; flyCooldownUntil?: number }) {
  const [selIdx, setSelIdx] = useState(0);
  const [now, setNow] = useState(Date.now());
  const available = items.filter((i) => i.count > 0 || (isEagle && i.type === 'fly'));
  const current = available[selIdx % Math.max(1, available.length)];
  const hasMultiple = available.length > 1;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  if (!current) {
    return (
      <div className="w-16 h-16 rounded-full border-2 border-muted bg-muted/20 flex items-center justify-center opacity-40">
        <Zap className="w-6 h-6 text-muted-foreground" />
      </div>
    );
  }

  const showBadge = !(isEagle && current.type === 'fly');
  const flyOnCooldown = isEagle && current.type === 'fly' && flyCooldownUntil && now < flyCooldownUntil;
  const flyCdSec = flyOnCooldown ? Math.ceil((flyCooldownUntil! - now) / 1000) : 0;

  return (
    <div className="relative flex flex-col items-center" style={{ touchAction: 'manipulation' }}>
      {hasMultiple && (
        <button onPointerDown={(e) => { e.stopPropagation(); setSelIdx((i) => i + 1); }} className="mb-1 text-muted-foreground hover:text-foreground">
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
      <button
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onUse(current.type); }}
        className="relative w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all active:scale-90"
        style={{
          borderColor: PROP_COLORS[current.type],
          color: PROP_COLORS[current.type],
          boxShadow: `0 0 12px ${PROP_COLORS[current.type]}55`,
          touchAction: 'manipulation',
          opacity: flyOnCooldown ? 0.5 : 1,
        }}
      >
        {flyOnCooldown ? (
          <span className="text-xs font-mono font-bold">{flyCdSec}s</span>
        ) : (
          PROP_ICONS[current.type]
        )}
        {showBadge && (
          <span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center bg-card border"
            style={{ borderColor: PROP_COLORS[current.type], color: PROP_COLORS[current.type] }}
          >
            {current.count}
          </span>
        )}
      </button>
    </div>
  );
}

// ─── Props Stacked Button (shows all props visible, vertical flex) ──────────
function PropsStackBtn({ items, onUse }: { items: PropItem[]; onUse: (t: PropType) => void }) {
  const available = items.filter((i) => i.count > 0);
  
  if (available.length === 0) {
    return (
      <div className="w-14 h-14 rounded-full border-2 border-muted bg-muted/20 flex items-center justify-center opacity-40">
        <Zap className="w-5 h-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 items-center" style={{ touchAction: 'manipulation' }}>
      {available.map((item) => (
        <button
          key={item.type}
          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onUse(item.type); }}
          className="relative w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all active:scale-90"
          style={{
            borderColor: PROP_COLORS[item.type],
            color: PROP_COLORS[item.type],
            boxShadow: `0 0 12px ${PROP_COLORS[item.type]}55`,
            touchAction: 'manipulation',
            backgroundColor: 'hsl(var(--card))',
          }}
        >
          {PROP_ICONS[item.type]}
          <span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center bg-card border"
            style={{ borderColor: PROP_COLORS[item.type], color: PROP_COLORS[item.type] }}
          >
            {item.count}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Mock Exam Camera (auto-starts camera for visual cryptography) ──────────
function MockExamCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(console.error);

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover"
    />
  );
}

// ─── Invincible Ripple Effect ─────────────────────────────────────────────────
function InvincibleRipple() {
  return (
    <div className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center">
      <div
        className="w-[200vw] h-[200vw] rounded-full border-4 animate-ping"
        style={{
          borderColor: 'hsl(45 100% 55% / 0.4)',
          animationDuration: '1.5s',
        }}
      />
      <div
        className="absolute w-[150vw] h-[150vw] rounded-full border-2 animate-ping"
        style={{
          borderColor: 'hsl(45 100% 55% / 0.3)',
          animationDuration: '1s',
          animationDelay: '0.3s',
        }}
      />
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
  hasTip,
  isLoadingTip,
  tipShareCooldownUntil,
  tipCopyingCountdown,
  onTap,
}: {
  tipIndex: 0 | 1;
  stage: number;
  socialMet: number;
  hasTip: boolean;
  isLoadingTip: boolean;
  tipShareCooldownUntil: number;
  tipCopyingCountdown?: number;
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
        {tipCopyingCountdown !== undefined && tipCopyingCountdown > 0
          ? `📋 Copying... ${tipCopyingCountdown}s`
          : '📋 Copying...'}
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
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<ConnectionMode>("webrtc");
  const {
    connected,
    connect,
    sendJoystick,
    disconnect,
    colorIndex,
    clientId,
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
  const [hasSubmittedMockExam, setHasSubmittedMockExam] = useState(false);
  const [mockExamZoom, setMockExamZoom] = useState(1);
  const [mockExamOpacity, setMockExamOpacity] = useState(0.85);
  const connIdRef = useRef<string>("");

  // Event state
  const [eventAnswer, setEventAnswer] = useState("");
  const [clockNow, setClockNow] = useState(Date.now());

  // Fullscreen splash — false = not yet dismissed by user
  const [fsSplashDone, setFsSplashDone] = useState(false);




  // Tips state — QR now displays in scanner box, not tip box
  const [tipQrCodes, setTipQrCodes] = useState<[string | null, string | null]>([null, null]);
  const [loadingTip, setLoadingTip] = useState<[boolean, boolean]>([false, false]);
  const [tipCopyStartedAt, setTipCopyStartedAt] = useState<[number, number]>([0, 0]);
  // Active QR display in scanner area
  const [activeScannerQr, setActiveScannerQr] = useState<string | null>(null);
  const [scannerQrExpireAt, setScannerQrExpireAt] = useState(0);
  // Local cooldown after QR expires (5s before re-click)
  const [tipExpiryCooldown, setTipExpiryCooldown] = useState<[number, number]>([0, 0]);
  // Track which tipIndex the current scanner QR is for
  const [activeScannerTipIdx, setActiveScannerTipIdx] = useState<0 | 1>(0);

  // Exam state
  const [examLayer, setExamLayer] = useState<"1" | "2" | null>(null);
  const [examQuestionNum, setExamQuestionNum] = useState(0);
  const [examAnswer, setExamAnswer] = useState("");
  const [examZoom, setExamZoom] = useState(1);
  const [examOpacity, setExamOpacity] = useState(0.85);
  const examVideoRef = useRef<HTMLVideoElement>(null);
  const examStreamRef = useRef<MediaStream | null>(null);

  const { isFullscreen, isSupported: fsSupported, enter: enterFullscreen } = useFullscreen();

  // ── Prevent body scroll / overscroll bounce on mobile ──────────────────────
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.width = '';
    };
  }, []);

  useEffect(() => {
    preloadAllAnimations();
  }, []);
  useEffect(() => {
    const id = setInterval(() => setClockNow(Date.now()), 250);
    return () => clearInterval(id);
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
        const myConnId = clientId;
        if (myConnId && assigns[myConnId]) {
          connIdRef.current = myConnId;
          const assign = assigns[myConnId];
          setMyAssignment({ colorIndex: assign.colorIndex, isEagle: assign.isEagle, chickColor: assign.chickColor });
        } else {
          // Fallback: older matching by current chosen colorIndex
          for (const [connId, assign] of Object.entries(assigns)) {
            if (assign.colorIndex === colorIndex) {
              connIdRef.current = connId;
              setMyAssignment({ colorIndex: assign.colorIndex, isEagle: assign.isEagle, chickColor: assign.chickColor });
              break;
            }
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
          const code = msg.code as string;
          const tipIdx = msg.tipIndex as 0 | 1;
          setTipQrCodes((prev) => {
            const next: [string | null, string | null] = [...prev] as [string | null, string | null];
            next[tipIdx] = code;
            return next;
          });
          // Show QR in scanner area with 5s expiry
          setActiveScannerQr(code);
          setActiveScannerTipIdx(tipIdx);
          const expireAt = Date.now() + 5000;
          setScannerQrExpireAt(expireAt);
          // Auto-expire → set 5s cooldown on that tip box
          setTimeout(() => {
            setScannerQrExpireAt((cur) => {
              if (cur === expireAt) {
                setActiveScannerQr(null);
                setTipQrCodes([null, null]);
                // Set local 5s cooldown on the tip box
                setTipExpiryCooldown((prev) => {
                  const n: [number, number] = [...prev] as [number, number];
                  n[tipIdx] = Date.now() + 5000;
                  return n;
                });
                return 0;
              }
              return cur;
            });
          }, 5000);
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
  }, [onHostMessage, colorIndex, clientId]);

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
        // Just received this tip — show copying countdown
        const copyStart = Date.now();
        setTipCopyStartedAt((prev) => {
          const n: [number, number] = [...prev] as [number, number];
          n[i] = copyStart;
          return n;
        });
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
  const nowTs = clockNow;
  const tipObtainRemainingSec =
    connIdRef.current && gameState?.tipObtainTimers?.[connIdRef.current]
      ? Math.ceil(gameState.tipObtainTimers[connIdRef.current].remainingMs / 1000)
      : 0;
  const speedRemainingSec = myState?.speedMultiplierUntil ? Math.ceil(Math.max(0, myState.speedMultiplierUntil - nowTs) / 1000) : 0;
  const invincibleRemainingSec = myState?.invincibleUntil ? Math.ceil(Math.max(0, myState.invincibleUntil - nowTs) / 1000) : 0;

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
      // Check local expiry cooldown
      if (Date.now() < tipExpiryCooldown[tipIndex]) return;
      // If QR is already showing in scanner, dismiss it + set cooldown
      if (activeScannerQr && tipQrCodes[tipIndex]) {
        setActiveScannerQr(null);
        setScannerQrExpireAt(0);
        setTipQrCodes((prev) => {
          const n: [string | null, string | null] = [...prev] as [string | null, string | null];
          n[tipIndex] = null;
          return n;
        });
        setTipExpiryCooldown((prev) => {
          const n: [number, number] = [...prev] as [number, number];
          n[tipIndex] = Date.now() + 5000;
          return n;
        });
        return;
      }
      sendToHost({ type: "tip-request", tipIndex });
    },
    [sendToHost, tipQrCodes, activeScannerQr, tipExpiryCooldown],
  );
  const handleDismissScannerQr = useCallback(() => {
    setActiveScannerQr(null);
    setScannerQrExpireAt(0);
    // Set local 5s cooldown on the active tip
    setTipExpiryCooldown((prev) => {
      const n: [number, number] = [...prev] as [number, number];
      n[activeScannerTipIdx] = Date.now() + 5000;
      return n;
    });
    setTipQrCodes([null, null]);
  }, [activeScannerTipIdx]);
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

  // ─── FULLSCREEN SPLASH — shown before join if FS is supported and not yet entered ──
  if (fsSupported && !isFullscreen && !fsSplashDone) {
    return (
      <div
        className="flex flex-col items-center justify-center h-dvh overflow-hidden gap-8 bg-background"
        style={{ touchAction: 'manipulation' }}
      >
        {/* App title */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-pixel text-primary text-glow-green tracking-widest">FIRECHICK</h1>
          <p className="text-xs font-mono text-muted-foreground">Eagle vs Chick</p>
        </div>

        {/* Big fullscreen tap target */}
        <button
          onClick={async () => { await enterFullscreen(); setFsSplashDone(true); }}
          className="relative flex flex-col items-center gap-4 px-10 py-8 rounded-2xl
            border-2 border-primary bg-primary/10 text-primary
            shadow-[0_0_40px_hsl(var(--primary)/0.4),inset_0_0_30px_hsl(var(--primary)/0.05)]
            hover:bg-primary/20 active:scale-95 transition-all duration-150
            before:absolute before:inset-0 before:rounded-2xl before:border before:border-primary/30 before:animate-pulse"
        >
          <span className="text-5xl" style={{ lineHeight: 1 }}>⛶</span>
          <span className="text-base font-pixel tracking-widest">TAP TO FULLSCREEN</span>
          <span className="text-[10px] font-mono text-primary/60">hides browser address bar</span>
        </button>

        {/* Skip link */}
        <button
          onClick={() => setFsSplashDone(true)}
          className="text-[11px] font-mono text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Skip — continue without fullscreen
        </button>
      </div>
    );
  }

  // ─── JOIN SCREEN ─────────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh overflow-hidden p-5 gap-6">
        <div className="w-full max-w-[320px] sm:max-w-xs">
          <button
            onClick={() => navigate("/")}
            className="text-xs font-mono text-muted-foreground hover:text-foreground"
          >
            &lt; Back
          </button>
        </div>
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

        <div className="flex flex-col gap-4 w-full max-w-[320px] sm:max-w-xs">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            maxLength={6}
            className="text-center text-2xl sm:text-3xl tracking-[0.3em] sm:tracking-[0.5em] font-pixel bg-card border-border h-14 uppercase"
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
      <div className="flex flex-col items-center justify-center h-dvh overflow-hidden p-4 gap-4 overflow-y-auto">
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
          onClick={() => { disconnect(); navigate("/"); }}
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
      <div className="flex items-center justify-center h-dvh overflow-hidden bg-background">
        <CharacterReveal colorIndex={currentColorIndex} isEagle={isEagle} />
      </div>
    );
  }

  // ─── DEAD ────────────────────────────────────────────────────────────────────
  if (isDead && gamePhase !== "gameover") {
    return (
      <div className="flex flex-col items-center justify-center h-dvh overflow-hidden gap-6">
        <div className="text-9xl font-pixel text-destructive" style={{ textShadow: "0 0 30px hsl(0 80% 55% / 0.8)" }}>
          F
        </div>
        <p className="text-xl font-mono text-destructive tracking-widest">ELIMINATED</p>
        <p className="text-xs text-muted-foreground font-mono">Better luck next time...</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { disconnect(); navigate("/"); }}
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
      <div className="flex flex-col items-center justify-center h-dvh overflow-hidden gap-6">
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
    const isDraw = winner === "draw";
    return (
      <div className="flex flex-col items-center justify-center h-dvh overflow-hidden gap-6 p-4">
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
        {isDraw && <p className="text-lg font-pixel" style={{ color: 'hsl(45 100% 55%)' }}>🤝 It's a Draw!</p>}
        {amWinner && !isDraw && <p className="text-lg font-pixel text-primary text-glow-green">🎉 YOU WIN!</p>}
        <Button variant="outline" size="sm" onClick={() => { disconnect(); navigate("/"); }} className="text-xs font-mono">
          LEAVE
        </Button>
      </div>
    );
  }

  // ─── ACTIVE EVENT PHASE ──────────────────────────────────────────────────────
  const activeEvent = gameState?.activeEvent;
  if (activeEvent && gamePhase === "playing") {
    const now = Date.now();
    const timeLeft = Math.max(0, Math.ceil((activeEvent.endAt - clockNow) / 1000));

    if (activeEvent.phase === "countdown") {
      const cdSec = Math.max(1, 3 - Math.floor((now - activeEvent.startedAt) / 1000));
      return (
        <div className="flex flex-col items-center justify-center h-dvh overflow-hidden gap-4">
          <h2 className="text-lg font-pixel text-accent">
            {activeEvent.type === "mock-exam" ? "📝 MOCK EXAM" : "👊 HITBOX CHALLENGE"}
          </h2>
          <div className="text-7xl font-pixel text-primary animate-pulse">{cdSec}</div>
        </div>
      );
    }

    if (activeEvent.phase === "active" && activeEvent.type === "hitbox") {
      return (
        <div className="flex flex-col items-center justify-between h-dvh overflow-hidden p-4">
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
        <div className="flex flex-col h-dvh overflow-hidden p-4 gap-4">
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
          ) : hasSubmittedMockExam ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-lg font-pixel text-primary">✓ Submitted</p>
            </div>
          ) : (
            <>
              {/* Layer 2 overlaid on camera for visual cryptography */}
              <div className="relative w-full overflow-hidden rounded border border-border bg-black" style={{ aspectRatio: "873/457" }}>
                <MockExamCamera />
                <img
                  src={assetUrl(`/PW/PW_Mock_${activeEvent.questionNum}_layer-2.png`)}
                  alt="Mock exam layer 2"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  style={{ opacity: mockExamOpacity, mixBlendMode: 'multiply', transform: `scale(${mockExamZoom})`, transformOrigin: 'center center' }}
                />
              </div>

              {/* Zoom & Opacity sliders — 2 separate lines */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground w-12 shrink-0">🔍 Zoom</span>
                  <Slider value={[mockExamZoom]} min={0.5} max={1.25} step={0.05} onValueChange={([v]) => setMockExamZoom(v)} className="flex-1" />
                  <span className="text-[10px] text-muted-foreground w-10 text-right">{mockExamZoom.toFixed(2)}×</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground w-12 shrink-0">👁 Layer</span>
                  <Slider value={[mockExamOpacity]} min={0} max={1} step={0.05} onValueChange={([v]) => setMockExamOpacity(v)} className="flex-1" />
                  <span className="text-[10px] text-muted-foreground w-10 text-right">{Math.round(mockExamOpacity * 100)}%</span>
                </div>
              </div>

              <div className="flex gap-2 mt-auto">
                <Input
                  placeholder="Answer..."
                  value={eventAnswer}
                  onChange={(e) => setEventAnswer(e.target.value.toUpperCase())}
                  className="flex-1 uppercase font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && eventAnswer.trim()) {
                      sendToHost({ type: "event-answer", answer: eventAnswer.trim() });
                      setHasSubmittedMockExam(true);
                      setEventAnswer("");
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    if (eventAnswer.trim()) {
                      sendToHost({ type: "event-answer", answer: eventAnswer.trim() });
                      setHasSubmittedMockExam(true);
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

    // Reset mock exam submission for next event
    if (hasSubmittedMockExam) setHasSubmittedMockExam(false);

    if (activeEvent.phase === "result") {
      const isHitbox = activeEvent.type === "hitbox";
      // For mock exam, show individual result
      const myMockCorrect = !isHitbox && activeEvent.chickClicks && myState ? (activeEvent.chickClicks[myState.connId] ?? 0) > 0 : false;
      return (
        <div className="flex flex-col items-center justify-center h-dvh overflow-hidden gap-4">
          <h2 className="text-xl font-pixel text-accent">{isHitbox ? "👊 HITBOX" : "📝 MOCK EXAM"} RESULT</h2>
          {isHitbox ? (
            <>
              <p className="text-2xl font-pixel" style={{ color: activeEvent.result === "chick" ? "hsl(145 80% 50%)" : "hsl(0 80% 55%)" }}>
                {activeEvent.result === "chick" ? "🐤 Chicks Win!" : "🦅 Eagle Wins!"}
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                {activeEvent.result === "chick" ? "+2 grades!" : "-2 grades for chicks"}
              </p>
            </>
          ) : (
            <>
              {isEagle ? (
                <p className="text-lg font-pixel text-muted-foreground">Results announced</p>
              ) : myMockCorrect ? (
                <p className="text-2xl font-pixel" style={{ color: "hsl(145 80% 50%)" }}>✅ Correct! +1 grade</p>
              ) : (
                <p className="text-2xl font-pixel" style={{ color: "hsl(0 80% 55%)" }}>❌ Wrong! -2 grades</p>
              )}
            </>
          )}
        </div>
      );
    }
  }

  // ─── EXAM PHASE ──────────────────────────────────────────────────────────────
  if (gamePhase === "exam") {
    // Eagle sees distract message
    if (isEagle) {
      return (
        <div className="flex flex-col items-center justify-center h-dvh overflow-hidden p-6 gap-6">
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
        <div className="flex items-center justify-center h-dvh overflow-hidden">
          <p className="text-sm font-mono text-muted-foreground animate-pulse">Loading exam...</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-dvh overflow-hidden bg-background">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <span className="text-xs font-pixel text-accent">📝 FINAL EXAM</span>
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
            src={assetUrl(`/PW/PW_Final_${examQuestionNum}_layer-${examLayer}.png`)}
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
    <div className="flex flex-col h-dvh overflow-hidden p-2 gap-2 select-none">
      {/* Stage transition overlay */}
      {gameState?.stageTransitionUntil && gameState.stageTransitionUntil > 0 && clockNow < gameState.stageTransitionUntil && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="text-4xl mb-4">{gameState.stage === 0 ? '🤝' : gameState.stage === 1 ? '📍' : gameState.stage === 2 ? '🔗' : '📝'}</div>
          <h1 className="text-xl font-pixel text-accent tracking-widest mb-2">STAGE {(gameState.stage ?? 0) + 1}</h1>
          <p className="text-sm font-mono text-muted-foreground text-center max-w-xs px-4">
            {gameState.stage === 0 ? 'Meet ALL other Chicks!' : gameState.stage <= 2 ? 'Get tips & share them!' : 'Run to a building for the exam!'}
          </p>
          <div className="text-3xl font-pixel text-primary animate-pulse mt-4">{Math.ceil((gameState.stageTransitionUntil - clockNow) / 1000)}</div>
        </div>
      )}
      {/* Invincible ripple effect */}
      {invincibleRemainingSec > 0 && <InvincibleRipple />}
      {/* Status bar */}
      <div className="flex items-center justify-between">
        {/* Fullscreen toggle when not already fullscreen */}
        {fsSupported && !isFullscreen && (
          <button
            onClick={enterFullscreen}
            className="text-[10px] font-mono text-primary/60 hover:text-primary px-1.5 py-0.5 rounded border border-primary/20 hover:border-primary/40 transition-all"
            title="Enter fullscreen"
          >
            ⛶
          </button>
        )}
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
          onClick={() => { disconnect(); navigate("/"); }}
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
                  disabled={myState.frozen || !!gameState?.videoPlaying}
                />

                <PropsBtn items={myState.props ?? []} onUse={handlePropUse} isEagle={true} flyCooldownUntil={Math.max(myState.flyCooldownUntil ?? 0, myState.attackCooldownUntil ?? 0)} />
              </>
            )}
          </div>
        </>
      )}

      {/* ── CHICK LAYOUT ── */}
      {!isEagle && (
        <>
          {/* Top: Scanner — only during gameplay, not lobby */}
          {gamePhase !== "lobby" && (
            <div className="w-full">
              <ScannerBox
                onScan={handleScan}
                label="SCANNER — scan props & tips"
                aspectRatio="873/457"
                displayQr={activeScannerQr}
                displayQrCountdown={scannerQrExpireAt > 0 ? Math.max(0, Math.ceil((scannerQrExpireAt - clockNow) / 1000)) : undefined}
                onDismissQr={handleDismissScannerQr}
              />
            </div>
          )}

          {/* Tips boxes right under scanner */}
          {gamePhase === "playing" && myState && (
            <div className="flex gap-2 w-full">
              <TipsBox
                tipIndex={0}
                stage={stage}
                socialMet={socialMet}
                hasTip={myState.tips[0]}
                isLoadingTip={loadingTip[0]}
                tipShareCooldownUntil={Math.max(myState.tipShareCooldownUntil, tipExpiryCooldown[0])}
                tipCopyingCountdown={loadingTip[0] && tipCopyStartedAt[0] > 0 ? Math.max(0, Math.ceil((tipCopyStartedAt[0] + 3000 - clockNow) / 1000)) : undefined}
                onTap={() => handleTipTap(0)}
              />
              <TipsBox
                tipIndex={1}
                stage={stage}
                socialMet={socialMet}
                hasTip={myState.tips[1]}
                isLoadingTip={loadingTip[1]}
                tipShareCooldownUntil={Math.max(myState.tipShareCooldownUntil, tipExpiryCooldown[1])}
                tipCopyingCountdown={loadingTip[1] && tipCopyStartedAt[1] > 0 ? Math.max(0, Math.ceil((tipCopyStartedAt[1] + 3000 - clockNow) / 1000)) : undefined}
                onTap={() => handleTipTap(1)}
              />
            </div>
          )}

          {/* Middle+Bottom: Props on left under tip boxes, thumbstick on right */}
          {gamePhase === "playing" && myState ? (
            <div className="flex-1 flex items-center w-full">
              {/* Left column: props stacked vertically, aligned under left tip box */}
              <div className="flex items-center justify-center" style={{ width: 80 }}>
                <PropsStackBtn items={myState.props ?? []} onUse={handlePropUse} />
              </div>
              {/* Right column: thumbstick centered in remaining space */}
              <div className="flex-1 flex items-center justify-center">
                <Thumbstick
                  onMove={handleMove}
                  onIdleChange={handleIdleChange}
                  size={200}
                  color={displayColor ? `hsl(${displayColor.hsl})` : undefined}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Lobby: thumbstick centered, color picker below */}
              <div className="flex-1 flex items-center justify-center">
                <Thumbstick
                  onMove={handleMove}
                  onIdleChange={handleIdleChange}
                  size={200}
                  color={displayColor ? `hsl(${displayColor.hsl})` : undefined}
                />
              </div>
              {gamePhase === "lobby" && (
                <div className="flex flex-col items-center gap-3">
                  <ColorPicker
                    currentColorIndex={colorIndex}
                    usedColorIndices={usedColors}
                    onColorSelect={requestColorSwap}
                    gameMode={gameMode}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Role indicator */}
      {displayColor && (
        <div
          className="px-3 py-1 rounded text-center inline-block w-fit mx-auto mt-[4px] my-0 flex flex-col items-center"
          style={{ background: `hsl(${displayColor.hsl} / 0.1)`, border: `1px solid hsl(${displayColor.hsl} / 0.25)` }}
        >
          <p className="text-xs font-mono inline">
            <span style={{ color: `hsl(${displayColor.hsl})` }}>{displayColor.name}</span>
            {isEagle ? " 🦅 Eagle" : " 🐤 Chick"}
            {myState?.isStarStudent ? " ⭐ Star Student" : ""}
          </p>
          <div className="text-[10px] font-mono text-muted-foreground">
            {tipObtainRemainingSec > 0 && <span>Obtaining tips... {tipObtainRemainingSec}s </span>}
            {invincibleRemainingSec > 0 && <span>Invincible {invincibleRemainingSec}s </span>}
            {speedRemainingSec > 0 && <span>Speed {speedRemainingSec}s</span>}
          </div>
        </div>
      )}
    </div>
  );
}
