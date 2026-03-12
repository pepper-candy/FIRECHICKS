import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils.js';

const COLORS = ['Black', 'Blue', 'Cyan', 'Gold', 'Green', 'Pink', 'Red', 'Yellow'] as const;
export type ChickColor = typeof COLORS[number];
export { COLORS as CHICK_COLORS };

type AnimState = 'Idle' | 'Walking' | 'Running' | 'Victory' | 'Attack';

interface Props {
  color: ChickColor;
  animState: AnimState;
  facingAngle: number;
}

function getAnimPath(anim: AnimState, color: ChickColor) {
  const folder = `FireChick_${anim}`;
  return `/FireChick/FireChick_Animation/${folder}/${anim}_${color}.glb`;
}

// Inner component that remounts when path changes (via key)
function CharacterModel({ path, facingAngle }: { path: string; facingAngle: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(path);

  // Clone with skeleton so multiple instances work
  const clone = useRef<THREE.Group | null>(null);
  if (!clone.current) {
    clone.current = SkeletonUtils.clone(scene) as THREE.Group;
  }

  const { actions, mixer } = useAnimations(animations, groupRef);

  // Play the first clip
  useEffect(() => {
    const names = Object.keys(actions);
    if (names.length > 0) {
      const action = actions[names[0]];
      if (action) {
        action.reset().fadeIn(0.15).play();
        return () => { action.fadeOut(0.15); };
      }
    }
  }, [actions]);

  // Update mixer each frame
  useFrame((_, delta) => {
    mixer?.update(delta);
    if (groupRef.current) {
      const target = facingAngle;
      const current = groupRef.current.rotation.y;
      const diff = target - current;
      const wrapped = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
      groupRef.current.rotation.y += wrapped * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={clone.current} scale={1.5} />
    </group>
  );
}

export default function CharacterViewer({ color, animState, facingAngle }: Props) {
  const effectiveAnim: AnimState =
    animState === 'Attack' && color !== 'Black' && color !== 'Gold'
      ? 'Idle'
      : animState;

  const path = getAnimPath(effectiveAnim, color);

  // Key forces remount when GLB path changes, ensuring fresh animations
  return <CharacterModel key={path} path={path} facingAngle={facingAngle} />;
}
