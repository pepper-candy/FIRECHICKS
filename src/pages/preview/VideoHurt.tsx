import VideoOverlay from '@/components/VideoOverlay';

export default function PreviewVideoHurt() {
  return (
    <div className="h-dvh bg-background">
      <VideoOverlay video="hurt" onComplete={() => alert('Video complete!')} />
    </div>
  );
}
