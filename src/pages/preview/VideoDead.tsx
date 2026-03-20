import VideoOverlay from '@/components/VideoOverlay';

export default function PreviewVideoDead() {
  return (
    <div className="h-dvh bg-background">
      <VideoOverlay video="dead" onComplete={() => alert('Video complete!')} />
    </div>
  );
}
