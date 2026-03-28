import Thumbstick from '@/components/Thumbstick';
import AttackButton from '@/components/AttackButton';
import type { PropItem, PropType } from '@/lib/gameTypes';
import { Wind, Lock } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

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
  cooldownUntil: number;
  totalCooldownMs: number;
  now: number;
  color: string;        // e.g. 'hsl(220 80% 55%)'
  cooldownColor: string; // ring color
  size?: number;
}

function CooldownRingButton({ onPress, icon, cooldownUntil, totalCooldownMs, now, color, cooldownColor, size = 56 }: CooldownRingButtonProps) {
  const onCooldown = cooldownUntil > now;
  const remainingMs = onCooldown ? Math.max(0, cooldownUntil - now) : 0;
  const cdSec = onCooldown ? Math.ceil(remainingMs / 1000) : 0;
  const totalCdRef = useRef(totalCooldownMs);
  const previousCooldownRef = useRef(0);

  useEffect(() => {
    if (cooldownUntil > previousCooldownRef.current) {
      totalCdRef.current = totalCooldownMs;
    }
    previousCooldownRef.current = cooldownUntil;
  }, [cooldownUntil]);

  useEffect(() => {
    if (!onCooldown) totalCdRef.current = totalCooldownMs;
  }, [onCooldown, totalCooldownMs]);

  const ratio = totalCdRef.current > 0 ? Math.max(0, Math.min(1, remainingMs / totalCdRef.current)) : 0;
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
  attackCooldownUntil: number;
  attackDisabled: boolean;
  flyCooldownUntil: number;
  cageCooldownUntil?: number;
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
  attackCooldownUntil,
  attackDisabled,
  flyCooldownUntil,
  cageCooldownUntil = 0,
  isInZone,
  thumbstickColor,
}: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, []);

  const effectiveFlyCooldown = Math.max(flyCooldownUntil, attackCooldownUntil);

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
        <AttackButton onAttack={onAttack} cooldownUntil={attackCooldownUntil} disabled={attackDisabled} />

        <CooldownRingButton
          onPress={() => onPropUse('fly')}
          icon={<Wind className="w-6 h-6" />}
          cooldownUntil={effectiveFlyCooldown}
          totalCooldownMs={10000}
          now={now}
          color="hsl(220 80% 55%)"
          cooldownColor="hsl(220 80% 65%)"
        />

        <CooldownRingButton
          onPress={() => { if (onCageUse) onCageUse(); }}
          icon={<Lock className="w-6 h-6" />}
          cooldownUntil={cageCooldownUntil}
          totalCooldownMs={30000}
          now={now}
          color="hsl(0 70% 50%)"
          cooldownColor="hsl(0 70% 60%)"
        />
      </div>
    </div>
  );
}
