import { useRef, useCallback, useEffect, useState } from 'react';

interface Props {
  onMove: (x: number, y: number) => void;
  onIdleChange?: (idle: boolean) => void;
  size?: number;
  color?: string;
}

const THROTTLE_MS = 33; // ~30Hz for network
const DEAD_ZONE = 0.01; // ignore jitter below this threshold

export default function Thumbstick({ onMove, onIdleChange, size = 200, color }: Props) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const activeRef = useRef(false);
  const stickIdRef = useRef<number | null>(null);
  const lastSentRef = useRef({ x: 0, y: 0 });
  const lastSendTimeRef = useRef(0);

  const maxDist = size / 2 - 30;
  const knobColor = color ?? 'hsl(var(--primary))';

  const throttledOnMove = useCallback(
    (normX: number, normY: number) => {
      const now = performance.now();
      const dx = Math.abs(normX - lastSentRef.current.x);
      const dy = Math.abs(normY - lastSentRef.current.y);

      if (dx < DEAD_ZONE && dy < DEAD_ZONE && now - lastSendTimeRef.current < THROTTLE_MS) return;
      if (now - lastSendTimeRef.current < THROTTLE_MS) return;

      lastSentRef.current = { x: normX, y: normY };
      lastSendTimeRef.current = now;
      onMove(normX, normY);
    },
    [onMove]
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      const base = baseRef.current;
      if (!base) return;
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
      }

      const normX = dx / maxDist;
      const normY = dy / maxDist;

      setStick({ x: dx, y: dy });
      throttledOnMove(normX, normY);
    },
    [maxDist, throttledOnMove]
  );

  const handleEnd = useCallback(() => {
    activeRef.current = false;
    stickIdRef.current = null;
    setStick({ x: 0, y: 0 });
    lastSentRef.current = { x: 0, y: 0 };
    lastSendTimeRef.current = 0;
    onMove(0, 0);
    // Go idle when finger lifts
    onIdleChange?.(true);
  }, [onMove, onIdleChange]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      onIdleChange?.(false); // Wake up
      const touch = e.changedTouches[0];
      activeRef.current = true;
      stickIdRef.current = touch.identifier;
      handleMove(touch.clientX, touch.clientY);
    },
    [handleMove, onIdleChange]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      onIdleChange?.(false); // Wake up
      activeRef.current = true;
      handleMove(e.clientX, e.clientY);
    },
    [handleMove, onIdleChange]
  );

  useEffect(() => {
    const onTouchMoveGlobal = (e: TouchEvent) => {
      if (!activeRef.current || stickIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === stickIdRef.current) {
          handleMove(t.clientX, t.clientY);
          break;
        }
      }
    };
    const onTouchEndGlobal = (e: TouchEvent) => {
      if (stickIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === stickIdRef.current) {
          handleEnd();
          break;
        }
      }
    };
    const onMouseMoveGlobal = (e: MouseEvent) => {
      if (activeRef.current) handleMove(e.clientX, e.clientY);
    };
    const onMouseUpGlobal = () => {
      if (activeRef.current) handleEnd();
    };

    window.addEventListener('touchmove', onTouchMoveGlobal, { passive: false });
    window.addEventListener('touchend', onTouchEndGlobal);
    window.addEventListener('mousemove', onMouseMoveGlobal);
    window.addEventListener('mouseup', onMouseUpGlobal);

    return () => {
      window.removeEventListener('touchmove', onTouchMoveGlobal);
      window.removeEventListener('touchend', onTouchEndGlobal);
      window.removeEventListener('mousemove', onMouseMoveGlobal);
      window.removeEventListener('mouseup', onMouseUpGlobal);
    };
  }, [handleMove, handleEnd]);

  return (
    <div
      ref={baseRef}
      className="relative rounded-full border-2 bg-muted/50 select-none touch-none"
      style={{
        width: size,
        height: size,
        borderColor: color ? `${color.replace(')', ' / 0.4)')}` : 'hsl(var(--primary) / 0.4)',
      }}
      onTouchStart={onTouchStart}
      onMouseDown={onMouseDown}
    >
      {/* Center cross */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-px h-8 bg-primary/20" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="h-px w-8 bg-primary/20" />
      </div>
      {/* Stick knob */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 56,
          height: 56,
          left: `calc(50% - 28px + ${stick.x}px)`,
          top: `calc(50% - 28px + ${stick.y}px)`,
          transition: stick.x === 0 && stick.y === 0 ? 'all 0.15s ease-out' : 'none',
          backgroundColor: knobColor,
          boxShadow: `0 0 20px ${color ? color.replace(')', ' / 0.4)') : 'hsl(var(--glow-primary) / 0.4)'}, 0 0 60px ${color ? color.replace(')', ' / 0.15)') : 'hsl(var(--glow-primary) / 0.15)'}`,
        }}
      />
    </div>
  );
}
