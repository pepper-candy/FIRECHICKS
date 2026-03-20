import ChickStage1Controls from '@/components/controls/ChickStage1Controls';

export default function PreviewChickStage1() {
  return (
    <div className="h-dvh bg-background p-2">
      <ChickStage1Controls
        socialMet={1}
        onMove={(x, y) => console.log('move', x, y)}
        onIdleChange={(idle) => console.log('idle', idle)}
        onScan={(data) => console.log('scan', data)}
        onPropUse={(t) => console.log('prop', t)}
        props={[{ type: 'speed', count: 2 }, { type: 'heal', count: 1 }]}
        thumbstickColor="hsl(0 80% 55%)"
        stageInstruction="Walk to other chicks to meet them"
      />
    </div>
  );
}
