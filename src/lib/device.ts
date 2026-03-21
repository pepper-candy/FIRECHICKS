/** Returns true for phones, tablets, and iPads (including iPad in desktop-mode Safari). */
export function isMobileTabletOrIpad(): boolean {
  if (typeof window === 'undefined') return false;

  // iPad under "Request Desktop Website": reports MacIntel platform but has multi-touch
  const platform = (navigator as Navigator & { platform?: string }).platform ?? '';
  if (platform.startsWith('Mac') && navigator.maxTouchPoints > 1) return true;

  // Primary signal: coarse pointer means touch-first (phones, tablets)
  if (window.matchMedia('(pointer: coarse)').matches) return true;

  // UA fallback for edge cases (some browsers don't support pointer media query)
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
