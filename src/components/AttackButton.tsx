import { useState, useEffect, useCallback, useRef } from 'react';
import { Swords } from 'lucide-react';

interface Props {
  onAttack: () => void;
  cooldownUntil: number; // timestamp
  disabled?: boolean;
}

export default function AttackButton({ onAttack, cooldownUntil, disabled }: Props) {
  const [now, setNow] = useState(Date.now());
  const totalCdRef = useRef(3000);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, cooldownUntil - now);
  const onCooldown = remainingMs > 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  // Track total cooldown duration for SVG ring
  useEffect(() => {
    if (cooldownUntil > 0) {
      const total = cooldownUntil - Date.now();
      if (total > 0) {
        totalCdRef.current = total;
      }
    }
    if (!onCooldown) {
      totalCdRef.current = 3000;
    }
  }, [cooldownUntil, onCooldown]);

  const handlePress = useCallback(() => {
    if (!onCooldown && !disabled) onAttack();
  }, [onAttack, onCooldown, disabled]);

  // Show remaining cooldown ring (full at start, shrinking to 0).
  const remainingRatio = Math.max(0, Math.min(1, remainingMs / totalCdRef.current));

  const inactive = onCooldown || !!disabled;

  return (
    <button
      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); if (!inactive) onAttack(); }}
      className={`relative overflow-visible w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all select-none flex-shrink-0 ${
        inactive
          ? 'border-muted bg-muted/30'
          : 'border-destructive bg-destructive/20 active:scale-95'
      }`}
      style={{
        boxShadow: inactive ? 'none' : '0 0 20px hsl(0 80% 55% / 0.4)',
        touchAction: 'manipulation',
      }}
    >
      {onCooldown ? (
        <span className="text-lg font-bold font-mono" style={{ color: 'hsl(0 80% 75%)' }}>{remainingSec}</span>
      ) : (
        <Swords className={`w-8 h-8 ${disabled ? 'text-muted-foreground' : 'text-destructive'}`} />
      )}
      {onCooldown && (
        <svg className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] -rotate-90 z-10" viewBox="0 0 100 100" style={{ pointerEvents: 'none' }}>
          <circle
            cx="50" cy="50" r="44"
            fill="none" stroke="hsl(0 90% 60% / 0.95)" strokeWidth="8"
            strokeDasharray={`${remainingRatio * 276.5} 276.5`}
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
