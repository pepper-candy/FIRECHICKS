import HitboxClient from '@/components/events/HitboxClient';

export default function PreviewHitboxClient() {
  return (
    <div className="h-dvh bg-background">
      <HitboxClient timeLeft={8} isEagle={false} onHit={() => console.log('HIT!')} />
    </div>
  );
}
