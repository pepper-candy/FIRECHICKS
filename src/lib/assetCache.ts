// Shared cache name — must stay in sync with public/asset-cache-sw.js CACHE_NAME.
export const ASSET_CACHE_NAME = 'firechick-assets-v1';

function isSupported(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

export async function putInCache(url: string, response: Response): Promise<void> {
  if (!isSupported()) return;
  try {
    const cache = await caches.open(ASSET_CACHE_NAME);
    await cache.put(url, response);
  } catch (e) {
    console.warn('[assetCache] cache.put failed:', url, e);
  }
}

export async function getFromCache(url: string): Promise<Response | undefined> {
  if (!isSupported()) return undefined;
  try {
    const cache = await caches.open(ASSET_CACHE_NAME);
    return (await cache.match(url)) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Returns the number of URLs that already have a cached entry. */
export async function countCached(urls: string[]): Promise<number> {
  if (!isSupported() || urls.length === 0) return 0;
  try {
    const cache = await caches.open(ASSET_CACHE_NAME);
    const hits = await Promise.all(urls.map((u) => cache.match(u)));
    return hits.filter(Boolean).length;
  } catch {
    return 0;
  }
}

/** Returns true only if every URL in the list has a cached entry. */
export async function checkAllCached(urls: string[]): Promise<boolean> {
  if (!isSupported() || urls.length === 0) return false;
  const hit = await countCached(urls);
  return hit === urls.length;
}
