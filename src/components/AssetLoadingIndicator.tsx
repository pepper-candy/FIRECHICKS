import { useState, useEffect, useRef } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { assetUrl } from '@/lib/assets';

// All assets to track loading
const GLB_COLORS = ['Black', 'Blue', 'Cyan', 'Gold', 'Green', 'Pink', 'Red', 'Yellow'] as const;
const GLB_ANIMS = ['Idle', 'Walking', 'Running', 'Victory'] as const;
const ATTACK_COLORS = ['Black', 'Gold'] as const;

function getGlbPath(anim: string, color: string) {
  return assetUrl(`/FireChick/FireChick_Animation/FireChick_${anim}/${anim}_${color}.glb`);
}

const ALL_ASSETS: string[] = [];

// GLB files
for (const anim of GLB_ANIMS) {
  for (const color of GLB_COLORS) {
    ALL_ASSETS.push(getGlbPath(anim, color));
  }
}
for (const color of ATTACK_COLORS) {
  ALL_ASSETS.push(getGlbPath('Attack', color));
}

// PW Exam PNGs
for (let q = 1; q <= 4; q++) {
  ALL_ASSETS.push(assetUrl(`/PW/PW_Final_${q}_layer-1.png`));
  ALL_ASSETS.push(assetUrl(`/PW/PW_Final_${q}_layer-2.png`));
  ALL_ASSETS.push(assetUrl(`/PW/PW_Mock_${q}_layer-1.png`));
  ALL_ASSETS.push(assetUrl(`/PW/PW_Mock_${q}_layer-2.png`));
}

// Videos
ALL_ASSETS.push(assetUrl('/Animations/Hurt.mp4'));
ALL_ASSETS.push(assetUrl('/Animations/Dead.mp4'));

const TOTAL = ALL_ASSETS.length;

export default function AssetLoadingIndicator() {
  const [loaded, setLoaded] = useState(0);
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let count = 0;
    const increment = () => {
      count++;
      setLoaded(count);
      if (count >= TOTAL) setDone(true);
    };

    for (const url of ALL_ASSETS) {
      if (url.endsWith('.mp4')) {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.src = url;
        video.oncanplaythrough = () => increment();
        video.onerror = () => increment();
      } else if (url.endsWith('.png') || url.endsWith('.jpg')) {
        const img = new Image();
        img.src = url;
        img.onload = () => increment();
        img.onerror = () => increment();
      } else {
        // GLB - use fetch
        fetch(url)
          .then((r) => r.blob())
          .then(() => increment())
          .catch(() => increment());
      }
    }
  }, []);

  const pct = TOTAL > 0 ? Math.round((loaded / TOTAL) * 100) : 0;

  return (
    <div className="fixed bottom-3 right-3 z-40 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/90 border border-border backdrop-blur-sm shadow-lg">
      {done ? (
        <>
          <Check className="w-4 h-4 text-primary" />
          <span className="text-[11px] font-mono text-primary">Loaded</span>
        </>
      ) : (
        <>
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          <span className="text-[11px] font-mono text-muted-foreground">{pct}%</span>
        </>
      )}
    </div>
  );
}
