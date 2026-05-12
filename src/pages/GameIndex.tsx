import { assetUrl } from '@/lib/assets';
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useFullscreen } from "@/hooks/useFullscreen";
import AssetLoadingIndicator from "@/components/AssetLoadingIndicator";
import { useAssetLoading } from "@/context/AssetLoadingContext";
import { useImmersive } from "@/context/ImmersiveContext";
import { toast } from "@/components/ui/sonner";
import { ArrowDownToLine, Check, Loader2, Sparkles } from "lucide-react";
import FireParticleField from "@/components/FireParticleField";

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
  const text = "FIRECHICKS";
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

// ParticleField is now imported from @/components/FireParticleField
// ── Main page ─────────────────────────────────────────────────────────────────

const Index = () => {
  const navigate = useNavigate();
  const { isFullscreen, showImmersiveControl, enter } = useFullscreen();
  const { isImmersive, toggleImmersive, isKiosk, toggleKiosk } = useImmersive();
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
  const handleHostClickRef = useRef<() => void>(() => {});
  const [creditReady, setCreditReady] = useState(true);
  const { entryReady } = useAssetLoading();

  useEffect(() => {
    setMounted(true);
  }, []);

  // useEffect(() => {
  //   // Only bother checking if the website's assets are done loading
  //   if (!entryReady) return;
  
  //   // Try the new standard Cache API approach
  //   if ('caches' in window) {
  //     caches.open('firechick-assets').then((cache) => {
  //       return cache.match(assetUrl('/Animations/Credit.mp4'));
  //     }).then((match) => {
  //       if (match) {
  //         setCreditReady(true);
  //       }
  //     }).catch(() => {});
  //   }
    
  //   // Fallback: if the file is served by the service worker, it's definitely ready
  //   const testUrl = assetUrl('/Animations/Credit.mp4');
  //   fetch(testUrl, { method: 'HEAD' }).then((res) => {
  //     if (res.ok) {
  //       setCreditReady(true);
  //     }
  //   }).catch(() => {});
  
  // }, [entryReady]);

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

  // Keep ref in sync with handleHostClick
  useEffect(() => {
    handleHostClickRef.current = handleHostClick;
  }, [handleHostClick]);

  // Spacebar = HOST GAME
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleHostClickRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        <FireParticleField />
        {/* Scanline overlay */}
        {/* <div className="immersive-scanline-overlay" /> */}
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
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded border border-primary/60 text-primary text-xs font-mono hover:bg-primary/10 z-50 immersive-border-breathe !opacity-0 cursor-default" // disabled cursor and immersive-fade-in
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
        </div>

        {/* Buttons — staggered fade-in */}
        {isKiosk ? (
          <div className="flex flex-col gap-4 w-full max-w-xs z-10 items-center">
            <p className="text-sm font-mono text-muted-foreground text-center immersive-fade-in"
              style={{ "--delay": "2.0s" } as React.CSSProperties}>
              Press the button below to begin
            </p>
            <Button
              onClick={handleHostClick}
              disabled={hostPending}
              className="h-16 w-full text-lg font-pixel bg-red-600 hover:bg-red-500 text-white border-red-500/50 glow-red immersive-fade-in"
              style={{ "--delay": "2.4s" } as React.CSSProperties}
            >
              {hostPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading assets…
                </span>
              ) : (
                "▶ START GAME"
              )}
            </Button>
          </div>
        ) : (
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
            {/* Credits button */}
            <Button
              onClick={() => navigate("/credits")}
              variant="outline"
              className="h-14 text-sm font-pixel border-[#7d6a9d] text-[#7d6a9d] bg-transparent hover:bg-[#7d6a9d]/10 immersive-fade-in"
              style={{ "--delay": "3.0s", animationFillMode: "both" } as React.CSSProperties}
            >
              🎬 CREDITS
            </Button>
          </div>
        )}

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
          <p>GPA-Killers want your grade.</p>
          <p>Firechicks want to graduate.</p>
          <p>GPA-Killers vs Firechicks – who survives?</p>
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

      {/* Kiosk toggle — dev only */}
      <button
        onClick={toggleKiosk}
        className={`absolute top-4 left-36 flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-mono transition-colors ${
          isKiosk
            ? 'border-primary/40 text-primary bg-primary/10'
            : 'border-muted-foreground/20 text-muted-foreground/40 hover:border-muted-foreground/40'
        }`}
      >
        {isKiosk ? '🖥 KIOSK ON' : 'KIOSK'}
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

        {creditReady && (
          <Button
            onClick={() => navigate("/credits")}
            variant="outline"
            className="h-14 text-sm font-pixel border-[#7d6a9d] text-[#7d6a9d] bg-transparent hover:bg-[#7d6a9d]/10"
            >
            🎬 CREDITS
          </Button>
        )}
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
