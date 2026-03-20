import HitboxChallenge from '@/components/events/HitboxChallenge';
import type { GameEvent } from '@/lib/gameTypes';
import { createMockSnapshot } from './mockData';

export default function PreviewHitboxHost() {
  const snapshot = createMockSnapshot();
  const event: GameEvent = {
    type: 'hitbox',
    phase: 'active',
    startedAt: Date.now() - 3000,
    endAt: Date.now() + 7000,
    chickClicks: { 'chick-1': 15, 'chick-2': 22 },
    eagleClicks: { 'eagle-1': 30 },
    result: 'pending',
  };

  return (
    <div className="h-dvh bg-background flex items-center justify-center">
      <div className="w-full max-w-lg">
        <HitboxChallenge event={event} players={snapshot.players} gameMode="1v3" />
      </div>
    </div>
  );
}
