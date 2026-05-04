import { Suspense, useState, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { PLAYER_COLORS } from "@/lib/playerColors";
import { assetUrl } from "@/lib/assets";

interface Props {
  colorIndex: number;
  isEagle: boolean;
}

function RotatingStaticCharacter({ modelPath, angle }: { modelPath: string; angle: number }) {
  const gltf = useGLTF(modelPath);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  return <primitive object={scene} scale={[0.02, 0.02, 0.02]} rotation={[0, angle, 0]} />;
}

function CharacterCamera() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 2.2, 3.8);
    camera.lookAt(0, 0.3, 0);
    (camera as any).fov = 32;
    (camera as any).updateProjectionMatrix?.();
  }, [camera]);
  return null;
}

export default function CharacterReveal({ colorIndex, isEagle }: Props) {
  const color = PLAYER_COLORS[colorIndex];
  const [angle, setAngle] = useState(0);
  const [progress, setProgress] = useState(0);
  const [remaining, setRemaining] = useState(7);
  const [contextLost, setContextLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const startRef = useRef(performance.now());
  const rafRef = useRef(0);
  const isMobile = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    startRef.current = performance.now();
    const totalRotation = Math.PI * 2 * 1.25;
    const startOffset = 1.22; // radians (70°)
    const duration = 7000; // 7 seconds

    const tick = (time: number) => {
      const elapsed = time - startRef.current;
      const t = Math.min(1, elapsed / duration);
      // Smooth easing: ease-in-out
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setAngle(startOffset - eased * totalRotation);
      setProgress(t);
      setRemaining(Math.max(0, Math.ceil((duration - elapsed) / 1000)));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  if (!color) return null;

  const modelPath = assetUrl(`/FireChick/FireChick_Models/FireChick_${color.name}_NEW.glb`);

  return (
    <div className="flex flex-col items-center justify-start h-dvh overflow-hidden w-full">
      {/* Canvas takes 2/3 of screen height */}
      <div className="w-full" style={{ maxWidth: 380, minHeight: 0, height: "66.67vh" }}>
        {contextLost ? (
          <div className="w-full h-full flex items-center justify-center px-4">
            <button
              onClick={() => {
                setContextLost(false);
                setCanvasKey((v) => v + 1);
              }}
              className="px-4 py-2 rounded-md border border-primary/50 text-primary font-mono text-xs hover:bg-primary/10"
            >
              3D viewer paused. Tap to reload.
            </button>
          </div>
        ) : (
          <Canvas
            key={canvasKey}
            camera={{ position: [0, 2.2, 3.8], fov: 32 }}
            dpr={isMobile ? [1, 1.5] : [1, 2]}
            gl={{ antialias: !isMobile, powerPreference: "default", preserveDrawingBuffer: false }}
            onCreated={({ gl }) => {
              const onContextLost = (ev: Event) => {
                ev.preventDefault();
                setContextLost(true);
              };
              gl.domElement.addEventListener("webglcontextlost", onContextLost, false);
            }}
          >
            <CharacterCamera />
            <ambientLight intensity={0.8} />
            <directionalLight position={[3, 6, 3]} intensity={1.2} />
            <directionalLight position={[-2, 4, -2]} intensity={0.4} />
            <Suspense fallback={null}>
              <RotatingStaticCharacter modelPath={modelPath} angle={angle} />
            </Suspense>
          </Canvas>
        )}
      </div>

      {/* Info panel takes 1/3 */}
      <div className="flex flex-col items-center gap-1.5 px-4 pb-4 pt-1 w-full max-w-xs flex-shrink-0">
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

        <p className="text-xl font-pixel" style={{ color: `hsl(${color.hsl})` }}>
          {isEagle ? "🦅 EAGLE" : "🐤 CHICK"}
        </p>

        <p className="text-[11px] text-muted-foreground font-mono text-center">
          {isEagle ? "Hunt down the chicks — catch them all!" : "Survive, cooperate, and pass the exam!"}
        </p>

        <div className="w-full mt-1">
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-none"
              style={{
                width: `${progress * 100}%`,
                backgroundColor: `hsl(${color.hsl})`,
              }}
            />
          </div>
          <p className="text-center text-[10px] font-mono text-muted-foreground mt-1">
            {remaining > 0 ? `${remaining}s` : "Get ready!"}
          </p>
        </div>
      </div>
    </div>
  );
}

useGLTF.preload(assetUrl("/FireChick/FireChick_Models/FireChick_Black_NEW.glb"));
useGLTF.preload(assetUrl("/FireChick/FireChick_Models/FireChick_Gold_NEW.glb"));
useGLTF.preload(assetUrl("/FireChick/FireChick_Models/FireChick_Red_NEW.glb"));
useGLTF.preload(assetUrl("/FireChick/FireChick_Models/FireChick_Yellow_NEW.glb"));
useGLTF.preload(assetUrl("/FireChick/FireChick_Models/FireChick_Blue_NEW.glb"));
useGLTF.preload(assetUrl("/FireChick/FireChick_Models/FireChick_Green_NEW.glb"));
useGLTF.preload(assetUrl("/FireChick/FireChick_Models/FireChick_Cyan_NEW.glb"));
useGLTF.preload(assetUrl("/FireChick/FireChick_Models/FireChick_Pink_NEW.glb"));
