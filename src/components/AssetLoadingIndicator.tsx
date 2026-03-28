import { useEffect, useState, useRef, useCallback } from "react";
import { Check, Loader2 } from "lucide-react";
import { useAssetLoading } from "@/context/AssetLoadingContext";

export default function AssetLoadingIndicator() {
  const { entryProgress, entryReady } = useAssetLoading();
  const [collapsed, setCollapsed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyFiredRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Auto-collapse 5s after first becoming ready
  useEffect(() => {
    if (entryReady && !readyFiredRef.current) {
      readyFiredRef.current = true;
      clearTimer();
      timerRef.current = setTimeout(() => setCollapsed(true), 5000);
    }
    return clearTimer;
  }, [entryReady, clearTimer]);

  // Click to expand → auto-collapse after 10s
  const handleClick = () => {
    if (!entryReady) return;
    if (!collapsed) return;
    clearTimer();
    setCollapsed(false);
    timerRef.current = setTimeout(() => setCollapsed(true), 10000);
  };

  return (
    <div
      onClick={handleClick}
      className="fixed bottom-3 left-3 z-40 flex items-center gap-0 py-[0.3rem] rounded-lg bg-card/90 border border-border backdrop-blur-sm shadow-lg overflow-hidden"
      style={{
        cursor: entryReady && collapsed ? "pointer" : "default",
        /* keep px consistent — padding-left always present for the icon */
        paddingLeft: "0.75rem",
        /* right padding transitions to match icon-only state */
        paddingRight: collapsed ? "0.75rem" : "0.75rem",
        transition: "padding 800ms ease-in-out",
      }}
    >
      {entryReady ? (
        <>
          <Check className="w-4 h-4 text-primary flex-shrink-0" />
          <span
            className="text-[11px] font-mono text-primary whitespace-nowrap"
            style={{
              display: "inline-block",
              maxWidth: collapsed ? "0px" : "80px",
              opacity: collapsed ? 0 : 1,
              marginLeft: collapsed ? "0px" : "8px",
              overflow: "hidden",
              transition:
                "max-width 800ms ease-in-out, opacity 600ms ease-in-out, margin-left 800ms ease-in-out",
            }}
          >
            Loaded
          </span>
        </>
      ) : (
        <>
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin flex-shrink-0" />
          <span
            className="text-[11px] font-mono text-muted-foreground whitespace-nowrap"
            style={{ marginLeft: "8px" }}
          >
            {entryProgress}%
          </span>
        </>
      )}
    </div>
  );
}
