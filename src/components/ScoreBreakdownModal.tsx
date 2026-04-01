import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PLAYER_COLORS } from '@/lib/playerColors';
import type { PlayerGameStateSerializable } from '@/lib/gameTypes';
import { Info } from 'lucide-react';

const CHICK_BREAKDOWN_ORDER = [
  'obtain-tip', 'receive-tip', 'collect-prop', 'use-prop', 'mystery-box',
  'crossy-road', 'mock-exam', 'final-exam', 'social-circle', 'survival', 'hitbox',
];
const EAGLE_BREAKDOWN_ORDER = [
  'deal-damage', 'use-prop', 'cage', 'mystery-box', 'building-hp', 'hitbox', 'crossy-road',
];

export default function ScoreBreakdownModal({ player }: { player: PlayerGameStateSerializable }) {
  const color = PLAYER_COLORS[player.colorIndex];
  const breakdown = player.scoreBreakdown ?? {};
  const order = player.isEagle ? EAGLE_BREAKDOWN_ORDER : CHICK_BREAKDOWN_ORDER;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-0.5 hover:text-accent transition-colors" title="View score breakdown">
          <Info className="w-3.5 h-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-pixel">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `hsl(${color?.hsl ?? '0 0% 50%'})` }} />
            <span style={{ color: `hsl(${color?.hsl ?? '0 0% 50%'})` }}>{color?.name}</span>
            <span className="text-muted-foreground font-mono text-xs">({player.isEagle ? 'Eagle' : 'Chick'})</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="font-pixel text-sm">Action Score</span>
            <span className="font-bold text-lg">{player.actionScore.toFixed(0)}</span>
          </div>
          <div className="space-y-0.5 pt-1 font-mono text-xs">
            {order.map((key) => {
              const entry = breakdown[key];
              const points = entry?.points ?? 0;
              const count = entry?.count ?? 0;
              const fmtPts = points % 1 ? points.toFixed(1) : points.toFixed(0);
              return (
                <div key={key} className="flex justify-between items-center py-0.5">
                  <span className="text-muted-foreground">{entry?.label ?? key}</span>
                  <span className={points > 0 ? 'text-primary' : 'text-muted-foreground/50'}>
                    +{fmtPts} ({count})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
