import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

const COLORS = ['Black', 'Blue', 'Cyan', 'Gold', 'Green', 'Pink', 'Red', 'Yellow'] as const;
export type ChickColor = typeof COLORS[number];
export { COLORS as CHICK_COLORS };

type AnimState = 'Idle' | 'Walking' | 'Running' | 'Victory' | 'Attack';

interface Props {
  color: ChickColor;
  animState: AnimState;
  facingAngle: number; // radians
}

function getAnimPath(anim: AnimState, color: ChickColor) {
  const folder = `FireChick_${anim}`;
  return `/FireChick/FireChick_Animation/${folder}/${anim}_${color}.glb`;
}

export default function CharacterViewer({ color, animState, facingAngle }: Props) {
  const groupRef = useRef<THREE.Group>(null);

  // Determine effective anim — only Black/Gold can attack
  const effectiveAnim: AnimState =
    animState === 'Attack' && color !== 'Black' && color !== 'Gold'
      ? 'Idle'
      : animState;

  const path = getAnimPath(effectiveAnim, color);

  const { scene, animations } = useGLTF(path);
  const { actions } = useAnimations(animations, groupRef);

  // Clone scene so multiple instances don't conflict
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // Play the first animation clip found
  useEffect(() => {
    const actionNames = Object.keys(actions);
    if (actionNames.length > 0) {
      const action = actions[actionNames[0]];
      if (action) {
        action.reset().fadeIn(0.2).play();
        return () => {
          action.fadeOut(0.2);
        };
      }
    }
  }, [actions]);

  // Smoothly rotate to facing angle
  useFrame(() => {
    if (groupRef.current) {
      const target = facingAngle;
      const current = groupRef.current.rotation.y;
      const diff = target - current;
      // Shortest path rotation
      const wrapped = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
      groupRef.current.rotation.y += wrapped * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} scale={1.5} />
    </group>
  );
}
