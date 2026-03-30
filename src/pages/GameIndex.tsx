import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useFullscreen } from "@/hooks/useFullscreen";
import AssetLoadingIndicator from "@/components/AssetLoadingIndicator";
import { useAssetLoading } from "@/context/AssetLoadingContext";
import { useImmersive } from "@/context/ImmersiveContext";
import { toast } from "@/components/ui/sonner";
import { ArrowDownToLine, Check, Loader2, Sparkles } from "lucide-react";

// ── Circular progress button ──────────────────────────────────────────────────

function CharAnimCircle({
  progress,
  loading,
  ready,
  onClick,
}: {
  progress: number;
  loading: boolean;
  ready: boolean;
  onClick: () => void;
}) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const dash = (progress / 100) * circumference;

  return (
    <button
      onClick={onClick}
      aria-label={
        ready ? "Character files loaded" : loading ? `Loading character files ${progress}%` : "Download character files"
      }
      className="relative flex items-center justify-center w-9 h-9 rounded focus:outline-none"
    >
      <svg width="36" height="36" viewBox="0 0 36 36" className="absolute top-0 left-0">
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth="2.5"
          className={ready ? "stroke-green-500/30" : "stroke-muted-foreground/30"}
        />
        {(loading || ready) && (
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            className={ready ? "stroke-green-500" : "stroke-primary"}
            strokeDasharray={`${dash} ${circumference}`}
            transform="rotate(-90 18 18)"
          />
        )}
      </svg>
      <span className="relative z-10 flex items-center justify-center">
        {ready ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : loading ? (
          <span className="text-[9px] font-mono text-primary leading-none">{progress}%</span>
        ) : (
          <ArrowDownToLine className="w-4 h-4 text-muted-foreground" />
        )}
      </span>
    </button>
  );
}

// ── Typewriter title ──────────────────────────────────────────────────────────

function ImmersiveTitle() {
  const text = "FIRECHICK";
  return (
    <h1 className="text-3xl md:text-5xl font-pixel tracking-wider leading-relaxed">
      {text.split("").map((char, i) => (
        <span
          key={i}
          className="immersive-letter-fire"
          style={{ "--delay": `${0.6 + i * 0.08}s` } as React.CSSProperties}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </h1>
  );
}

// ── Rising fire traces (even columns, gradient strokes — few DOM nodes) ─────

function getTraceGradient(colorType: number): string {
  switch (colorType) {
    case 0:
      return `linear-gradient(to top,
        rgba(255, 94, 77, 0.95) 0%,
        rgba(255, 68, 51, 0.5) 28%,
        rgba(204, 51, 34, 0.12) 58%,
        transparent 100%)`;
    case 1:
      return `linear-gradient(to top,
        rgba(255, 120, 77, 0.95) 0%,
        rgba(255, 94, 77, 0.5) 28%,
        rgba(255, 68, 51, 0.12) 58%,
        transparent 100%)`;
    case 2:
      return `linear-gradient(to top,
        rgba(255, 140, 77, 0.95) 0%,
        rgba(255, 120, 77, 0.5) 28%,
        rgba(255, 94, 77, 0.12) 58%,
        transparent 100%)`;
    case 3:
      return `linear-gradient(to top,
        rgba(255, 107, 53, 0.95) 0%,
        rgba(255, 94, 77, 0.5) 28%,
        rgba(255, 68, 51, 0.12) 58%,
        transparent 100%)`;
    case 4:
      return `linear-gradient(to top,
        rgba(255, 159, 67, 0.95) 0%,
        rgba(255, 140, 77, 0.5) 28%,
        rgba(255, 120, 77, 0.12) 58%,
        transparent 100%)`;
    default:
      return `linear-gradient(to top,
        rgba(255, 183, 77, 0.95) 0%,
        rgba(255, 159, 67, 0.5) 28%,
        rgba(255, 140, 77, 0.12) 58%,
        transparent 100%)`;
  }
}

function ParticleField() {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const lineCount = isMobile ? 28 : 44;
  const traces = useMemo(
    () =>
      Array.from({ length: lineCount }, (_, i) => {
        const colorType = i % 6;
        const duration = 5.5 + (i % 5) * 0.35;
        const staggerWindow = 4.8;
        const delay = (i / lineCount) * staggerWindow;
        return { id: i, colorType, duration, delay };
      }),
    [lineCount],
  );

  return (
    <div className="fixed inset-0 z-0 flex pointer-events-none overflow-hidden">
      {traces.map((t) => (
        <div key={t.id} className="relative h-full min-w-0 flex-1 flex justify-center">
          <div
            className="absolute bottom-0 w-[2px] rounded-full"
            style={
              {
                height: "min(32vh, 220px)",
                background: getTraceGradient(t.colorType),
                boxShadow: "0 0 8px rgba(255, 68, 51, 0.4)",
                animation: `flame-trace-rise ${t.duration}s linear ${t.delay}s infinite`,
                willChange: "transform",
              } as React.CSSProperties
            }
          />
        </div>
      ))}
    </div>
  );
}
// ── Main page ─────────────────────────────────────────────────────────────────

const Index = () => {
  const navigate = useNavigate();
  const { isFullscreen, showImmersiveControl, enter } = useFullscreen();
  const { isImmersive, toggleImmersive } = useImmersive();
  const {
    isMobile,
    entryReady,
    fullReady,
    characterAnimationsReady,
    characterAnimationsLoading,
    characterAnimationsProgress,
    startFullPreload,
    startCharacterAnimationPreload,
  } = useAssetLoading();

  const [hostPending, setHostPending] = useState(false);
  const [charViewerPending, setCharViewerPending] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-preload character GLBs in background on mobile when immersive mode is on,
  // but only after the minimal/entry assets finish loading first.
  useEffect(() => {
    if (isImmersive && isMobile && entryReady && !characterAnimationsReady && !characterAnimationsLoading) {
      startCharacterAnimationPreload();
    }
  }, [
    isImmersive,
    isMobile,
    entryReady,
    characterAnimationsReady,
    characterAnimationsLoading,
    startCharacterAnimationPreload,
  ]);

  useEffect(() => {
    if (hostPending && fullReady) {
      setHostPending(false);
      navigate("/host");
    }
  }, [hostPending, fullReady, navigate]);

  useEffect(() => {
    if (charViewerPending && characterAnimationsReady) {
      setCharViewerPending(false);
      navigate("/character");
    }
  }, [charViewerPending, characterAnimationsReady, navigate]);

  const handleHostClick = () => {
    if (isMobile && !fullReady) {
      startFullPreload();
      setHostPending(true);
      return;
    }
    navigate("/host");
  };

  const handleCharViewerClick = () => {
    if (!isMobile) {
      navigate("/character");
      return;
    }
    if (characterAnimationsReady) {
      navigate("/character");
      return;
    }
    if (characterAnimationsLoading) {
      toast("Please wait for character files to finish loading.");
      return;
    }
    startCharacterAnimationPreload();
    setCharViewerPending(true);
  };

  const handleCharAnimCircleClick = () => {
    if (characterAnimationsReady || characterAnimationsLoading) return;
    startCharacterAnimationPreload();
  };

  // ── Immersive variant ────────────────────────────────────

  if (isImmersive) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6 gap-10 bg-black overflow-hidden">
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            background: "radial-gradient(circle at 50% 70%, rgba(255, 68, 51, 0.15) 0%, transparent 70%)",
            animation: "heat-distortion 0.3s ease-in-out infinite",
          }}
        />
        {/* Fire trace field */}
        <ParticleField />
        {/* Scanline overlay */}
        <div className="immersive-scanline-overlay" />
        {/* Vignette */}
        <div className="immersive-vignette" />

        {/* Fullscreen control */}
        {showImmersiveControl && !isFullscreen && (
          <button
            onClick={enter}
            className="absolute top-4 right-4 px-3 py-1 rounded border border-primary/40 text-primary text-xs font-mono hover:bg-primary/10 z-50 immersive-fade-in"
            style={{ "--delay": "0.2s" } as React.CSSProperties}
          >
            ⛶ Fullscreen
          </button>
        )}

        {/* Toggle off immersive */}
        <button
          onClick={toggleImmersive}
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded border border-primary/60 text-primary text-xs font-mono hover:bg-primary/10 z-50 immersive-border-breathe immersive-fade-in"
          style={{ "--delay": "0.1s" } as React.CSSProperties}
        >
          <Sparkles className="w-3 h-3 flex-shrink-0" />
          IMMERSIVE ON
        </button>

        {/* Title + subtitle */}
        <div
          className="text-center space-y-4 z-10 immersive-fade-in"
          style={{ "--delay": "0.4s" } as React.CSSProperties}
        >
          <ImmersiveTitle />
          <p
            className="text-sm text-muted-foreground font-mono max-w-md mx-auto immersive-fade-in"
            style={{ "--delay": "2.0s" } as React.CSSProperties}
          >
            1 V 3 — control characters across devices
          </p>
        </div>

        {/* Buttons — staggered fade-in */}
        <div className="flex flex-col gap-4 w-full max-w-xs z-10">
          <Button
            onClick={handleHostClick}
            disabled={hostPending}
            className="h-14 text-sm font-pixel bg-red-600 hover:bg-red-500 text-white border-red-500/50 glow-red immersive-fade-in immersive-border-breathe-red"
            style={{ "--delay": "2.4s" } as React.CSSProperties}
          >
            {hostPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading assets…
              </span>
            ) : (
              "HOST GAME"
            )}
          </Button>

          <Button
            onClick={() => navigate("/client")}
            variant="outline"
            className="h-14 text-sm font-pixel border-secondary text-secondary hover:bg-secondary/10 glow-purple immersive-fade-in"
            style={{ "--delay": "2.6s", animationFillMode: "both" } as React.CSSProperties}
          >
            JOIN GAME
          </Button>

          <div
            className="flex h-14 rounded-md overflow-hidden border border-accent immersive-fade-in"
            style={{ "--delay": "2.8s" } as React.CSSProperties}
          >
            <button
              onClick={handleCharViewerClick}
              className="flex-1 text-sm font-pixel text-accent bg-transparent hover:bg-accent/10 transition-colors px-4"
            >
              🐤 CHARACTER 🐤
            </button>
            {isMobile && (
              <div className="w-14 border-l border-accent flex items-center justify-center bg-transparent hover:bg-accent/5 transition-colors">
                <CharAnimCircle
                  progress={characterAnimationsProgress}
                  loading={characterAnimationsLoading}
                  ready={characterAnimationsReady}
                  onClick={handleCharAnimCircleClick}
                />
              </div>
            )}
          </div>

        </div>

        {/* Watermark */}
        <div
          className="absolute bottom-6 left-1/2 text-[10px] font-mono tracking-[0.3em] uppercase text-muted-foreground/40 whitespace-nowrap z-10"
          style={{ animation: "immersive-watermark-rotate 8s ease-in-out infinite" }}
        >
          The Power of Interfaces
        </div>

        <div
          className="text-xs text-muted-foreground/60 font-mono text-center space-y-1 mt-8 z-10 immersive-fade-in"
          style={{ "--delay": "3.4s" } as React.CSSProperties}
        >
          <p>Host opens the lobby on a big screen</p>
          <p>Players join from phones with the room code</p>
        </div>

        <AssetLoadingIndicator />
      </div>
    );
  }

  // ── Standard variant (unchanged) ─────────────────────────

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-10 relative">
      {showImmersiveControl && !isFullscreen && (
        <button
          onClick={enter}
          className="absolute top-4 right-4 px-3 py-1 rounded border border-primary/40 text-primary text-xs font-mono hover:bg-primary/10"
        >
          ⛶ Fullscreen
        </button>
      )}

      {/* Immersive toggle */}
      <button
        onClick={toggleImmersive}
        className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded border border-muted-foreground/30 text-muted-foreground text-xs font-mono hover:border-primary/50 hover:text-primary transition-colors"
      >
        <Sparkles className="w-3 h-3" />
        GO IMMERSIVE
      </button>

      <div className="text-center space-y-4">
        <h1 className="text-xl md:text-3xl text-primary text-glow-green tracking-wider leading-relaxed">
          EAGLE VS CHICK
        </h1>
        <p className="text-sm text-muted-foreground font-mono max-w-md mx-auto text-center">
          1 V 3 — control characters across devices
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Button
          onClick={handleHostClick}
          disabled={hostPending}
          className="h-14 text-sm font-pixel bg-primary hover:bg-primary/80 text-primary-foreground glow-green"
        >
          {hostPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading assets…
            </span>
          ) : (
            "HOST GAME"
          )}
        </Button>

        <Button
          onClick={() => navigate("/client")}
          variant="outline"
          className="h-14 text-sm font-pixel border-secondary text-secondary hover:bg-secondary/10 glow-purple"
        >
          JOIN GAME
        </Button>

        <div className="flex h-14 rounded-md overflow-hidden border border-accent">
          <button
            onClick={handleCharViewerClick}
            className="flex-1 text-sm font-pixel text-accent bg-transparent hover:bg-accent/10 transition-colors px-4"
          >
            🐤 CHARACTER 🐤
          </button>
          {isMobile && (
            <div className="w-14 border-l border-accent flex items-center justify-center bg-transparent hover:bg-accent/5 transition-colors">
              <CharAnimCircle
                progress={characterAnimationsProgress}
                loading={characterAnimationsLoading}
                ready={characterAnimationsReady}
                onClick={handleCharAnimCircleClick}
              />
            </div>
          )}
        </div>

        <Button
          onClick={() => navigate("/pw")}
          variant="outline"
          className="h-14 text-sm font-pixel border-border text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          🔐 PW EXAM
        </Button>

        <Button
          onClick={() => navigate("/test-crossy-road")}
          variant="outline"
          className="h-14 text-sm font-pixel border-accent text-accent hover:bg-accent/10"
        >
          🐔 CROSSY ROAD
        </Button>

        <Button
          onClick={() => { import('@/lib/haptics').then(m => m.buzz(50)); }}
          variant="outline"
          className="h-14 text-sm font-pixel border-primary/40 text-primary hover:bg-primary/10"
        >
          📳 HAPTIC TEST
        </Button>
      </div>

      <div className="text-xs text-muted-foreground font-mono text-center space-y-1 mt-8">
        <p>Host opens the lobby on a big screen</p>
        <p>Players join from phones with the room code</p>
      </div>

      <AssetLoadingIndicator />
    </div>
  );
};

export default Index;
