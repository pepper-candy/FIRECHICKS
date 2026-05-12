import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { useGLTF } from '@react-three/drei';
import {
  MINIMAL_URLS,
  FULL_URLS,
  CHARACTER_ANIMATION_GLB_URLS,
} from '@/lib/assetManifests';
import { putInCache, getFromCache, ASSET_CACHE_NAME } from '@/lib/assetCache';
import { isMobileTabletOrIpad } from '@/lib/device';

// ── Low-level helpers ─────────────────────────────────────────────────────────

const PER_ASSET_TIMEOUT_MS = 45_000;
const FETCH_CONCURRENCY = 6;

function preloadMedia(url: string): Promise<void> {
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
    if (url.endsWith('.mp3') || url.endsWith('.m4a')) {
      const audio = document.createElement('audio');
      audio.preload = 'auto';
      audio.addEventListener('canplaythrough', finish, { once: true });
      audio.addEventListener('error', finish, { once: true });
      audio.src = url;
      audio.load();
    } else {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.addEventListener('loadeddata', finish, { once: true });
      video.addEventListener('progress', () => {
        if (video.buffered.length > 0 && video.buffered.end(0) >= video.duration) {
          finish();
        }
      }, { once: false });
      video.addEventListener('canplaythrough', finish, { once: true });
      video.addEventListener('error', finish, { once: true });
      video.src = url;
      video.load();
    }
  });
}

async function fetchAndCache(url: string): Promise<void> {
  const cached = await getFromCache(url);
  if (cached) {
    if (url.endsWith('.glb')) useGLTF.preload(url);
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_ASSET_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      mode: 'cors',
      cache: 'default',
    });
    clearTimeout(timer);
    if (r.ok) {
      const isMedia = url.endsWith('.mp4') || url.endsWith('.mp3') || url.endsWith('.m4a');
      // Clone for cache, then consume the original body fully
      await putInCache(url, r.clone());
      // For media files, read the entire body to ensure it's fully downloaded
      if (isMedia) {
        const reader = r.body?.getReader();
        if (reader) {
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        }
        console.log('fully cached:', url); // ← temporary
      } else {
        await r.blob();
      }
      if (url.endsWith('.glb')) useGLTF.preload(url);
    }
  } catch (e) {
    clearTimeout(timer);
    if ((e as Error)?.name !== 'AbortError') console.warn('[assets] fetch failed:', url, e);
  }
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

// Quickly count how many URLs are already cached (for the fast-path on repeat visits)
async function countCachedFast(urls: string[]): Promise<number> {
  if (!('caches' in window) || urls.length === 0) return 0;
  try {
    const cache = await caches.open(ASSET_CACHE_NAME);
    const hits = await Promise.all(urls.map((u) => cache.match(u)));
    return hits.filter(Boolean).length;
  } catch {
    return 0;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssetLoadingState {
  isMobile: boolean;
  /** Progress for the active entry-point tier (0–100) */
  entryProgress: number;
  entryReady: boolean;
  /** Progress for the full asset pack (0–100); only meaningful on desktop or after HOST on mobile */
  fullProgress: number;
  fullReady: boolean;
  characterAnimationsProgress: number;
  characterAnimationsReady: boolean;
  characterAnimationsLoading: boolean;
  /** Trigger full asset loading (idempotent). Called automatically on desktop; call on mobile HOST. */
  startFullPreload: () => void;
  /** Trigger character animation GLB loading (idempotent). */
  startCharacterAnimationPreload: () => void;
}

const Ctx = createContext<AssetLoadingState | null>(null);

export function useAssetLoading(): AssetLoadingState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAssetLoading must be used inside AssetLoadingProvider');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AssetLoadingProvider({ children }: { children: ReactNode }) {
  const isMobile = isMobileTabletOrIpad();

  const [entryProgress, setEntryProgress] = useState(0);
  const [entryReady, setEntryReady] = useState(false);
  const [fullProgress, setFullProgress] = useState(0);
  const [fullReady, setFullReady] = useState(false);
  const [charAnimProgress, setCharAnimProgress] = useState(0);
  const [charAnimReady, setCharAnimReady] = useState(false);
  const [charAnimLoading, setCharAnimLoading] = useState(false);

  const fullLoadingRef = useRef(false);
  const charLoadingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Internal runner ─────────────────────────────────────────────────────────

  const runLoad = useCallback(
    async (
      urls: string[],
      onProgress: (pct: number) => void,
      onDone: () => void,
    ) => {
      const total = urls.length;
      if (total === 0) {
        onProgress(100);
        onDone();
        return;
      }

      let loaded = 0;
      const bump = () => {
        if (!mountedRef.current) return;
        loaded++;
        onProgress(Math.round((loaded / total) * 100));
        if (loaded >= total) onDone();
      };

      // Fast-path: count already-cached URLs and credit them immediately
      const alreadyCached = await countCachedFast(urls);
      if (alreadyCached > 0) {
        // Warm drei for any cached GLBs
        const cache = await caches.open(ASSET_CACHE_NAME);
        await Promise.all(
          urls.map(async (url) => {
            if (!url.endsWith('.glb')) return;
            const hit = await cache.match(url);
            if (hit) useGLTF.preload(url);
          }),
        );
        // Credit cached count immediately and check if we're already done
        loaded = alreadyCached;
        onProgress(Math.round((loaded / total) * 100));
        if (loaded >= total) {
          onDone();
          return;
        }
      }

      const uncached = await (async () => {
        if (!('caches' in window)) return urls;
        const cache = await caches.open(ASSET_CACHE_NAME);
        const results = await Promise.all(
          urls.map(async (url) => ({ url, hit: !!(await cache.match(url)) })),
        );
        return results.filter((r) => !r.hit).map((r) => r.url);
      })();

      if (!mountedRef.current) return;

      const glbs = uncached.filter((u) => u.endsWith('.glb'));
      const videos = uncached.filter((u) => u.endsWith('.mp4'));
      const audio = uncached.filter((u) => u.endsWith('.mp3') || u.endsWith('.m4a'));
      const others = uncached.filter((u) => !u.endsWith('.glb') && !u.endsWith('.mp4'));

      await mapPool(glbs, FETCH_CONCURRENCY, async (url) => {
        if (!mountedRef.current) return;
        await fetchAndCache(url);
        bump();
      });

      await Promise.all([
        ...others.map(async (url) => {
          if (!mountedRef.current) return;
          await fetchAndCache(url);
          bump();
        }),
        ...audio.map(async (url) => {
          if (!mountedRef.current) return;
          await preloadMedia(url);
          bump();
        }),
        // Videos: just cache via fetch, don't preload into DOM elements
        ...videos.map(async (url) => {
          if (!mountedRef.current) return;
          await fetchAndCache(url);
          bump();
        }),
      ]);
    },
    [],
  );

  // ── Entry preload (minimal on mobile, full on desktop) ─────────────────────

  const startMinimalPreload = useCallback(async () => {
    try {
      await runLoad(
        MINIMAL_URLS,
        (pct) => mountedRef.current && setEntryProgress(pct),
        () => mountedRef.current && setEntryReady(true),
      );
    } catch (e) {
      console.error('[assets] minimal preload error', e);
      if (mountedRef.current) {
        setEntryProgress(100);
        setEntryReady(true);
      }
    }
  }, [runLoad]);

  // ── Full preload ────────────────────────────────────────────────────────────

  const startFullPreload = useCallback(() => {
    if (fullLoadingRef.current || fullReady) return;
    fullLoadingRef.current = true;

    void (async () => {
      try {
        await runLoad(
          FULL_URLS,
          (pct) => {
            if (!mountedRef.current) return;
            setFullProgress(pct);
            // On desktop the entry indicator mirrors full progress
            if (!isMobile) setEntryProgress(pct);
          },
          () => {
            if (!mountedRef.current) return;
            setFullReady(true);
            setEntryReady(true);
          },
        );
      } catch (e) {
        console.error('[assets] full preload error', e);
        if (mountedRef.current) {
          setFullProgress(100);
          setFullReady(true);
          setEntryReady(true);
        }
      }
    })();
  }, [fullReady, isMobile, runLoad]);

  // ── Character animation preload ─────────────────────────────────────────────

  const startCharacterAnimationPreload = useCallback(() => {
    if (charLoadingRef.current || charAnimReady) return;
    charLoadingRef.current = true;
    if (mountedRef.current) setCharAnimLoading(true);

    void (async () => {
      try {
        await runLoad(
          CHARACTER_ANIMATION_GLB_URLS,
          (pct) => mountedRef.current && setCharAnimProgress(pct),
          () => {
            if (!mountedRef.current) return;
            setCharAnimReady(true);
            setCharAnimLoading(false);
          },
        );
      } catch (e) {
        console.error('[assets] character anim preload error', e);
        if (mountedRef.current) {
          setCharAnimProgress(100);
          setCharAnimReady(true);
          setCharAnimLoading(false);
        }
      }
    })();
  }, [charAnimReady, runLoad]);

  // ── Auto-start on mount ─────────────────────────────────────────────────────

  useEffect(() => {
    if (isMobile) {
      void startMinimalPreload();
    } else {
      startFullPreload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ctx.Provider
      value={{
        isMobile,
        entryProgress,
        entryReady,
        fullProgress,
        fullReady,
        characterAnimationsProgress: charAnimProgress,
        characterAnimationsReady: charAnimReady,
        characterAnimationsLoading: charAnimLoading,
        startFullPreload,
        startCharacterAnimationPreload,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
