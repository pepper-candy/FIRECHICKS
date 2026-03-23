import { useState } from 'react';
import { Zap, Heart, Wind, Shield, ChevronUp, Crosshair, Lock } from 'lucide-react';
import type { PropItem, PropType } from '@/lib/gameTypes';

interface Props {
  items: PropItem[];
  onUse: (propType: PropType) => void;
}

const PROP_ICONS: Record<PropType, React.ReactNode> = {
  speed: <Zap className="w-6 h-6" />,
  heal: <Heart className="w-6 h-6" />,
  fly: <Wind className="w-6 h-6" />,
  invincible: <Shield className="w-6 h-6" />,
  teleport: <Crosshair className="w-6 h-6" />,
  cage: <Lock className="w-6 h-6" />,
};

const PROP_COLORS: Record<PropType, string> = {
  speed: 'hsl(48 96% 53%)',
  heal: 'hsl(145 80% 50%)',
  fly: 'hsl(220 80% 55%)',
  invincible: 'hsl(45 100% 55%)',
  teleport: 'hsl(280 80% 60%)',
  cage: 'hsl(0 70% 50%)',
};

export default function PropsButton({ items, onUse }: Props) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const available = items.filter((i) => i.count > 0);
  const current = available[selectedIdx % available.length];
  const hasMultiple = available.length > 1;

  if (!current) {
    return (
      <div className="w-16 h-16 rounded-full border-2 border-muted bg-muted/20 flex items-center justify-center opacity-40">
        <Zap className="w-6 h-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center">
      {hasMultiple && (
        <button
          onClick={() => setSelectedIdx((i) => i + 1)}
          className="mb-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
      <button
        onClick={() => onUse(current.type)}
        className="relative w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all active:scale-90"
        style={{
          borderColor: PROP_COLORS[current.type],
          color: PROP_COLORS[current.type],
          boxShadow: `0 0 12px ${PROP_COLORS[current.type].replace(')', ' / 0.3)')}`,
        }}
      >
        {PROP_ICONS[current.type]}
        {/* Count badge */}
        <span
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center bg-card border"
          style={{ borderColor: PROP_COLORS[current.type], color: PROP_COLORS[current.type] }}
        >
          {current.count}
        </span>
      </button>
    </div>
  );
}
