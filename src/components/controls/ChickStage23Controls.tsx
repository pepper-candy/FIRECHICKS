import Thumbstick from '@/components/Thumbstick';
import ScannerBox from '@/components/ScannerBox';
import type { PropItem, PropType } from '@/lib/gameTypes';
import { Zap, Heart, Shield, Crosshair } from 'lucide-react';
import { useState, useEffect } from 'react';

const PROP_COLORS: Record<string, string> = {
  speed: 'hsl(48 96% 53%)',
  heal: 'hsl(145 80% 50%)',
  invincible: 'hsl(45 100% 55%)',
  teleport: 'hsl(280 80% 60%)',
};
const PROP_ICONS: Record<string, React.ReactNode> = {
  speed: <Zap className="w-5 h-5" />,
  heal: <Heart className="w-5 h-5" />,
  invincible: <Shield className="w-5 h-5" />,
  teleport: <Crosshair className="w-5 h-5" />,
};

interface TipsBoxProps {
  tipIndex: 0 | 1;
  hasTip: boolean;
  isLoadingTip: boolean;
  tipShareCooldownUntil: number;
  tipCopyingCountdown?: number;
  onTap: () => void;
}

function TipsBox({ tipIndex, hasTip, isLoadingTip, tipShareCooldownUntil, tipCopyingCountdown, onTap }: TipsBoxProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const onCooldown = now < tipShareCooldownUntil;
  const cooldownSec = Math.ceil(Math.max(0, tipShareCooldownUntil - now) / 1000);

  if (hasTip) {
    return (
      <button
        onClick={!onCooldown ? onTap : undefined}
        className={`flex-1 h-14 rounded border-2 flex items-center justify-center text-xs font-mono transition-all active:scale-95 ${
          onCooldown
            ? 'border-border bg-card/40 text-muted-foreground'
            : 'border-accent bg-accent/20 text-accent hover:bg-accent/30'
        }`}
      >
        {onCooldown ? `⏳ ${cooldownSec}s` : `💡 Tips ${tipIndex + 1}`}
      </button>
    );
  }

  if (isLoadingTip) {
    return (
      <div className="flex-1 h-14 rounded border border-secondary bg-secondary/10 flex items-center justify-center text-xs font-mono text-secondary animate-pulse">
        {tipCopyingCountdown !== undefined && tipCopyingCountdown > 0
          ? `📋 Copying... ${tipCopyingCountdown}s`
          : '📋 Copying...'}
      </div>
    );
  }

  return (
    <div className="flex-1 h-14 rounded border border-border bg-card flex items-center justify-center text-xs font-mono text-muted-foreground">
      Tips {tipIndex + 1}
    </div>
  );
}

interface Props {
  tips: [boolean, boolean];
  loadingTip: [boolean, boolean];
  tipShareCooldownUntil: number;
  tipExpiryCooldown: [number, number];
  tipCopyStartedAt: [number, number];
  clockNow: number;
  activeScannerQr: string | null;
  scannerQrExpireAt: number;
  onMove: (x: number, y: number) => void;
  onIdleChange: (idle: boolean) => void;
  onScan: (data: string) => void;
  onPropUse: (t: PropType) => void;
  onTipTap: (tipIndex: 0 | 1) => void;
  onDismissQr: () => void;
  props: PropItem[];
  thumbstickColor?: string;
  stageInstruction: string;
}

export default function ChickStage23Controls({
  tips,
  loadingTip,
  tipShareCooldownUntil,
  tipExpiryCooldown,
  tipCopyStartedAt,
  clockNow,
  activeScannerQr,
  scannerQrExpireAt,
  onMove,
  onIdleChange,
  onScan,
  onPropUse,
  onTipTap,
  onDismissQr,
  props,
  thumbstickColor,
  stageInstruction,
}: Props) {
  const availableProps = props.filter((i) => i.count > 0);

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Scanner with QR display */}
      <div className="w-full">
        <ScannerBox
          onScan={onScan}
          label="SCANNER — scan props & tips"
          aspectRatio="873/457"
          displayQr={activeScannerQr}
          displayQrCountdown={scannerQrExpireAt > 0 ? Math.max(0, Math.ceil((scannerQrExpireAt - clockNow) / 1000)) : undefined}
          onDismissQr={onDismissQr}
        />
      </div>

      {/* Tips boxes */}
      <div className="flex gap-2 w-full">
        <TipsBox
          tipIndex={0}
          hasTip={tips[0]}
          isLoadingTip={loadingTip[0]}
          tipShareCooldownUntil={Math.max(tipShareCooldownUntil, tipExpiryCooldown[0])}
          tipCopyingCountdown={loadingTip[0] && tipCopyStartedAt[0] > 0 ? Math.max(0, Math.ceil((tipCopyStartedAt[0] + 3000 - clockNow) / 1000)) : undefined}
          onTap={() => onTipTap(0)}
        />
        <TipsBox
          tipIndex={1}
          hasTip={tips[1]}
          isLoadingTip={loadingTip[1]}
          tipShareCooldownUntil={Math.max(tipShareCooldownUntil, tipExpiryCooldown[1])}
          tipCopyingCountdown={loadingTip[1] && tipCopyStartedAt[1] > 0 ? Math.max(0, Math.ceil((tipCopyStartedAt[1] + 3000 - clockNow) / 1000)) : undefined}
          onTap={() => onTipTap(1)}
        />
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

        {/* Thumbstick */}
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
