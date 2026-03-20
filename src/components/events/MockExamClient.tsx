import { useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { assetUrl } from '@/lib/assets';

interface Props {
  questionNum: number;
  timeLeft: number;
  isEagle: boolean;
  hasSubmitted: boolean;
  answer: string;
  onAnswerChange: (v: string) => void;
  onSubmit: () => void;
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

  return <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />;
}

export default function MockExamClient({
  questionNum,
  timeLeft,
  isEagle,
  hasSubmitted,
  answer,
  onAnswerChange,
  onSubmit,
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
    <div className="flex flex-col h-full p-4 gap-4">
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
          style={{ opacity: 0.85, mixBlendMode: 'multiply' }}
        />
      </div>

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
