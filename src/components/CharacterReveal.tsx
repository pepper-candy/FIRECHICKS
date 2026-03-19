import { Suspense, useState, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { PLAYER_COLORS } from '@/lib/playerColors';

interface Props {
  colorIndex: number;
  isEagle: boolean;
}

function RotatingStaticCharacter({ modelPath, angle }: { modelPath: string; angle: number }) {
  const gltf = useGLTF(modelPath);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  return (
    <primitive object={scene} scale={[0.85, 0.85, 0.85]} rotation={[0, angle, 0]} />
  );
}

// Positions camera so the character's base (feet) is at ~75% of screen height
function CharacterCamera() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 2.8, 4.2);
    // Look at the character's upper body (above feet), placing feet low in frame
    camera.lookAt(0, 0.9, 0);
    (camera as any).fov = 32;
    (camera as any).updateProjectionMatrix?.();
  }, [camera]);
  return null;
}

export default function CharacterReveal({ colorIndex, isEagle }: Props) {
  const color = PLAYER_COLORS[colorIndex];
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  if (!color) return null;

  const progress = Math.min(1, elapsed / 5);
  const remaining = Math.max(0, Math.ceil(5 - elapsed));
  const totalRotation = Math.PI * 2 * 1.25;
  const modelPath = `/FireChick/FireChick_Models/FireChick_${color.name}.glb`;
  const angle = -Math.min(totalRotation, (elapsed / 5) * totalRotation);

  return (
    <div className="flex flex-col items-center justify-start h-dvh overflow-hidden w-full">
      {/* 3D rotating character — takes top 70% of visible height */}
      <div className="w-full flex-1" style={{ maxWidth: 380, minHeight: 0 }}>
        <Canvas camera={{ position: [0, 2.8, 4.2], fov: 32 }}>
          <CharacterCamera />
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 6, 3]} intensity={1.2} />
          <directionalLight position={[-2, 4, -2]} intensity={0.4} />
          <Suspense fallback={null}>
            <RotatingStaticCharacter modelPath={modelPath} angle={angle} />
          </Suspense>
        </Canvas>
      </div>

      {/* Role + Color info — compact section below canvas */}
      <div className="flex flex-col items-center gap-1.5 px-4 pb-4 pt-1 w-full max-w-xs flex-shrink-0">
        {/* Role banner */}
        <div
          className="w-full px-4 py-2 rounded-lg flex items-center gap-3 justify-center"
          style={{
            backgroundColor: `hsl(${color.hsl} / 0.2)`,
            border: `2px solid hsl(${color.hsl} / 0.6)`,
            boxShadow: `0 0 20px hsl(${color.hsl} / 0.3)`,
          }}
        >
          <div
            className="w-5 h-5 rounded-full flex-shrink-0"
            style={{ backgroundColor: `hsl(${color.hsl})`, boxShadow: `0 0 10px hsl(${color.hsl} / 0.6)` }}
          />
          <p className="text-sm font-bold font-mono text-foreground">
            You are <span style={{ color: `hsl(${color.hsl})` }}>{color.name}</span>
          </p>
        </div>

        {/* Eagle / Chick badge */}
        <p className="text-xl font-pixel" style={{ color: `hsl(${color.hsl})` }}>
          {isEagle ? '🦅 EAGLE' : '🐤 CHICK'}
        </p>

        <p className="text-[11px] text-muted-foreground font-mono text-center">
          {isEagle ? 'Hunt down the chicks — catch them all!' : 'Survive, cooperate, and pass the exam!'}
        </p>

        {/* Countdown progress bar */}
        <div className="w-full mt-1">
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress * 100}%`,
                backgroundColor: `hsl(${color.hsl})`,
                transition: 'width 0.1s linear',
              }}
            />
          </div>
          <p className="text-center text-[10px] font-mono text-muted-foreground mt-1">
            {remaining > 0 ? `${remaining}s` : 'Get ready!'}
          </p>
        </div>
      </div>
    </div>
  );
}

useGLTF.preload('/FireChick/FireChick_Models/FireChick_Black.glb');
useGLTF.preload('/FireChick/FireChick_Models/FireChick_Gold.glb');
useGLTF.preload('/FireChick/FireChick_Models/FireChick_Red.glb');
useGLTF.preload('/FireChick/FireChick_Models/FireChick_Yellow.glb');
useGLTF.preload('/FireChick/FireChick_Models/FireChick_Blue.glb');
useGLTF.preload('/FireChick/FireChick_Models/FireChick_Green.glb');
useGLTF.preload('/FireChick/FireChick_Models/FireChick_Cyan.glb');
useGLTF.preload('/FireChick/FireChick_Models/FireChick_Pink.glb');
