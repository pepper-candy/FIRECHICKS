import { Sparkles } from 'lucide-react';
import { useImmersive } from '@/context/ImmersiveContext';

/**
 * Immersive mode toggle button — always fully visible, no collapse.
 */
export default function ImmersiveToggle({ immersiveVariant = false }: { immersiveVariant?: boolean }) {
  const { isImmersive, toggleImmersive } = useImmersive();

  const label = isImmersive ? 'IMMERSIVE ON' : 'GO IMMERSIVE';

  if (immersiveVariant) {
    return (
      <button
        onClick={toggleImmersive}
        className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded border border-primary/60 text-primary text-xs font-mono hover:bg-primary/10 z-50 immersive-border-breathe immersive-fade-in"
        style={{ "--delay": "0.1s" } as React.CSSProperties}
      >
        <Sparkles className="w-3 h-3 flex-shrink-0" />
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={toggleImmersive}
      className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded border border-muted-foreground/30 text-muted-foreground text-xs font-mono hover:border-primary/50 hover:text-primary transition-colors"
    >
      <Sparkles className="w-3 h-3" />
      {label}
    </button>
  );
}
