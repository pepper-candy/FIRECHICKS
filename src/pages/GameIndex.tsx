import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useFullscreen } from '@/hooks/useFullscreen';
import AssetLoadingIndicator from '@/components/AssetLoadingIndicator';
import { useAssetLoading } from '@/context/AssetLoadingContext';
import { toast } from '@/components/ui/sonner';
import { ArrowDownToLine, Check, Loader2 } from 'lucide-react';

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
        ready
          ? 'Character files loaded'
          : loading
            ? `Loading character files ${progress}%`
            : 'Download character files'
      }
      className="relative flex items-center justify-center w-9 h-9 rounded focus:outline-none"
    >
      <svg width="36" height="36" viewBox="0 0 36 36" className="absolute top-0 left-0">
        {/* Track ring */}
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth="2.5"
          className={ready ? 'stroke-green-500/30' : 'stroke-muted-foreground/30'}
        />
        {/* Progress arc */}
        {(loading || ready) && (
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            className={ready ? 'stroke-green-500' : 'stroke-primary'}
            strokeDasharray={`${dash} ${circumference}`}
            transform="rotate(-90 18 18)"
          />
        )}
      </svg>

      {/* Center icon / text */}
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

// ── Main page ─────────────────────────────────────────────────────────────────

const Index = () => {
  const navigate = useNavigate();
  const { isFullscreen, showImmersiveControl, enter } = useFullscreen();
  const {
    isMobile,
    fullReady,
    characterAnimationsReady,
    characterAnimationsLoading,
    characterAnimationsProgress,
    startFullPreload,
    startCharacterAnimationPreload,
  } = useAssetLoading();

  // Tracks whether the user pressed HOST on mobile and is waiting for full preload
  const [hostPending, setHostPending] = useState(false);
  // Tracks whether the user pressed CHARACTER VIEWER (to trigger download if needed)
  const [charViewerPending, setCharViewerPending] = useState(false);

  // Navigate to /host as soon as full assets are ready (for mobile host flow)
  useEffect(() => {
    if (hostPending && fullReady) {
      setHostPending(false);
      navigate('/host');
    }
  }, [hostPending, fullReady, navigate]);

  // Navigate to /character once character animations finish loading
  useEffect(() => {
    if (charViewerPending && characterAnimationsReady) {
      setCharViewerPending(false);
      navigate('/character');
    }
  }, [charViewerPending, characterAnimationsReady, navigate]);

  const handleHostClick = () => {
    if (isMobile && !fullReady) {
      startFullPreload();
      setHostPending(true);
      // Stay on this page; navigate happens via effect above once fullReady
      return;
    }
    navigate('/host');
  };

  const handleCharViewerClick = () => {
    if (!isMobile) {
      navigate('/character');
      return;
    }
    if (characterAnimationsReady) {
      navigate('/character');
      return;
    }
    if (characterAnimationsLoading) {
      toast('Please wait for character files to finish loading.');
      return;
    }
    // Not loaded and not loading — start download and set pending
    startCharacterAnimationPreload();
    setCharViewerPending(true);
  };

  const handleCharAnimCircleClick = () => {
    if (characterAnimationsReady || characterAnimationsLoading) return;
    startCharacterAnimationPreload();
  };

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

      <div className="text-center space-y-4">
        <h1 className="text-xl md:text-3xl text-primary text-glow-green tracking-wider leading-relaxed">
          EAGLE VS CHICK
        </h1>
        <p className="text-sm text-muted-foreground font-mono max-w-md">
          1 V 3 — control characters across devices
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        {/* HOST GAME */}
        <Button
          onClick={handleHostClick}
          disabled={hostPending}
          className="h-14 text-sm font-pixel bg-primary hover:bg-primary/80 text-primary-foreground glow-green"
        >
          {hostPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading assets…
            </span>
          ) : (
            'HOST GAME'
          )}
        </Button>

        {/* JOIN GAME */}
        <Button
          onClick={() => navigate('/client')}
          variant="outline"
          className="h-14 text-sm font-pixel border-secondary text-secondary hover:bg-secondary/10 glow-purple"
        >
          JOIN GAME
        </Button>

        {/* CHARACTER VIEWER + optional download circle */}
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

        {/* PW EXAM */}
        <Button
          onClick={() => navigate('/pw')}
          variant="outline"
          className="h-14 text-sm font-pixel border-border text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          🔐 PW EXAM
        </Button>

        {/* CROSSY ROAD LAB */}
        <Button
          onClick={() => navigate('/test-crossy-road')}
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
