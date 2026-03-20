import ChickStage23Controls from '@/components/controls/ChickStage23Controls';

export default function PreviewChickStage23() {
  return (
    <div className="h-dvh bg-background p-2">
      <ChickStage23Controls
        tips={[true, false]}
        loadingTip={[false, false]}
        tipShareCooldownUntil={0}
        tipExpiryCooldown={[0, 0]}
        tipCopyStartedAt={[0, 0]}
        clockNow={Date.now()}
        activeScannerQr={null}
        scannerQrExpireAt={0}
        onMove={(x, y) => console.log('move', x, y)}
        onIdleChange={(idle) => console.log('idle', idle)}
        onScan={(data) => console.log('scan', data)}
        onPropUse={(t) => console.log('prop', t)}
        onTipTap={(idx) => console.log('tip tap', idx)}
        onDismissQr={() => console.log('dismiss qr')}
        props={[{ type: 'speed', count: 2 }, { type: 'invincible', count: 1 }]}
        thumbstickColor="hsl(220 80% 55%)"
        stageInstruction="Tap tips to share QR, scan others' tips"
      />
    </div>
  );
}
