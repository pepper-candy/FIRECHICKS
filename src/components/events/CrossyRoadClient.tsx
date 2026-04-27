import { useState } from "react";
import type { GameEvent, CrossyPlayerState } from "@/lib/gameTypes";
import { ChevronUp, ChevronDown, Zap, Plus } from "lucide-react";

interface Props {
  event: GameEvent;
  isEagle: boolean;
  connId: string;
  nowTs: number;
  onHop: (direction: "up" | "down") => void;
  onEagleAction: (action: "speed-up" | "add-obstacle") => void;
}

const FIELD_WIDTH = 100;

export default function CrossyRoadClient({ event, isEagle, connId, nowTs, onHop, onEagleAction }: Props) {
  const [speedCd, setSpeedCd] = useState(0);
  const [obstacleCd, setObstacleCd] = useState(0);
  const now = nowTs;
  const safeEndAt =
    typeof event.endAt === "number" && Number.isFinite(event.endAt) && event.endAt > 0
      ? event.endAt
      : event.startedAt + 30000;
  const timeLeft = Math.max(0, Math.ceil((safeEndAt - nowTs) / 1000));
  const myState: CrossyPlayerState | undefined = event.crossyPlayerStates?.[connId];
  const lanes = event.crossyLanes ?? [];
  const speedBoost = event.eagleSpeedBoost ?? 1;
  const handleHop = (dir: "up" | "down") => {
    console.log("[CrossyRoad] hop:", dir);
    onHop(dir);
  };

  // Eagle controls
  if (isEagle) {
    const speedReady = now >= speedCd;
    const obstacleReady = now >= obstacleCd;

    return (
      <div className="flex flex-col items-center justify-between h-full p-4 pt-12">
        <div className="text-center">
          <h2 className="text-lg font-pixel text-accent">🐔 CROSSY ROAD</h2>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Speed: <span className="text-accent font-bold">{speedBoost.toFixed(1)}×</span>
          </p>
        </div>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={() => {
              if (speedReady) {
                onEagleAction("speed-up");
                setSpeedCd(Date.now() + 5000);
              }
            }}
            disabled={!speedReady}
            className="w-full py-4 rounded-xl border-2 border-accent bg-accent/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Zap className="w-6 h-6 text-accent" />
            <span className="font-pixel text-accent">
              {speedReady ? "SPEED UP" : `⏳ ${Math.ceil((speedCd - now) / 1000)}s`}
            </span>
          </button>

          <button
            onClick={() => {
              if (obstacleReady) {
                onEagleAction("add-obstacle");
                setObstacleCd(Date.now() + 8000);
              }
            }}
            disabled={!obstacleReady}
            className="w-full py-4 rounded-xl border-2 border-destructive bg-destructive/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Plus className="w-6 h-6 text-destructive" />
            <span className="font-pixel text-destructive">
              {obstacleReady ? "ADD OBSTACLE" : `⏳ ${Math.ceil((obstacleCd - now) / 1000)}s`}
            </span>
          </button>
        </div>

        <p className="text-xs font-mono text-muted-foreground">🦅 Eagle — make it harder for chicks!</p>
      </div>
    );
  }

  // Chick controls
  const currentLane = myState?.laneIndex ?? 0;
  const crossings = myState?.crossings ?? 0;

  // Show the current lane and adjacent lanes
  const visibleLaneIndices = [currentLane - 1, currentLane, currentLane + 1].filter((i) => i >= 1 && i <= 5);

  return (
    <div className="flex flex-col items-center justify-between h-full p-4 pt-12">
      <div className="text-center">
        <h2 className="text-lg font-pixel text-accent">🐔 CROSSY ROAD</h2>
        <p className="text-sm font-mono text-muted-foreground">
          Crossings: <span className="text-accent font-bold">{crossings}</span>
        </p>
      </div>

      {/* Lane view */}
      <div className="w-full max-w-sm rounded-lg border-2 border-accent/30 overflow-hidden bg-card">
        {currentLane >= 5 && (
          <div className="h-10 bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-pixel text-primary">🏁 SAFE — tap ⬆ to cross!</span>
          </div>
        )}

        {[...visibleLaneIndices].reverse().map((laneIdx) => {
          const lane = lanes[laneIdx - 1]; // lanes array is 0-indexed, lane IDs are 1-5
          if (!lane) return null;
          const isCurrentLane = laneIdx === currentLane;
          return (
            <div
              key={laneIdx}
              className="relative h-14 border-b border-border/30"
              style={{
                background: isCurrentLane ? "hsl(var(--accent) / 0.1)" : "hsl(var(--muted))",
                borderLeft: isCurrentLane ? "3px solid hsl(var(--accent))" : "none",
              }}
            >
              <span className="absolute left-1 top-0.5 text-[8px] text-muted-foreground opacity-50">
                L{laneIdx} {lane.direction === "left" ? "←" : "→"}
              </span>

              {/* Obstacles */}
              {lane.obstacles.map((obs, oi) => {
                const leftPct = ((((obs.x % FIELD_WIDTH) + FIELD_WIDTH) % FIELD_WIDTH) / FIELD_WIDTH) * 100;
                const widthPct = (obs.width / FIELD_WIDTH) * 100;
                return (
                  <div
                    key={oi}
                    className="absolute top-2 bottom-2 rounded bg-destructive/70"
                    style={{
                      left: `${leftPct}%`,
                      width: `${Math.max(widthPct, 4)}%`,
                      transition: "left 0.1s linear",
                    }}
                  >
                    <span className="text-xs flex items-center justify-center h-full">🔥</span>
                  </div>
                );
              })}

              {/* Player indicator */}
              {isCurrentLane && myState && (
                <div
                  className="absolute top-1 w-7 h-7 rounded-full bg-primary border-2 border-white flex items-center justify-center text-sm z-10"
                  style={{
                    left: `${((((myState.xPosition % FIELD_WIDTH) + FIELD_WIDTH) % FIELD_WIDTH) / FIELD_WIDTH) * 100}%`,
                    transform: "translateX(-50%)",
                    transition: "left 0.1s linear",
                  }}
                >
                  🐤
                </div>
              )}
            </div>
          );
        })}

        {currentLane <= 0 && (
          <div className="relative h-10 bg-secondary/30 flex items-center justify-center">
            <span className="text-xs font-pixel text-muted-foreground">🏠 START — tap ⬆ to go!</span>
            {myState && (
              <div
                className="absolute top-1 w-7 h-7 rounded-full bg-primary border-2 border-white flex items-center justify-center text-sm z-10"
                style={{
                  left: `${((((myState.xPosition % FIELD_WIDTH) + FIELD_WIDTH) % FIELD_WIDTH) / FIELD_WIDTH) * 100}%`,
                  transform: "translateX(-50%)",
                }}
              >
                🐤
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hop controls */}
      <div className="flex gap-6 items-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleHop("down");
          }}
          className="w-16 h-16 rounded-full border-2 border-accent bg-accent/20 active:scale-90 transition-all flex items-center justify-center select-none"
          style={{ touchAction: "manipulation" }}
        >
          <ChevronDown className="w-8 h-8 text-accent" />
        </button>

        <div className="text-center">
          <span className="text-xs font-mono text-muted-foreground">Lane {currentLane}/5</span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleHop("up");
          }}
          className="w-20 h-20 rounded-full border-2 border-primary bg-primary/20 active:scale-90 transition-all flex items-center justify-center select-none"
          style={{ touchAction: "manipulation" }}
        >
          <ChevronUp className="w-10 h-10 text-primary" />
        </button>
      </div>

      <div className="text-[10px] font-mono text-muted-foreground text-center space-y-0.5 px-2">
        <p>🐤 Tap ⬆ to hop up through 5 lanes, ⬇ to go back</p>
        <p>🔥 Dodge red obstacles — hits reset you to lane start</p>
        <p>
          🏁 2 crossings = <span className="text-accent font-bold">+1 grade</span> · 3+ = <span className="text-accent font-bold">+2 grades!</span>
        </p>
      </div>
    </div>
  );
}
