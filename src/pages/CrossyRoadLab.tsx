import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CrossyRoadClient from "@/components/events/CrossyRoadClient";
import { Button } from "@/components/ui/button";
import type { CrossyLane, GameEvent } from "@/lib/gameTypes";

const FIELD_WIDTH = 100;
const DURATION_MS = 30_000;

function makeLanes(): CrossyLane[] {
  const lanes: CrossyLane[] = [];
  for (let i = 0; i < 5; i++) {
    const direction = i % 2 === 0 ? "left" : "right";
    const speed = 2 + Math.random() * 3;
    const obstacleCount = 2 + Math.floor(Math.random() * 3);
    const obstacles = Array.from({ length: obstacleCount }).map(() => ({
      x: Math.random() * FIELD_WIDTH,
      width: 5 + Math.random() * 7,
    }));
    lanes.push({ id: i + 1, direction, speed, obstacles });
  }
  return lanes;
}

function makeEvent(now: number): GameEvent {
  return {
    type: "crossy-road",
    phase: "active",
    startedAt: now,
    endAt: now + DURATION_MS,
    chickClicks: {},
    eagleClicks: {},
    result: "pending",
    crossyLanes: makeLanes(),
    crossyPlayerStates: {
      "lab-chick": {
        laneIndex: 0,
        xPosition: FIELD_WIDTH / 2,
        crossings: 0,
        hitCount: 0,
      },
    },
    eagleSpeedBoost: 1,
  };
}

export default function CrossyRoadLab() {
  const navigate = useNavigate();
  const [nowTs, setNowTs] = useState(Date.now());
  const [event, setEvent] = useState<GameEvent>(() => makeEvent(Date.now()));
  const [speedCdUntil, setSpeedCdUntil] = useState(0);
  const [obstacleCdUntil, setObstacleCdUntil] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  // Simulate lane movement + collisions to mirror real gameplay.
  useEffect(() => {
    const id = setInterval(() => {
      setEvent((prev) => {
        if (prev.phase !== "active" || !prev.crossyLanes || !prev.crossyPlayerStates) return prev;
        if (Date.now() >= prev.endAt) {
          return { ...prev, phase: "result" };
        }
        const boost = prev.eagleSpeedBoost ?? 1;
        const lanes = prev.crossyLanes.map((lane) => ({
          ...lane,
          obstacles: lane.obstacles.map((obs) => {
            const move = lane.speed * boost * 0.1 * (lane.direction === "left" ? -1 : 1);
            const x = ((obs.x + move) % FIELD_WIDTH + FIELD_WIDTH) % FIELD_WIDTH;
            return { ...obs, x };
          }),
        }));

        const cps = { ...prev.crossyPlayerStates };
        const chick = cps["lab-chick"];
        if (chick && chick.laneIndex >= 1 && chick.laneIndex <= 5) {
          const lane = lanes[chick.laneIndex - 1];
          for (const obs of lane.obstacles) {
            const pL = chick.xPosition - 1.5;
            const pR = chick.xPosition + 1.5;
            if (pR > obs.x && pL < obs.x + obs.width) {
              chick.laneIndex = 0;
              chick.xPosition = FIELD_WIDTH / 2;
              chick.hitCount += 1;
              break;
            }
          }
        }

        return { ...prev, crossyLanes: lanes, crossyPlayerStates: cps };
      });
    }, 100);
    return () => clearInterval(id);
  }, []);

  const onHop = (direction: "up" | "down") => {
    setEvent((prev) => {
      if (!prev.crossyPlayerStates) return prev;
      const cp = { ...prev.crossyPlayerStates };
      const chick = { ...cp["lab-chick"] };
      if (!chick) return prev;

      if (direction === "up") {
        chick.laneIndex = Math.min(chick.laneIndex + 1, 6);
        if (chick.laneIndex >= 6) {
          chick.crossings += 1;
          chick.laneIndex = 0;
          chick.xPosition = FIELD_WIDTH / 2;
        }
      } else {
        chick.laneIndex = Math.max(chick.laneIndex - 1, 0);
      }
      cp["lab-chick"] = chick;
      return { ...prev, crossyPlayerStates: cp };
    });
  };

  const onEagleAction = (action: "speed-up" | "add-obstacle") => {
    if (action === "speed-up" && nowTs < speedCdUntil) return;
    if (action === "add-obstacle" && nowTs < obstacleCdUntil) return;

    setEvent((prev) => {
      if (!prev.crossyLanes) return prev;
      if (action === "speed-up") {
        setSpeedCdUntil(Date.now() + 5000);
        return { ...prev, eagleSpeedBoost: Math.min((prev.eagleSpeedBoost ?? 1) + 0.2, 2.0) };
      }
      const lanes = [...prev.crossyLanes];
      const laneIdx = Math.floor(Math.random() * lanes.length);
      lanes[laneIdx] = {
        ...lanes[laneIdx],
        obstacles: [...lanes[laneIdx].obstacles, { x: Math.random() * FIELD_WIDTH, width: 5 + Math.random() * 5 }],
      };
      setObstacleCdUntil(Date.now() + 8000);
      return { ...prev, crossyLanes: lanes };
    });
  };

  const resetLab = () => {
    const now = Date.now();
    setSpeedCdUntil(0);
    setObstacleCdUntil(0);
    setNowTs(now);
    setEvent(makeEvent(now));
  };

  const chickStats = useMemo(() => {
    const s = event.crossyPlayerStates?.["lab-chick"];
    return {
      crossings: s?.crossings ?? 0,
      hits: s?.hitCount ?? 0,
      lane: s?.laneIndex ?? 0,
      boost: (event.eagleSpeedBoost ?? 1).toFixed(1),
    };
  }, [event]);

  return (
    <div className="min-h-screen bg-background p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>
          Back
        </Button>
        <h1 className="text-sm font-pixel text-accent">CROSSY ROAD LAB</h1>
        <Button size="sm" onClick={resetLab}>
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
        <div className="rounded border border-border p-2">Crossings: {chickStats.crossings}</div>
        <div className="rounded border border-border p-2">Hits: {chickStats.hits}</div>
        <div className="rounded border border-border p-2">Lane: {chickStats.lane}</div>
        <div className="rounded border border-border p-2">Eagle boost: {chickStats.boost}x</div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xs font-pixel text-primary">Chick Controls</h2>
        <div className="h-[44vh] rounded border border-border overflow-hidden">
          <CrossyRoadClient
            event={event}
            isEagle={false}
            connId="lab-chick"
            nowTs={nowTs}
            onHop={onHop}
            onEagleAction={onEagleAction}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xs font-pixel text-destructive">Eagle Controls</h2>
        <div className="h-[36vh] rounded border border-border overflow-hidden">
          <CrossyRoadClient
            event={event}
            isEagle={true}
            connId="lab-eagle"
            nowTs={nowTs}
            onHop={onHop}
            onEagleAction={onEagleAction}
          />
        </div>
      </div>
    </div>
  );
}
