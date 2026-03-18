import { useRef, useEffect } from 'react';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90">
      <video
        ref={videoRef}
        src={src}
        className="max-w-[80vw] max-h-[60vh] rounded-lg shadow-2xl"
        onEnded={onComplete}
        playsInline
        muted={false}
      />
    </div>
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
