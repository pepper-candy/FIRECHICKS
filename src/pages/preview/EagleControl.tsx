import EagleControls from '@/components/controls/EagleControls';

export default function PreviewEagleControl() {
  return (
    <div className="h-dvh bg-background p-2">
      <EagleControls
        onMove={(x, y) => console.log('move', x, y)}
        onIdleChange={(idle) => console.log('idle', idle)}
        onAttack={() => console.log('attack')}
        onHitboxClick={() => console.log('hitbox')}
        onPropUse={(t) => console.log('prop', t)}
        props={[{ type: 'fly', count: 3 }]}
        attackCooldownUntil={0}
        attackDisabled={false}
        flyCooldownUntil={0}
        isInZone={false}
        thumbstickColor="hsl(0 0% 20%)"
      />
    </div>
  );
}
