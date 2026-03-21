import { useGLTF } from '@react-three/drei';
import { ANIMATION_GLB_URLS, CHARACTER_ANIMATION_GLB_URLS } from '@/lib/assetManifests';

// Re-export so existing callers still compile without change.
export const ALL_PATHS: string[] = ANIMATION_GLB_URLS;

export function preloadAllAnimations() {
  for (const path of CHARACTER_ANIMATION_GLB_URLS) {
    useGLTF.preload(path);
  }
}
