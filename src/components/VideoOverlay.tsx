import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { assetUrl } from '@/lib/assets';
import type { OverlayVideo } from '@/lib/stageInfo';

interface Props {
  video: OverlayVideo | null;
  onComplete: () => void;
  placement?: 'center' | 'top';
  loop?: boolean;
  showBackdrop?: boolean;
  showSkipButton?: boolean;
}

const VIDEO_SRC: Record<OverlayVideo, string> = {
  hurt: assetUrl('/Animations/Hurt.mp4'),
  dead: assetUrl('/Animations/Dead_NEW.mp4'),
  'stage0-transition': assetUrl('/Animations/1_Meet.mp4'),
  'stage1-transition': assetUrl('/Animations/2_Glow_Building.mp4'),
  'stage3-transition': assetUrl('/Animations/4_Final.mp4'),
  'eagle-warning': assetUrl('/Animations/Warning_Eagle.mp4'),
  'credits': assetUrl('/Animations/Credit.mp4'),
};

export default function VideoOverlay({
  video,
  onComplete,
  placement = 'center',
  loop = false,
  showBackdrop = true,
  showSkipButton = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!video || !videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().catch((err) => {
      console.error('Video playback failed:', err);
    });
  }, [video]);

  if (!video) return null;

  const src = VIDEO_SRC[video];
  const containerClassName =
    placement === 'top'
      ? 'fixed inset-x-0 top-0 flex items-start justify-center pt-4'
      : 'fixed inset-0 flex items-center justify-center';
  const wrapperClassName =
    placement === 'top'
      ? 'relative flex flex-col items-center'
      : 'relative flex flex-col items-center';
  const videoClassName =
    placement === 'top'
      ? 'w-[min(92vw,960px)] max-h-[42vh] rounded-lg shadow-2xl'
      : 'max-w-[80vw] max-h-[60vh] rounded-lg shadow-2xl';

  return createPortal(
    <div
      className={`${containerClassName} ${showBackdrop ? 'bg-background/90' : 'pointer-events-none bg-transparent'}`}
      style={{ zIndex: 2147483647 }}
    >
      <div className={wrapperClassName}>
        <video
          ref={videoRef}
          src={src}
          className={videoClassName}
          onEnded={onComplete}
          onError={(e) => {
            console.error('Video load failed:', e);
            onComplete();
          }}
          playsInline
          muted={false}
          loop={loop}
        />
        {/* Skip button aligned to bottom-right of video */}
        {showSkipButton && (
        <button
          onClick={onComplete}
          className="absolute bottom-2 right-2 pointer-events-auto px-3 py-1.5 rounded bg-card/80 border border-border text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-card transition-all active:scale-95"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          SKIP ▶
        </button>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Preload videos (call once on host) */
export function preloadVideos() {
  const vids = [
    ...Object.values(VIDEO_SRC),
    assetUrl('/Animations/Entrance_NEW.mp4'),
  ];
  vids.forEach((src) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'video';
    link.href = src;
    document.head.appendChild(link);
  });
}
