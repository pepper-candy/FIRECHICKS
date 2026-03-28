import Thumbstick from '@/components/Thumbstick';
import AttackButton from '@/components/AttackButton';
import type { PropItem, PropType } from '@/lib/gameTypes';
import { Wind, Lock } from 'lucide-react';
import { buzz } from '@/lib/haptics';

const CIRCUMFERENCE = 2 * Math.PI * 22; // ~138.23 for r=22 in viewBox 0 0 50 50

interface HitboxBtnProps {
  onHit: () => void;
  inZone: boolean;
}

function HitboxBtn({ onHit, inZone }: HitboxBtnProps) {
  return (
    <button
      onClick={onHit}
      className={`w-full rounded border flex items-center justify-center transition-all active:scale-95 ${
        inZone
          ? 'border-destructive/70 bg-destructive/20 hover:bg-destructive/30 animate-pulse'
          : 'border-border bg-card/50'
      }`}
      style={{ aspectRatio: '873/457' }}
    >
      <div className="flex flex-col items-center gap-1">
        <span className={`text-lg font-pixel ${inZone ? 'text-destructive' : 'text-muted-foreground'}`}>
          {inZone ? '⚡ HITBOX' : 'HITBOX'}
        </span>
        {inZone && <span className="text-[10px] font-mono text-destructive/70">Tap to damage zone</span>}
      </div>
    </button>
  );
}

interface CooldownRingButtonProps {
  onPress: () => void;
  icon: React.ReactNode;
  remainingMs: number;
  totalCooldownMs: number;
  color: string;
  cooldownColor: string;
  size?: number;
}

function CooldownRingButton({ onPress, icon, remainingMs, totalCooldownMs, color, cooldownColor, size = 56 }: CooldownRingButtonProps) {
  const onCooldown = remainingMs > 0;
  const cdSec = onCooldown ? Math.ceil(remainingMs / 1000) : 0;
  const ratio = totalCooldownMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalCooldownMs)) : 0;
  const dashLen = ratio * CIRCUMFERENCE;
  const svgSize = size + 8;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <button
        type="button"
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onPress(); }}
        className="w-full h-full rounded-full border-2 flex items-center justify-center transition-all active:scale-90"
        style={{
          position: 'relative',
          zIndex: 1,
          borderColor: color,
          color: color,
          boxShadow: onCooldown ? 'none' : `0 0 12px ${color.replace(')', ' / 0.35)')}`,
          touchAction: 'manipulation',
          opacity: onCooldown ? 0.5 : 1,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {onCooldown ? (
          <span className="text-xs font-mono font-bold">{cdSec}s</span>
        ) : (
          icon
        )}
      </button>
      {onCooldown && (
        <svg
          width={svgSize} height={svgSize}
          viewBox="0 0 50 50"
          style={{
            position: 'absolute',
            top: -4, left: -4,
            transform: 'rotate(-90deg)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <circle
            cx="25" cy="25" r="22"
            fill="none"
            stroke={cooldownColor}
            strokeOpacity="0.9"
            strokeWidth="4"
            strokeDasharray={`${dashLen} ${CIRCUMFERENCE}`}
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}

interface Props {
  onMove: (x: number, y: number) => void;
  onIdleChange: (idle: boolean) => void;
  onAttack: () => void;
  onHitboxClick: () => void;
  onPropUse: (t: PropType) => void;
  onCageUse?: () => void;
  props: PropItem[];
  attackRemainingMs: number;
  attackDisabled: boolean;
  flyRemainingMs: number;
  cageRemainingMs?: number;
  isInZone: boolean;
  thumbstickColor?: string;
}

export default function EagleControls({
  onMove,
  onIdleChange,
  onAttack,
  onHitboxClick,
  onPropUse,
  onCageUse,
  props,
  attackRemainingMs,
  attackDisabled,
  flyRemainingMs,
  cageRemainingMs = 0,
  isInZone,
  thumbstickColor,
}: Props) {
  // Fly is also blocked during attack cooldown
  const effectiveFlyRemainingMs = Math.max(flyRemainingMs, attackRemainingMs);

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Hitbox */}
      <div className="w-full">
        <HitboxBtn onHit={onHitboxClick} inZone={isInZone} />
      </div>

      {/* Thumbstick */}
      <div className="flex-1 flex items-center justify-center">
        <Thumbstick onMove={onMove} onIdleChange={onIdleChange} size={200} color={thumbstickColor} />
      </div>

      {/* Attack + Fly + Cage */}
      <div className="flex items-center justify-center gap-4">
        <AttackButton
          onAttack={onAttack}
          remainingMs={attackRemainingMs}
          disabled={attackDisabled}
        />

        <CooldownRingButton
          onPress={() => onPropUse('fly')}
          icon={<Wind className="w-6 h-6" />}
          remainingMs={effectiveFlyRemainingMs}
          totalCooldownMs={10000}
          color="hsl(220 80% 55%)"
          cooldownColor="hsl(220 80% 65%)"
        />

        <CooldownRingButton
          onPress={() => { if (onCageUse) onCageUse(); }}
          icon={<Lock className="w-6 h-6" />}
          remainingMs={cageRemainingMs}
          totalCooldownMs={30000}
          color="hsl(0 70% 50%)"
          cooldownColor="hsl(0 70% 60%)"
        />
      </div>
    </div>
  );
}
