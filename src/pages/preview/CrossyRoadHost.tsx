import CrossyRoadHost from '@/components/events/CrossyRoadHost';
import type { GameEvent, CrossyLane } from '@/lib/gameTypes';
import { createMockSnapshot } from './mockData';

const mockLanes: CrossyLane[] = [
  { id: 1, direction: 'left', speed: 3, obstacles: [{ x: 20, width: 8 }, { x: 60, width: 10 }] },
  { id: 2, direction: 'right', speed: 4, obstacles: [{ x: 10, width: 6 }, { x: 45, width: 8 }, { x: 80, width: 7 }] },
  { id: 3, direction: 'left', speed: 2.5, obstacles: [{ x: 30, width: 12 }, { x: 70, width: 9 }] },
  { id: 4, direction: 'right', speed: 5, obstacles: [{ x: 15, width: 7 }, { x: 55, width: 6 }] },
  { id: 5, direction: 'left', speed: 3.5, obstacles: [{ x: 25, width: 10 }, { x: 65, width: 8 }, { x: 90, width: 5 }] },
];

export default function PreviewCrossyRoadHost() {
  const snapshot = createMockSnapshot();
  const event: GameEvent = {
    type: 'crossy-road',
    phase: 'active',
    startedAt: Date.now() - 5000,
    endAt: Date.now() + 25000,
    chickClicks: {},
    eagleClicks: {},
    result: 'pending',
    crossyLanes: mockLanes,
    crossyPlayerStates: {
      'chick-1': { laneIndex: 2, xPosition: 35, crossings: 1, hitCount: 0 },
      'chick-2': { laneIndex: 4, xPosition: 50, crossings: 2, hitCount: 1 },
      'chick-3': { laneIndex: 0, xPosition: 45, crossings: 0, hitCount: 0 },
    },
    eagleSpeedBoost: 1.2,
  };

  return (
    <div className="h-dvh bg-background flex items-center justify-center">
      <div className="w-full max-w-lg">
        <CrossyRoadHost event={event} players={snapshot.players} gameMode="1v3" />
      </div>
    </div>
  );
}
