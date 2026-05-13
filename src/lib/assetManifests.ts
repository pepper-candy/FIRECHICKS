import { assetUrl } from '@/lib/assets';

const COLORS = ['Black', 'Blue', 'Cyan', 'Gold', 'Green', 'Pink', 'Red', 'Yellow'] as const;
const ANIMS = ['Idle', 'Running', 'Victory'] as const;
const ATTACK_COLORS = ['Black', 'Gold'] as const;

// ── 8 model GLBs (FireChick_Models) ──────────────────────────────────────────
export const MODEL_GLB_URLS: string[] = COLORS.map(
  (c) => assetUrl(`/FireChick/FireChick_Models/FireChick_${c}_NEW.glb`),
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

// ── 8 video files ─────────────────────────────────────────────────────────────
export const VIDEO_URLS: string[] = [
  assetUrl('/Animations/Hurt.mp4'),
  assetUrl('/Animations/Dead_NEW.mp4'),
  assetUrl('/Animations/Entrance_NEW.mp4'),
  assetUrl('/Animations/1_Meet.mp4'),
  assetUrl('/Animations/2_Glow_Building.mp4'),
  assetUrl('/Animations/4_Final.mp4'),
  assetUrl('/Animations/Warning_Eagle.mp4'),
  assetUrl('/Animations/Credit.mp4'),
];

// ── Audio files ──────────────────────────────────────────────────────────────
export const AUDIO_URLS_HOST: string[] = [
  assetUrl('/Music/Arrival_in_the_Shallows.m4a'),
  assetUrl('/Music/Oompa_Until_You_Croak.mp3'),
  assetUrl('/Music/The_Good_Guys.mp3'),
  assetUrl('/Music/Under_the_Wings.m4a'),
];

export const AUDIO_URLS_MOBILE: string[] = [
  assetUrl('/Music/The_Good_Guys.mp3'),
];

// ── Lobby intro videos (host only) ───────────────────────────────────────────
export const LOBBY_VIDEO_URLS: string[] = [
  assetUrl('/Animations/Game_Lobby_Intro_New.mp4'),
  assetUrl('/Animations/Game_Lobby_Char_plus_Props_Intro.mp4'),
];

// ── Tiers ─────────────────────────────────────────────────────────────────────
/** Mobile/tablet join path: 8 model GLBs + 16 PNGs + mobile audio = 25 assets */
export const MINIMAL_URLS: string[] = [...MODEL_GLB_URLS, ...PW_PNG_URLS, ...AUDIO_URLS_MOBILE, assetUrl('/Animations/Credit.mp4')];

/** Full / desktop / mobile host: models + animations + PNGs + videos + host audio + lobby videos */
export const FULL_URLS: string[] = [
  ...MODEL_GLB_URLS,
  ...ANIMATION_GLB_URLS,
  ...PW_PNG_URLS,
  ...VIDEO_URLS,
  ...LOBBY_VIDEO_URLS,
  ...AUDIO_URLS_HOST,
];
