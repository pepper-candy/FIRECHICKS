import { assetUrl } from '@/lib/assets';

const COLORS = ['Black', 'Blue', 'Cyan', 'Gold', 'Green', 'Pink', 'Red', 'Yellow'] as const;
const ANIMS = ['Idle', 'Running', 'Victory'] as const;
const ATTACK_COLORS = ['Black', 'Gold'] as const;

// ── 8 model GLBs (FireChick_Models) ──────────────────────────────────────────
export const MODEL_GLB_URLS: string[] = COLORS.map(
  (c) => assetUrl(`/FireChick/FireChick_Models/FireChick_${c}.glb`),
);

// ── 16 PW PNGs ───────────────────────────────────────────────────────────────
export const PW_PNG_URLS: string[] = [];
for (let q = 1; q <= 4; q++) {
  PW_PNG_URLS.push(assetUrl(`/PW/PW_Final_${q}_layer-1.png`));
  PW_PNG_URLS.push(assetUrl(`/PW/PW_Final_${q}_layer-2.png`));
  PW_PNG_URLS.push(assetUrl(`/PW/PW_Mock_${q}_layer-1.png`));
  PW_PNG_URLS.push(assetUrl(`/PW/PW_Mock_${q}_layer-2.png`));
}

// ── Animation GLBs (Idle/Running/Victory × 8 + Attack × 2; no Walking) ──────
export const ANIMATION_GLB_URLS: string[] = [];
for (const anim of ANIMS) {
  for (const color of COLORS) {
    ANIMATION_GLB_URLS.push(
      assetUrl(`/FireChick/FireChick_Animation/FireChick_${anim}/${anim}_${color}.glb`),
    );
  }
}
for (const color of ATTACK_COLORS) {
  ANIMATION_GLB_URLS.push(
    assetUrl(`/FireChick/FireChick_Animation/FireChick_Attack/Attack_${color}.glb`),
  );
}

// ── Character viewer pack = same animation GLBs (no Walking) ─────────────────
export const CHARACTER_ANIMATION_GLB_URLS: string[] = ANIMATION_GLB_URLS;

// ── 2 video files ─────────────────────────────────────────────────────────────
export const VIDEO_URLS: string[] = [
  assetUrl('/Animations/Hurt.mp4'),
  assetUrl('/Animations/Dead.mp4'),
];

// ── Tiers ─────────────────────────────────────────────────────────────────────
/** Mobile/tablet join path: 8 model GLBs + 16 PNGs = 24 assets */
export const MINIMAL_URLS: string[] = [...MODEL_GLB_URLS, ...PW_PNG_URLS];

/** Full / desktop / mobile host: 26 animation GLBs + 16 PNGs + 2 MP4s = 44 assets */
export const FULL_URLS: string[] = [...ANIMATION_GLB_URLS, ...PW_PNG_URLS, ...VIDEO_URLS];
