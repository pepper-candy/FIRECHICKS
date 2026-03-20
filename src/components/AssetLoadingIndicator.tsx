import { useState, useEffect, useRef } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { assetUrl } from '@/lib/assets';

const GLB_COLORS = ['Black', 'Blue', 'Cyan', 'Gold', 'Green', 'Pink', 'Red', 'Yellow'] as const;
// Walking_* glbs are not used (not on CDN / local)
const GLB_ANIMS = ['Idle', 'Running', 'Victory'] as const;
const ATTACK_COLORS = ['Black', 'Gold'] as const;

/** Max wait per asset — avoids hanging forever on stalled TCP / missing video events */
const PER_ASSET_TIMEOUT_MS = 45_000;
/** Limit parallel downloads to same CDN (many browsers cap ~6 per host; too many can stall) */
const FETCH_CONCURRENCY = 6;

function getGlbPath(anim: string, color: string) {
  return assetUrl(`/FireChick/FireChick_Animation/FireChick_${anim}/${anim}_${color}.glb`);
}

const ALL_ASSETS: string[] = [];

for (const anim of GLB_ANIMS) {
  for (const color of GLB_COLORS) {
    ALL_ASSETS.push(getGlbPath(anim, color));
  }
}
for (const color of ATTACK_COLORS) {
  ALL_ASSETS.push(getGlbPath('Attack', color));
}

for (let q = 1; q <= 4; q++) {
  ALL_ASSETS.push(assetUrl(`/PW/PW_Final_${q}_layer-1.png`));
  ALL_ASSETS.push(assetUrl(`/PW/PW_Final_${q}_layer-2.png`));
  ALL_ASSETS.push(assetUrl(`/PW/PW_Mock_${q}_layer-1.png`));
  ALL_ASSETS.push(assetUrl(`/PW/PW_Mock_${q}_layer-2.png`));
}

ALL_ASSETS.push(assetUrl('/Animations/Hurt.mp4'));
ALL_ASSETS.push(assetUrl('/Animations/Dead.mp4'));

const TOTAL = ALL_ASSETS.length;

function preloadVideo(url: string): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const t = setTimeout(done, PER_ASSET_TIMEOUT_MS);
    const finish = () => {
      clearTimeout(t);
      done();
    };

    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    // `canplaythrough` often never fires on mobile / with CDN; `loadeddata` is enough for "in cache"
    video.addEventListener('loadeddata', finish, { once: true });
    video.addEventListener('canplaythrough', finish, { once: true });
    video.addEventListener('error', finish, { once: true });
    video.src = url;
    video.load();
  });
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const t = setTimeout(done, PER_ASSET_TIMEOUT_MS);
    const img = new Image();
    img.onload = () => {
      clearTimeout(t);
      done();
    };
    img.onerror = () => {
      clearTimeout(t);
      done();
    };
    img.src = url;
  });
}

function preloadFetch(url: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_ASSET_TIMEOUT_MS);
  return fetch(url, { signal: controller.signal, mode: 'cors', cache: 'default' })
    .then((r) => {
      if (!r.ok) console.warn('[assets] HTTP', r.status, url);
      return r.blob();
    })
    .catch((e) => {
      if (e?.name !== 'AbortError') console.warn('[assets] fetch failed:', url, e);
    })
    .finally(() => clearTimeout(timer));
}

function preloadOne(url: string): Promise<void> {
  if (url.endsWith('.mp4')) return preloadVideo(url);
  if (url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg')) return preloadImage(url);
  return preloadFetch(url);
}

/** Run async tasks with limited concurrency */
async function mapPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

export default function AssetLoadingIndicator() {
  const [loaded, setLoaded] = useState(0);
  const [done, setDone] = useState(false);
  const countRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    countRef.current = 0;
    setLoaded(0);
    setDone(false);

    const bump = () => {
      if (!mounted) return;
      countRef.current += 1;
      const n = countRef.current;
      setLoaded(n);
      if (n >= TOTAL) setDone(true);
    };

    const glbUrls = ALL_ASSETS.filter((u) => u.endsWith('.glb'));
    const otherUrls = ALL_ASSETS.filter((u) => !u.endsWith('.glb'));

    void (async () => {
      try {
        await mapPool(glbUrls, FETCH_CONCURRENCY, async (url) => {
          await preloadOne(url);
          bump();
        });
        await Promise.all(
          otherUrls.map(async (url) => {
            await preloadOne(url);
            bump();
          }),
        );
      } catch (e) {
        console.error('[assets] preload batch error', e);
        if (mounted) {
          setLoaded(TOTAL);
          setDone(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
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
