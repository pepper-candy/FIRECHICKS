import CrossyRoadClient from '@/components/events/CrossyRoadClient';
import type { GameEvent, CrossyLane } from '@/lib/gameTypes';

const mockLanes: CrossyLane[] = [
  { id: 1, direction: 'left', speed: 3, obstacles: [{ x: 20, width: 8 }, { x: 60, width: 10 }] },
  { id: 2, direction: 'right', speed: 4, obstacles: [{ x: 10, width: 6 }, { x: 45, width: 8 }, { x: 80, width: 7 }] },
  { id: 3, direction: 'left', speed: 2.5, obstacles: [{ x: 30, width: 12 }, { x: 70, width: 9 }] },
  { id: 4, direction: 'right', speed: 5, obstacles: [{ x: 15, width: 7 }, { x: 55, width: 6 }] },
  { id: 5, direction: 'left', speed: 3.5, obstacles: [{ x: 25, width: 10 }, { x: 65, width: 8 }, { x: 90, width: 5 }] },
];

export default function PreviewCrossyRoadClient() {
  return (
    <div className="h-dvh bg-background">
      <CrossyRoadClient
        event={{
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
          },
          eagleSpeedBoost: 1.0,
        }}
        isEagle={false}
        connId="chick-1"
        onHop={(dir) => console.log('HOP', dir)}
        onEagleAction={(action) => console.log('EAGLE', action)}
      />
    </div>
  );
}
