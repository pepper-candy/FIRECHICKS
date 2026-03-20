import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  video: 'hurt' | 'dead' | null;
  onComplete: () => void;
}

export default function VideoOverlay({ video, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!video || !videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().catch(() => {});
  }, [video]);

  if (!video) return null;

  const src = video === 'dead' ? '/Animations/Dead.mp4' : '/Animations/Hurt.mp4';

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-background/90" style={{ zIndex: 99999 }}>
      <div className="relative flex flex-col items-center">
        <video
          ref={videoRef}
          src={src}
          className="max-w-[80vw] max-h-[60vh] rounded-lg shadow-2xl"
          onEnded={onComplete}
          playsInline
          muted={false}
        />
        {/* Skip button aligned to bottom-right of video */}
        <button
          onClick={onComplete}
          className="absolute bottom-2 right-2 px-3 py-1.5 rounded bg-card/80 border border-border text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-card transition-all active:scale-95"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          SKIP ▶
        </button>
      </div>
    </div>,
    document.body
  );
}

/** Preload videos (call once on host) */
export function preloadVideos() {
  const vids = ['/Animations/Hurt.mp4', '/Animations/Dead.mp4'];
  vids.forEach((src) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'video';
    link.href = src;
    document.head.appendChild(link);
  });
}
