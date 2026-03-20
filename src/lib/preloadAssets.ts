import { useGLTF } from '@react-three/drei';
import { assetUrl } from '@/lib/assets';

const COLORS = ['Black', 'Blue', 'Cyan', 'Gold', 'Green', 'Pink', 'Red', 'Yellow'] as const;
// Walking_* glbs are not shipped — use Idle for slow movement in UI
const ANIMS = ['Idle', 'Running', 'Victory'] as const;
const ATTACK_COLORS = ['Black', 'Gold'] as const;

function getPath(anim: string, color: string) {
  return assetUrl(`/FireChick/FireChick_Animation/FireChick_${anim}/${anim}_${color}.glb`);
}

// Build full list of GLB paths
const ALL_PATHS: string[] = [];

for (const anim of ANIMS) {
  for (const color of COLORS) {
    ALL_PATHS.push(getPath(anim, color));
  }
}
for (const color of ATTACK_COLORS) {
  ALL_PATHS.push(getPath('Attack', color));
}

export function preloadAllAnimations() {
  for (const path of ALL_PATHS) {
    useGLTF.preload(path);
  }
}

export { ALL_PATHS };
