import { useState, useEffect, useCallback } from 'react';
import { Swords } from 'lucide-react';

interface Props {
  onAttack: () => void;
  cooldownUntil: number; // timestamp
  disabled?: boolean;
}

export default function AttackButton({ onAttack, cooldownUntil, disabled }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, cooldownUntil - now);
  const onCooldown = remainingMs > 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  const handlePress = useCallback(() => {
    if (!onCooldown && !disabled) onAttack();
  }, [onAttack, onCooldown, disabled]);

  return (
    <button
      onClick={handlePress}
      disabled={onCooldown || disabled}
      className={`relative w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all select-none ${
        onCooldown || disabled
          ? 'border-muted bg-muted/30 opacity-50'
          : 'border-destructive bg-destructive/20 hover:bg-destructive/30 active:scale-95'
      }`}
      style={{
        boxShadow: onCooldown || disabled ? 'none' : '0 0 20px hsl(0 80% 55% / 0.4)',
      }}
    >
      {onCooldown ? (
        <span className="text-2xl font-bold font-mono text-muted-foreground">{remainingSec}</span>
      ) : (
        <Swords className="w-10 h-10 text-destructive" />
      )}
      {onCooldown && (
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r="44"
            fill="none" stroke="hsl(0 80% 55% / 0.3)" strokeWidth="4"
            strokeDasharray={`${(1 - remainingMs / 5000) * 276.5} 276.5`}
          />
        </svg>
      )}
    </button>
  );
}
