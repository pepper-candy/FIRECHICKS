import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { assetUrl } from "@/lib/assets";
import { useFullscreen } from "@/hooks/useFullscreen";

export default function CreditsPage() {
  const navigate = useNavigate();
  const { isFullscreen, enter: enterFullscreen } = useFullscreen();
  const [started, setStarted] = useState(false);

  const handleStart = async () => {
    await enterFullscreen();
    const orientation = screen.orientation as any;
    if (orientation?.lock) orientation.lock('landscape').catch(() => {});
    setStarted(true);
  };

  useEffect(() => {
    return () => {
      const orientation = screen.orientation as any;
      if (orientation?.unlock) orientation.unlock();
    };
  }, []);

  if (!isFullscreen && !started) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <button
          onClick={handleStart}
          className="px-10 py-6 rounded-2xl border-2 border-white/30 bg-white/5 text-white font-pixel text-lg tracking-widest hover:bg-white/10 active:scale-95 transition-all"
        >
          ▶ TAP TO WATCH
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <video
        src={assetUrl('/Animations/Credit.mp4')}
        className="w-full h-full object-contain"
        autoPlay
        playsInline
        controls={false}
        onEnded={() => navigate("/")}
      />
      <button
        onClick={() => navigate("/")}
        className="absolute top-4 right-4 px-3 py-1.5 rounded bg-white/10 border border-white/20 text-white/70 text-xs font-mono hover:bg-white/20 transition-all"
      >
        ✕ SKIP
      </button>
    </div>
  );
}