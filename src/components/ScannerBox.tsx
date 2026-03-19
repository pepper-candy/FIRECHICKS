import { useRef, useEffect, useState, useCallback } from 'react';
import QrScanner from 'qr-scanner';
import QRCode from 'react-qr-code';

interface Props {
  onScan: (data: string) => void;
  label?: string;
  aspectRatio?: string;
  /** When set, shows a QR code in the scanner area instead of the camera */
  displayQr?: string | null;
  /** Countdown seconds for QR expiry */
  displayQrCountdown?: number;
  /** Called when user taps the QR display to dismiss */
  onDismissQr?: () => void;
}

export default function ScannerBox({
  onScan,
  label = 'TAP TO SCAN',
  aspectRatio = '2/1',
  displayQr,
  displayQrCountdown,
  onDismissQr,
}: Props) {
  const [active, setActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const animRef = useRef<number>(0);
  const lineRef = useRef<HTMLDivElement>(null);
  const lineDir = useRef(1);
  const linePos = useRef(20);

  const toggle = useCallback(() => {
    if (displayQr) {
      // Dismiss QR and go back to inactive
      onDismissQr?.();
      return;
    }
    setActive((a) => !a);
  }, [displayQr, onDismissQr]);

  // If displayQr appears, turn off camera
  useEffect(() => {
    if (displayQr && active) {
      setActive(false);
    }
  }, [displayQr]);

  // Laser line animation
  useEffect(() => {
    if (!active) return;
    const animate = () => {
      linePos.current += lineDir.current * 1.2;
      if (linePos.current > 78) lineDir.current = -1;
      if (linePos.current < 8) lineDir.current = 1;
      if (lineRef.current) lineRef.current.style.top = `${linePos.current}%`;
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [active]);

  useEffect(() => {
    if (!active || !videoRef.current) return;

    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        if (result.data) onScan(result.data);
      },
      {
        preferredCamera: 'environment',
        highlightScanRegion: false,
        highlightCodeOutline: false,
        returnDetailedScanResult: true,
      },
    );
    scannerRef.current = scanner;
    scanner.start().catch(console.error);

    return () => {
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [active, onScan]);

  // ── Display QR code mode ──
  if (displayQr) {
    return (
      <button
        onClick={toggle}
        className="relative w-full overflow-hidden rounded border-2 border-accent bg-card/90 transition-all select-none"
        style={{ aspectRatio }}
      >
        <div className="flex flex-col items-center justify-center h-full gap-1 p-2">
          <div className="bg-white p-2 rounded">
            <QRCode value={displayQr} size={120} />
          </div>
          <span className="text-[10px] font-mono text-accent">
            {displayQrCountdown !== undefined && displayQrCountdown > 0
              ? `Expires in ${displayQrCountdown}s`
              : 'Tap to dismiss'}
          </span>
          <span className="text-[8px] font-mono text-muted-foreground">Others scan this!</span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className={`relative w-full overflow-hidden rounded border-2 transition-all select-none ${
        active ? 'border-primary bg-black' : 'border-border/60 bg-card/60 hover:bg-muted'
      }`}
      style={{ aspectRatio }}
    >
      {active ? (
        <>
          {/* Camera feed */}
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />

          {/* Corner brackets */}
          {[
            'top-1 left-1 border-t-2 border-l-2',
            'top-1 right-1 border-t-2 border-r-2',
            'bottom-1 left-1 border-b-2 border-l-2',
            'bottom-1 right-1 border-b-2 border-r-2',
          ].map((c, i) => (
            <div key={i} className={`absolute w-4 h-4 border-primary ${c}`} />
          ))}

          {/* Laser scan line */}
          <div
            ref={lineRef}
            className="absolute left-2 right-2 h-px pointer-events-none"
            style={{
              top: '50%',
              background: 'linear-gradient(90deg, transparent, hsl(var(--primary)) 20%, hsl(var(--primary)) 80%, transparent)',
              boxShadow: '0 0 6px hsl(var(--primary) / 0.8)',
            }}
          />

          {/* Tap to close hint */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-foreground/50">
            ▪ SCANNING ▪
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-1.5 px-4">
          {/* Barcode lines decoration */}
          <div className="flex items-end gap-px h-6 mb-1">
            {[3,5,2,7,4,6,2,5,3,6,4,3,7,2,5,4,6,3,5,2].map((h, i) => (
              <div
                key={i}
                className="bg-muted-foreground/50 rounded-sm"
                style={{ width: i % 3 === 0 ? 2 : 1, height: `${h * 10}%` }}
              />
            ))}
          </div>
          <span className="text-[10px] font-mono text-muted-foreground tracking-widest">{label}</span>
        </div>
      )}
    </button>
  );
}
