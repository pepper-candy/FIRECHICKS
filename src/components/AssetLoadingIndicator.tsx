import { useState, useEffect, useCallback, useRef } from 'react';
import { Check } from 'lucide-react';
import { useAssetLoading } from '@/context/AssetLoadingContext';

export default function AssetLoadingIndicator() {
  const { entryProgress, entryReady } = useAssetLoading();
  const [collapsed, setCollapsed] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout>>();

  // Auto-collapse 5s after loaded
  useEffect(() => {
    if (!entryReady) {
      setCollapsed(false);
      return;
    }
    collapseTimer.current = setTimeout(() => setCollapsed(true), 5000);
    return () => { if (collapseTimer.current) clearTimeout(collapseTimer.current); };
  }, [entryReady]);

  const handleClick = useCallback(() => {
    if (!entryReady || !collapsed) return;
    setCollapsed(false);
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setCollapsed(true), 10000);
  }, [entryReady, collapsed]);

  if (!entryReady) {
    return (
      <div className="fixed bottom-3 left-3 z-40 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/90 border border-border backdrop-blur-sm shadow-lg">
        <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        <span className="text-[11px] font-mono text-muted-foreground">{entryProgress}%</span>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="fixed bottom-3 left-3 z-40 flex items-center py-1.5 rounded-lg bg-card/90 border border-border backdrop-blur-sm shadow-lg overflow-hidden"
      style={{
        cursor: collapsed ? 'pointer' : 'default',
        paddingLeft: '10px',
        paddingRight: collapsed ? '10px' : '12px',
        transition: 'padding-right 800ms ease-in-out',
      }}
    >
      <Check className="w-4 h-4 text-primary flex-shrink-0" />
      <div
        className="overflow-hidden"
        style={{
          maxWidth: collapsed ? '0px' : '80px',
          opacity: collapsed ? 0 : 1,
          marginLeft: collapsed ? '0px' : '8px',
          transition: 'max-width 800ms ease-in-out, opacity 600ms ease-in-out 100ms, margin-left 800ms ease-in-out',
        }}
      >
        <span className="text-[11px] font-mono text-primary whitespace-nowrap">Loaded</span>
      </div>
    </div>
  );
}
