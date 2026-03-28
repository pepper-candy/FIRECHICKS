import { useRef, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { assetUrl } from '@/lib/assets';

interface Props {
  examLayer: '1' | '2';
  questionNum: number;
  timeRemaining: number;
  answer: string;
  onAnswerChange: (v: string) => void;
  onSubmit: () => void;
}

export default function FinalExamClient({
  examLayer,
  questionNum,
  timeRemaining,
  answer,
  onAnswerChange,
  onSubmit,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [zoom, setZoom] = useState(0.6);
  const [opacity, setOpacity] = useState(0.85);
  const [cameraZoom] = useState(0.6);

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

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <span className="text-xs font-pixel text-muted-foreground">
          Layer {examLayer} {examLayer === '1' ? '(You have layer 1!)' : '(layer 2)'}
        </span>
        <span
          className={`text-sm font-bold font-mono ${timeRemaining < 10 ? 'text-destructive animate-pulse' : 'text-accent'}`}
        >
          ⏱ {Math.ceil(timeRemaining)}s
        </span>
      </div>

      <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: '873/457' }}>
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        <img
          src={assetUrl(`/PW/PW_Final_${questionNum}_layer-${examLayer}.png`)}
          alt={`Layer ${examLayer}`}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ opacity, transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        />
      </div>

      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground w-14 shrink-0">Zoom</span>
          <Slider value={[zoom]} onValueChange={([v]) => setZoom(v)} min={0.3} max={0.9} step={0.05} className="flex-1" />
          <span className="text-xs text-muted-foreground w-10 text-right">{zoom.toFixed(2)}×</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground w-14 shrink-0">Opacity</span>
          <Slider value={[opacity]} onValueChange={([v]) => setOpacity(v)} min={0} max={1} step={0.05} className="flex-1" />
          <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(opacity * 100)}%</span>
        </div>
      </div>

      <div className="flex gap-2 px-3 pb-4">
        <Input
          placeholder="Type your answer..."
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value.toUpperCase())}
          className="flex-1 uppercase font-mono"
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        />
        <Button onClick={onSubmit} className="font-pixel text-xs bg-primary">
          SUBMIT
        </Button>
      </div>
    </div>
  );
}
