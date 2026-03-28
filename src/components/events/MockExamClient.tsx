import { useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { assetUrl } from '@/lib/assets';

interface Props {
  questionNum: number;
  timeLeft: number;
  isEagle: boolean;
  hasSubmitted: boolean;
  answer: string;
  onAnswerChange: (v: string) => void;
  onSubmit: () => void;
  zoom?: number;
  opacity?: number;
  onZoomChange?: (v: number) => void;
  onOpacityChange?: (v: number) => void;
}

function MockExamCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(console.error);

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scale(0.6)', transformOrigin: 'center center' }} />;
}

export default function MockExamClient({
  questionNum,
  timeLeft,
  isEagle,
  hasSubmitted,
  answer,
  onAnswerChange,
  onSubmit,
  zoom = 0.6,
  opacity = 0.85,
  onZoomChange,
  onOpacityChange,
}: Props) {
  if (isEagle) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
        <p className="text-sm font-mono text-muted-foreground text-center">
          🦅 Watch the host screen — layer 1 is displayed there!
        </p>
      </div>
    );
  }

  if (hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
        <p className="text-lg font-pixel text-primary">✓ Submitted</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-pixel text-accent">MOCK EXAM</h2>
        <span className="font-mono text-sm text-accent">{timeLeft}s</span>
      </div>

      <div className="relative w-full overflow-hidden rounded border border-border bg-black" style={{ aspectRatio: '873/457' }}>
        <MockExamCamera />
        <img
          src={assetUrl(`/PW/PW_Mock_${questionNum}_layer-2.png`)}
          alt="Mock exam layer 2"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ opacity, mixBlendMode: 'multiply', transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        />
      </div>

      {/* Zoom & Opacity sliders — 2 separate lines */}
      {(onZoomChange || onOpacityChange) && (
        <div className="flex flex-col gap-2">
          {onZoomChange && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground w-12 shrink-0">🔍 Zoom</span>
              <Slider
                value={[zoom]}
                min={0.3}
                max={0.9}
                step={0.05}
                onValueChange={([v]) => onZoomChange(v)}
                className="flex-1"
              />
              <span className="text-[10px] text-muted-foreground w-10 text-right">{zoom.toFixed(2)}×</span>
            </div>
          )}
          {onOpacityChange && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground w-12 shrink-0">👁 Layer</span>
              <Slider
                value={[opacity]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([v]) => onOpacityChange(v)}
                className="flex-1"
              />
              <span className="text-[10px] text-muted-foreground w-10 text-right">{Math.round(opacity * 100)}%</span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        <Input
          placeholder="Answer..."
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value.toUpperCase())}
          className="flex-1 uppercase font-mono"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && answer.trim()) onSubmit();
          }}
        />
        <Button onClick={onSubmit} disabled={!answer.trim()} className="font-pixel text-xs">
          SUBMIT
        </Button>
      </div>
    </div>
  );
}
