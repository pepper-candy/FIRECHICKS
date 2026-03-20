// src/lib/assets.ts

// Detect if we're on local network (PC hotspot) or Vercel
const isLocalNetwork = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' ||
         hostname === '127.0.0.1' ||
         hostname === '192.168.31.178' ||  // Your PC's Wi-Fi IP
         hostname.startsWith('172.25.') ||  // WSL IP range
         hostname.startsWith('10.');        // Other local IP ranges
};

// Determine base URL based on environment
const getBaseUrl = (): string => {
  if (isLocalNetwork()) {
    // Local mode: assets from your PC (same origin)
    return window.location.origin;
  }
  // Production mode: assets from Cloudflare
  return 'https://firechick-assets.mongklhk.workers.dev';
};

export const ASSET_BASE_URL = getBaseUrl();

export function assetUrl(path: string): string {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  
  if (isLocalNetwork()) {
    // Local mode: assets are in /public/ folder
    return `${ASSET_BASE_URL}/${normalized}`;
  }
  // Cloudflare mode: assets are under /public/ in R2 bucket
  return `${ASSET_BASE_URL}/public/${normalized}`;
}