import { useState, useEffect } from "react";
import { ChevronUp, ChevronDown, Activity } from "lucide-react";
import { PLAYER_COLORS } from "@/lib/playerColors";
import type { PlayerState } from "@/hooks/useGameRoom";
import { ScrollArea } from "@/components/ui/scroll-area";

const IDLE_THRESHOLD_MS = 10000; // consider idle if no pong for 10s

interface Props {
  players: Map<string, PlayerState>;
  onOpenChange?: (open: boolean) => void;
}

export default function NetworkPerformancePanel({ players, onOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Tick every 2s to detect stale pings
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(id);
  }, [open]);

  return (
    <div className="fixed bottom-4 right-4 z-50 font-mono">
      {/* Expanded panel */}
      <div
        className={`bg-card border border-border rounded-lg overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-[20vh] opacity-100 mb-2" : "max-h-0 opacity-0 mb-0"
        }`}
      >
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <Activity className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground tracking-wider">NETWORK</span>
        </div>
        <ScrollArea className="max-h-[calc(20vh-2rem)]">
          <div className="px-3 py-1">
            {players.size === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No players connected</p>
            ) : (
              Array.from(players.entries()).map(([connId, p]) => {
                const color = PLAYER_COLORS[p.colorIndex] ?? PLAYER_COLORS[0];
                const isIdle = now - p.lastPongAt > IDLE_THRESHOLD_MS;
                const pingHigh = p.ping > 120;
                return (
                  <div key={connId} className="flex items-center justify-between py-1.5 gap-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{
                          backgroundColor: isIdle ? 'hsl(var(--muted-foreground))' : `hsl(${color.hsl})`,
                          boxShadow: isIdle ? 'none' : `0 0 6px hsl(${color.hsl} / 0.4)`,
                        }}
                      />
                      <span className={`text-sm ${isIdle ? "text-muted-foreground" : "text-foreground"}`}>{color.name}</span>
                    </div>
                    <span className={`text-sm font-bold ${isIdle ? "text-muted-foreground" : pingHigh ? "text-destructive" : "text-primary"}`}>
                      {isIdle ? "idle" : `${p.ping}ms`}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Toggle button */}
      <button
        onClick={() =>
          setOpen((o) => {
            const next = !o;
            onOpenChange?.(next);
            return next;
          })
        }
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-card text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Activity className="w-3 h-3" />
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
