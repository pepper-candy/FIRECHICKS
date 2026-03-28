import { useState, useEffect, useCallback, useRef } from 'react';
import { Swords } from 'lucide-react';

interface Props {
  onAttack: () => void;
  cooldownUntil: number; // timestamp
  disabled?: boolean;
}

const ATTACK_COOLDOWN_MS = 3000;
const CIRCUMFERENCE = 2 * Math.PI * 44; // ~276.46

export default function AttackButton({ onAttack, cooldownUntil, disabled }: Props) {
  const [now, setNow] = useState(Date.now());
  const totalCdRef = useRef(ATTACK_COOLDOWN_MS);
  const previousCooldownRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, cooldownUntil - now);
  const onCooldown = remainingMs > 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  // Capture total cooldown when a new cooldown starts
  useEffect(() => {
    if (cooldownUntil > previousCooldownRef.current) {
      totalCdRef.current = ATTACK_COOLDOWN_MS;
    }
    previousCooldownRef.current = cooldownUntil;
  }, [cooldownUntil]);

  // Reset when cooldown ends
  useEffect(() => {
    if (!onCooldown) {
      totalCdRef.current = ATTACK_COOLDOWN_MS;
    }
  }, [onCooldown]);

  const remainingRatio = totalCdRef.current > 0
    ? Math.max(0, Math.min(1, remainingMs / totalCdRef.current))
    : 0;

  const dashLen = remainingRatio * CIRCUMFERENCE;

  const inactive = onCooldown || !!disabled;

  return (
    <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
      <button
        type="button"
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); if (!inactive) onAttack(); }}
        className={`w-full h-full rounded-full border-4 flex items-center justify-center transition-all select-none ${
          inactive
            ? 'border-muted bg-muted/30'
            : 'border-destructive bg-destructive/20 active:scale-95'
        }`}
        style={{
          position: 'relative',
          zIndex: 1,
          boxShadow: inactive ? 'none' : '0 0 20px hsl(0 80% 55% / 0.4)',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {onCooldown ? (
          <span className="text-lg font-bold font-mono" style={{ color: 'hsl(0 80% 75%)' }}>{remainingSec}</span>
        ) : (
          <Swords className={`w-8 h-8 ${disabled ? 'text-muted-foreground' : 'text-destructive'}`} />
        )}
      </button>
      {onCooldown && (
        <svg
          width="88" height="88"
          viewBox="0 0 100 100"
          style={{
            position: 'absolute',
            top: -4, left: -4,
            transform: 'rotate(-90deg)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <circle
            cx="50" cy="50" r="44"
            fill="none"
            stroke="hsl(0 90% 60%)"
            strokeOpacity="0.95"
            strokeWidth="8"
            strokeDasharray={`${dashLen} ${CIRCUMFERENCE}`}
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}
