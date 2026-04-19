import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  event: any;
  isEagle: boolean;
  connId: string;
  onCrossingComplete: (crossings: number) => void;
  onEagleAction: (action: string) => void;
}

const LANE_COUNT = 5;
const LANE_HEIGHT = 80;
const PLAYER_SIZE = 40;
const OBSTACLE_WIDTH = 40;

export default function CrossyRoadClientLocal({ event, isEagle, connId, onCrossingComplete, onEagleAction }: Props) {
  const [laneIndex, setLaneIndex] = useState(0);
  const [xPosition, setXPosition] = useState(200);
  const [crossings, setCrossings] = useState(0);
  const [lanes, setLanes] = useState<any[]>([]);
  const animationRef = useRef<number>();
  const lastUpdateRef = useRef(Date.now());

  // Initialize lanes from host event
  useEffect(() => {
    if (event.crossyLanes) {
      setLanes(JSON.parse(JSON.stringify(event.crossyLanes)));
    }
  }, [event.crossyLanes]);

  // Apply eagle actions locally
  useEffect(() => {
    if (!isEagle) return;
    const handleEagleAction = (action: string) => {
      if (action === "speed-up") {
        setLanes(prev => prev.map(lane => ({ ...lane, speed: lane.speed * 1.2 })));
      } else if (action === "add-obstacle") {
        setLanes(prev => {
          const newLanes = [...prev];
          const randomLane = Math.floor(Math.random() * newLanes.length);
          newLanes[randomLane].obstacles.push({
            x: Math.random() * 400,
            width: OBSTACLE_WIDTH
          });
          return newLanes;
        });
      }
    };
    // Listen for host commands (via props or context)
  }, [isEagle]);

  // Animate obstacles
  useEffect(() => {
    if (!lanes.length) return;

    const animate = () => {
      const now = Date.now();
      const delta = Math.min(0.05, (now - lastUpdateRef.current) / 1000);
      lastUpdateRef.current = now;

      setLanes(prev => prev.map(lane => ({
        ...lane,
        obstacles: lane.obstacles.map(obs => ({
          ...obs,
          x: obs.x + (lane.direction === "left" ? -lane.speed * delta : lane.speed * delta)
        })).filter(obs => obs.x > -100 && obs.x < 500)
      })));

      // Collision detection (client-side)
      if (laneIndex > 0 && laneIndex <= LANE_COUNT) {
        const currentLane = lanes[laneIndex - 1];
        if (currentLane) {
          const playerLeft = xPosition - PLAYER_SIZE / 2;
          const playerRight = xPosition + PLAYER_SIZE / 2;
          const collision = currentLane.obstacles.some(obs => {
            const obsLeft = obs.x;
            const obsRight = obs.x + obs.width;
            return playerRight > obsLeft && playerLeft < obsRight;
          });
          if (collision) {
            // Reset to start
            setLaneIndex(0);
            setXPosition(200);
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [lanes, laneIndex, xPosition]);

  const moveUp = () => {
    if (laneIndex === 0) {
      setLaneIndex(1);
    } else if (laneIndex < LANE_COUNT) {
      setLaneIndex(laneIndex + 1);
      if (laneIndex + 1 > LANE_COUNT) {
        // Crossing complete
        const newCrossings = crossings + 1;
        setCrossings(newCrossings);
        setLaneIndex(0);
        setXPosition(200);
        onCrossingComplete(newCrossings);
      }
    }
  };

  const moveDown = () => {
    if (laneIndex > 0) {
      setLaneIndex(laneIndex - 1);
    }
  };

  const moveLeft = () => setXPosition(prev => Math.max(20, prev - 15));
  const moveRight = () => setXPosition(prev => Math.min(380, prev + 15));

  if (isEagle) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
        <p className="text-lg font-pixel text-destructive">🐦 EAGLE ACTIONS</p>
        <div className="flex gap-4">
          <Button onClick={() => onEagleAction("speed-up")} className="font-pixel">⚡ SPEED UP</Button>
          <Button onClick={() => onEagleAction("add-obstacle")} className="font-pixel">➕ ADD OBSTACLE</Button>
        </div>
        <p className="text-xs font-mono text-muted-foreground">Chicks: {crossings} crossings</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-900">
      {/* Lanes */}
      {lanes.map((lane, idx) => (
        <div
          key={idx}
          className="absolute w-full border-t border-white/20"
          style={{ top: (idx + 1) * LANE_HEIGHT, height: LANE_HEIGHT }}
        >
          {/* Obstacles */}
          {lane.obstacles.map((obs: any, i: number) => (
            <div
              key={i}
              className="absolute h-8 bg-red-500 rounded"
              style={{
                left: obs.x,
                width: obs.width,
                top: LANE_HEIGHT / 2 - 16
              }}
            />
          ))}
        </div>
      ))}

      {/* Player */}
      {laneIndex === 0 ? (
        <div className="absolute left-1/2 -translate-x-1/2 text-center text-white font-pixel" style={{ top: 20 }}>
          🐤 START ZONE
        </div>
      ) : (
        <div
          className="absolute bg-yellow-400 rounded-full transition-all"
          style={{
            width: PLAYER_SIZE,
            height: PLAYER_SIZE,
            left: xPosition - PLAYER_SIZE / 2,
            top: laneIndex * LANE_HEIGHT + LANE_HEIGHT / 2 - PLAYER_SIZE / 2,
          }}
        />
      )}

      {/* Controls */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 p-4">
        <Button onClick={moveLeft} className="w-16 h-16 text-2xl">←</Button>
        <Button onClick={moveUp} className="w-16 h-16 text-2xl">↑</Button>
        <Button onClick={moveDown} className="w-16 h-16 text-2xl">↓</Button>
        <Button onClick={moveRight} className="w-16 h-16 text-2xl">→</Button>
      </div>

      <div className="absolute top-4 right-4 text-white font-mono">
        Crossings: {crossings}
      </div>
    </div>
  );
}