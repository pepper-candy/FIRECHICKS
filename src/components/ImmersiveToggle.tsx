import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { useImmersive } from '@/context/ImmersiveContext';

/**
 * Immersive mode toggle button.
 * When ON: auto-collapses to icon-only after 5s, click to expand for 10s.
 * When OFF: stays fully expanded (no collapse).
 */
export default function ImmersiveToggle({ immersiveVariant = false }: { immersiveVariant?: boolean }) {
  const { isImmersive, toggleImmersive } = useImmersive();
  const [collapsed, setCollapsed] = useState(false);
  const [showText, setShowText] = useState(true);
  const collapseTimer = useRef<ReturnType<typeof setTimeout>>();

  // Auto-collapse when immersive is ON
  useEffect(() => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);

    if (isImmersive) {
      setCollapsed(false);
      setShowText(true);
      collapseTimer.current = setTimeout(() => setCollapsed(true), 5000);
    } else {
      setCollapsed(false);
      setShowText(true);
    }

    return () => { if (collapseTimer.current) clearTimeout(collapseTimer.current); };
  }, [isImmersive]);

  // Hide text after collapse transition
  useEffect(() => {
    if (collapsed) {
      const t = setTimeout(() => setShowText(false), 400);
      return () => clearTimeout(t);
    } else {
      setShowText(true);
    }
  }, [collapsed]);

  const handleClick = useCallback(() => {
    if (isImmersive && collapsed) {
      // Expand for 10s then collapse again
      setCollapsed(false);
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      collapseTimer.current = setTimeout(() => setCollapsed(true), 10000);
      return;
    }
    toggleImmersive();
  }, [isImmersive, collapsed, toggleImmersive]);

  const label = isImmersive ? 'IMMERSIVE ON' : 'GO IMMERSIVE';

  if (immersiveVariant) {
    return (
      <button
        onClick={handleClick}
        className="absolute top-4 left-4 flex items-center py-1.5 rounded border border-primary/60 text-primary text-xs font-mono hover:bg-primary/10 z-50 immersive-border-breathe immersive-fade-in overflow-hidden transition-all duration-400 ease-in-out"
        style={{
          "--delay": "0.1s",
          cursor: 'pointer',
          width: collapsed ? '36px' : undefined,
          paddingLeft: collapsed ? '10px' : '12px',
          paddingRight: collapsed ? '10px' : '12px',
        } as React.CSSProperties}
      >
        <Sparkles className="w-3 h-3 flex-shrink-0" />
        <div
          className="overflow-hidden transition-all duration-400 ease-in-out"
          style={{
            maxWidth: collapsed ? '0px' : '120px',
            opacity: collapsed ? 0 : 1,
            marginLeft: collapsed ? '0px' : '8px',
          }}
        >
          {showText && <span className="whitespace-nowrap">{label}</span>}
        </div>
      </button>
    );
  }

  // Standard (non-immersive) variant — no collapse
  return (
    <button
      onClick={handleClick}
      className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded border border-muted-foreground/30 text-muted-foreground text-xs font-mono hover:border-primary/50 hover:text-primary transition-colors"
    >
      <Sparkles className="w-3 h-3" />
      {label}
    </button>
  );
}
