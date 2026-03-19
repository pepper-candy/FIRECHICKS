import { useState, useEffect, useCallback } from 'react';

/**
 * Manages fullscreen state for mobile browsers.
 * Hides the Chrome/Safari address bar by entering native fullscreen.
 * Falls back gracefully on iOS where the API is unavailable.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    setIsSupported(
      typeof el.requestFullscreen === 'function' ||
      typeof (el as any).webkitRequestFullscreen === 'function',
    );

    const onChange = () => {
      setIsFullscreen(
        !!document.fullscreenElement || !!(document as any).webkitFullscreenElement,
      );
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const enter = useCallback(async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' });
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      }
    } catch {
      // User denied or browser disallows — silently ignore
    }
  }, []);

  const exit = useCallback(async () => {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) await (document as any).webkitExitFullscreen();
    } catch {
      // Ignore
    }
  }, []);

  return { isFullscreen, isSupported, enter, exit };
}
