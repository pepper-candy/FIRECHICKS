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
  const text = "EAGLE VS CHICK";
  return (
    <h1 className="text-2xl md:text-4xl font-pixel tracking-wider leading-relaxed">
      {text.split("").map((char, i) => (
        <span key={i} className="immersive-letter" style={{ "--delay": `${0.6 + i * 0.08}s` } as React.CSSProperties}>
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </h1>
  );
}

// ── Floating particles field ──────────────────────────────────────────────────

function ParticleField() {
  const particles = useMemo(
    () =>
      Array.from({ length: 100 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        duration: 8 + Math.random() * 12,
        delay: Math.random() * 10,
        size: 8 + Math.random() * 25,
        sway: (Math.random() - 0.5) * 100,
        opacity: 0.3 + Math.random() * 0.5,
        colorType: Math.floor(Math.random() * 4),
      })),
    [],
  );

  const getParticleGradient = (colorType: number) => {
    switch (colorType) {
      case 0:
        return `radial-gradient(circle at 30% 30%, 
          rgba(34, 197, 94, 0.9), 
          rgba(34, 197, 94, 0.45),
          rgba(34, 197, 94, 0.08))`;
      case 1:
        return `radial-gradient(circle at 30% 30%, 
          rgba(168, 85, 247, 0.9), 
          rgba(168, 85, 247, 0.45),
          rgba(168, 85, 247, 0.08))`;
      case 2:
        return `radial-gradient(circle at 30% 30%, 
          rgba(6, 182, 212, 0.9), 
          rgba(6, 182, 212, 0.45),
          rgba(6, 182, 212, 0.08))`;
      default:
        return `radial-gradient(circle at 30% 30%, 
          rgba(234, 179, 8, 0.9), 
          rgba(234, 179, 8, 0.45),
          rgba(234, 179, 8, 0.08))`;
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            bottom: "-20px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: getParticleGradient(p.colorType),
            animation: `float-up ${p.duration}s linear ${p.delay}s infinite`,
            transform: `translateX(${p.sway}px)`,
            filter: "blur(1px)",
            boxShadow: "0 0 12px rgba(0,0,0,0.35)",
            borderRadius: "50%",
          }}
        />
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
        {/* Particle field */}
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
            className="h-14 text-sm font-pixel bg-primary hover:bg-primary/80 text-primary-foreground glow-green immersive-fade-in immersive-border-breathe"
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

          <Button
            onClick={() => navigate("/pw")}
            variant="outline"
            className="h-14 text-sm font-pixel border-border text-muted-foreground hover:text-foreground hover:bg-muted immersive-fade-in"
            style={{ "--delay": "3.0s" } as React.CSSProperties}
          >
            🔐 PW EXAM
          </Button>

          <Button
            onClick={() => navigate("/test-crossy-road")}
            variant="outline"
            className="h-14 text-sm font-pixel border-accent text-accent hover:bg-accent/10 immersive-fade-in"
            style={{ "--delay": "3.2s" } as React.CSSProperties}
          >
            🐔 TEST CROSSY ROAD
          </Button>
        </div>

        {/* Watermark */}
        <div
          className="absolute bottom-6 left-1/2 text-[10px] font-mono tracking-[0.3em] uppercase text-muted-foreground/20 whitespace-nowrap z-10"
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
          🐔 TEST CROSSY ROAD
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
