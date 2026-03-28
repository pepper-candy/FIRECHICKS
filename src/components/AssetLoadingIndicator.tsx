import { useState, useEffect, useCallback } from 'react';
import { Check } from 'lucide-react';
import { useAssetLoading } from '@/context/AssetLoadingContext';

export default function AssetLoadingIndicator() {
  const { entryProgress, entryReady } = useAssetLoading();
  const [collapsed, setCollapsed] = useState(false);
  const [showText, setShowText] = useState(true);

  // Auto-collapse 5s after loaded
  useEffect(() => {
    if (!entryReady) {
      setCollapsed(false);
      setShowText(true);
      return;
    }
    const t = setTimeout(() => setCollapsed(true), 5000);
    return () => clearTimeout(t);
  }, [entryReady]);

  // Hide text after collapse transition ends
  useEffect(() => {
    if (collapsed) {
      const t = setTimeout(() => setShowText(false), 400);
      return () => clearTimeout(t);
    } else {
      setShowText(true);
    }
  }, [collapsed]);

  const handleClick = useCallback(() => {
    if (!entryReady || !collapsed) return;
    setCollapsed(false);
    const t = setTimeout(() => setCollapsed(true), 10000);
    return () => clearTimeout(t);
  }, [entryReady, collapsed]);

  // While loading, show spinner + progress
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
      className="fixed bottom-3 left-3 z-40 flex items-center py-1.5 rounded-lg bg-card/90 border border-border backdrop-blur-sm shadow-lg overflow-hidden transition-all duration-400 ease-in-out"
      style={{
        cursor: collapsed ? 'pointer' : 'default',
        width: collapsed ? '36px' : undefined,
        paddingLeft: collapsed ? '9px' : '12px',
        paddingRight: collapsed ? '9px' : '12px',
      }}
    >
      <Check className="w-4 h-4 text-primary flex-shrink-0" />
      <div
        className="overflow-hidden transition-all duration-400 ease-in-out"
        style={{
          maxWidth: collapsed ? '0px' : '80px',
          opacity: collapsed ? 0 : 1,
          marginLeft: collapsed ? '0px' : '8px',
        }}
      >
        {showText && (
          <span className="text-[11px] font-mono text-primary whitespace-nowrap">Loaded</span>
        )}
      </div>
    </div>
  );
}
