import Thumbstick from '@/components/Thumbstick';
import AttackButton from '@/components/AttackButton';
import type { PropItem, PropType } from '@/lib/gameTypes';
import { Wind } from 'lucide-react';
import { useState, useEffect } from 'react';

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

interface Props {
  onMove: (x: number, y: number) => void;
  onIdleChange: (idle: boolean) => void;
  onAttack: () => void;
  onHitboxClick: () => void;
  onPropUse: (t: PropType) => void;
  props: PropItem[];
  attackCooldownUntil: number;
  attackDisabled: boolean;
  flyCooldownUntil: number;
  isInZone: boolean;
  thumbstickColor?: string;
}

export default function EagleControls({
  onMove,
  onIdleChange,
  onAttack,
  onHitboxClick,
  onPropUse,
  props,
  attackCooldownUntil,
  attackDisabled,
  flyCooldownUntil,
  isInZone,
  thumbstickColor,
}: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const effectiveFlyCooldown = Math.max(flyCooldownUntil, attackCooldownUntil);
  const flyOnCooldown = effectiveFlyCooldown > now;
  const flyCdSec = flyOnCooldown ? Math.ceil((effectiveFlyCooldown - now) / 1000) : 0;

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

      {/* Attack + Fly */}
      <div className="flex items-center justify-center gap-6">
        <AttackButton onAttack={onAttack} cooldownUntil={attackCooldownUntil} disabled={attackDisabled} />

        <button
          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onPropUse('fly'); }}
          className="relative w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all active:scale-90"
          style={{
            borderColor: 'hsl(220 80% 55%)',
            color: 'hsl(220 80% 55%)',
            boxShadow: '0 0 12px hsl(220 80% 55% / 0.35)',
            touchAction: 'manipulation',
            opacity: flyOnCooldown ? 0.5 : 1,
          }}
        >
          {flyOnCooldown ? (
            <span className="text-xs font-mono font-bold">{flyCdSec}s</span>
          ) : (
            <Wind className="w-6 h-6" />
          )}
        </button>
      </div>
    </div>
  );
}
