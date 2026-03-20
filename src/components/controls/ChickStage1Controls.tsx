import Thumbstick from '@/components/Thumbstick';
import ScannerBox from '@/components/ScannerBox';
import type { PropItem, PropType } from '@/lib/gameTypes';
import { Zap, Heart, Shield } from 'lucide-react';

const PROP_COLORS: Record<string, string> = {
  speed: 'hsl(48 96% 53%)',
  heal: 'hsl(145 80% 50%)',
  invincible: 'hsl(45 100% 55%)',
};
const PROP_ICONS: Record<string, React.ReactNode> = {
  speed: <Zap className="w-5 h-5" />,
  heal: <Heart className="w-5 h-5" />,
  invincible: <Shield className="w-5 h-5" />,
};

interface Props {
  socialMet: number;
  onMove: (x: number, y: number) => void;
  onIdleChange: (idle: boolean) => void;
  onScan: (data: string) => void;
  onPropUse: (t: PropType) => void;
  props: PropItem[];
  thumbstickColor?: string;
  stageInstruction: string;
}

export default function ChickStage1Controls({
  socialMet,
  onMove,
  onIdleChange,
  onScan,
  onPropUse,
  props,
  thumbstickColor,
  stageInstruction,
}: Props) {
  const availableProps = props.filter((i) => i.count > 0);

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Scanner */}
      <div className="w-full">
        <ScannerBox onScan={onScan} label="SCANNER — scan props" aspectRatio="873/457" />
      </div>

      {/* Social circle boxes */}
      <div className="flex gap-2 w-full">
        {[0, 1].map((idx) => {
          const filled = socialMet > idx;
          return (
            <div
              key={idx}
              className={`flex-1 h-14 rounded border flex items-center justify-center text-xs font-mono transition-all ${
                filled ? 'border-primary bg-primary/20 text-primary' : 'border-border bg-card text-muted-foreground'
              }`}
            >
              {filled ? '✓ Met' : `Meet ${idx + 1}`}
            </div>
          );
        })}
      </div>

      {/* Thumbstick + Props row */}
      <div className="flex-1 flex items-center">
        {/* Props column on left */}
        <div className="flex flex-col gap-2 pr-3" style={{ minWidth: 52 }}>
          {availableProps.map((item) => (
            <button
              key={item.type}
              onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onPropUse(item.type); }}
              className="w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 relative"
              style={{
                borderColor: PROP_COLORS[item.type] ?? 'hsl(var(--border))',
                color: PROP_COLORS[item.type] ?? 'hsl(var(--foreground))',
                touchAction: 'manipulation',
                backgroundColor: 'hsl(var(--card))',
              }}
            >
              {PROP_ICONS[item.type]}
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center bg-card border"
                style={{ borderColor: PROP_COLORS[item.type], color: PROP_COLORS[item.type] }}
              >
                {item.count}
              </span>
            </button>
          ))}
          {availableProps.length === 0 && (
            <div className="w-12 h-12 rounded-full border-2 border-muted bg-muted/20 flex items-center justify-center opacity-30">
              <Zap className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Thumbstick centered in remaining space */}
        <div className="flex-1 flex items-center justify-center">
          <Thumbstick onMove={onMove} onIdleChange={onIdleChange} size={180} color={thumbstickColor} />
        </div>
      </div>

      {/* Stage instruction */}
      <p className="text-[10px] font-mono text-muted-foreground text-center px-2 truncate">
        {stageInstruction}
      </p>
    </div>
  );
}
