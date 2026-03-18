import { useRef, useEffect, useState, useCallback } from 'react';
import QrScanner from 'qr-scanner';
import { Camera, CameraOff } from 'lucide-react';

interface Props {
  onScan: (data: string) => void;
  label?: string;
  aspectRatio?: string;
}

export default function ScannerBox({ onScan, label = 'SCANNER', aspectRatio = '873/457' }: Props) {
  const [active, setActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  const toggle = useCallback(() => setActive((a) => !a), []);

  useEffect(() => {
    if (!active || !videoRef.current) return;

    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        if (result.data) {
          onScan(result.data);
        }
      },
      {
        preferredCamera: 'environment',
        highlightScanRegion: true,
        highlightCodeOutline: true,
      }
    );
    scannerRef.current = scanner;
    scanner.start().catch(console.error);

    return () => {
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [active, onScan]);

  return (
    <button
      onClick={toggle}
      className={`relative w-full overflow-hidden rounded border transition-all ${
        active ? 'border-primary bg-black' : 'border-border bg-card hover:bg-muted'
      }`}
      style={{ aspectRatio }}
    >
      {active ? (
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-1">
          <Camera className="w-5 h-5 text-muted-foreground" />
          <span className="text-[10px] font-mono text-muted-foreground">{label}</span>
        </div>
      )}
      {active && (
        <div className="absolute top-1 right-1">
          <CameraOff className="w-4 h-4 text-foreground/70" />
        </div>
      )}
    </button>
  );
}
