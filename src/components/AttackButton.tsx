import { useState, useEffect, useCallback, useRef } from 'react';
import { Swords } from 'lucide-react';

interface Props {
  onAttack: () => void;
  cooldownUntil: number; // timestamp
  disabled?: boolean;
}

export default function AttackButton({ onAttack, cooldownUntil, disabled }: Props) {
  const [now, setNow] = useState(Date.now());
  const totalCdRef = useRef(5000);

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
      if (total > 0 && total > totalCdRef.current * 0.8) {
        totalCdRef.current = total;
      }
    }
    if (!onCooldown) {
      totalCdRef.current = 5000;
    }
  }, [cooldownUntil, onCooldown]);

  const handlePress = useCallback(() => {
    if (!onCooldown && !disabled) onAttack();
  }, [onAttack, onCooldown, disabled]);

  const progress = Math.max(0, Math.min(1, 1 - remainingMs / totalCdRef.current));

  const inactive = onCooldown || !!disabled;

  return (
    <button
      onPointerDown={(e) => { e.stopPropagation(); if (!inactive) onAttack(); }}
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
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100" style={{ pointerEvents: 'none' }}>
          <circle
            cx="50" cy="50" r="44"
            fill="none" stroke="hsl(0 80% 55% / 0.6)" strokeWidth="6"
            strokeDasharray={`${progress * 276.5} 276.5`}
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
