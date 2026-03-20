import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { assetUrl } from '@/lib/assets';
import type { AnimState } from '@/lib/gameTypes';

const COLORS = ['Black', 'Blue', 'Cyan', 'Gold', 'Green', 'Pink', 'Red', 'Yellow'] as const;
export type ChickColor = typeof COLORS[number];
export { COLORS as CHICK_COLORS };

interface Props {
  color: ChickColor;
  animState: AnimState;
  facingAngle: number;
}

function getAnimPath(anim: AnimState, color: ChickColor) {
  const folder = `FireChick_${anim}`;
  return assetUrl(`/FireChick/FireChick_Animation/${folder}/${anim}_${color}.glb`);
}

function CharacterModel({
  path,
  facingAngle,
  oneShot,
}: {
  path: string;
  facingAngle: number;
  oneShot?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(path);

  const clone = useRef<THREE.Group | null>(null);
  if (!clone.current) {
    clone.current = SkeletonUtils.clone(scene) as THREE.Group;
  }

  const { actions, mixer } = useAnimations(animations, groupRef);

  useEffect(() => {
    const names = Object.keys(actions);
    if (names.length > 0) {
      const action = actions[names[0]];
      if (action) {
        if (oneShot) {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        } else {
          action.setLoop(THREE.LoopRepeat, Infinity);
        }
        action.reset().fadeIn(0.15).play();
        return () => {
          action.fadeOut(0.15);
        };
      }
    }
  }, [actions, oneShot]);

  useFrame((_, delta) => {
    mixer?.update(delta);
    if (groupRef.current) {
      const target = facingAngle + Math.PI;
      const current = groupRef.current.rotation.y;
      let diff = target - current;
      diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      groupRef.current.rotation.y += diff * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={clone.current} scale={1.5} />
    </group>
  );
}

export default function CharacterViewer({ color, animState, facingAngle }: Props) {
  // Only Black and Gold have Attack animation
  const effectiveAnim: AnimState =
    animState === 'Attack' && color !== 'Black' && color !== 'Gold' ? 'Idle' : animState;

  const path = getAnimPath(effectiveAnim, color);
  const isOneShot = effectiveAnim === 'Attack';

  return <CharacterModel key={path} path={path} facingAngle={facingAngle} oneShot={isOneShot} />;
}
