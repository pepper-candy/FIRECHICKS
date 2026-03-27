import { useState, useEffect, useCallback } from 'react';

/**
 * Manages fullscreen state for mobile browsers.
 * Hides the Chrome/Safari address bar by entering native fullscreen.
 * Falls back gracefully on iOS where the API is unavailable.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(
    () => !!document.fullscreenElement || !!(document as any).webkitFullscreenElement,
  );
  const [canNativeFullscreen, setCanNativeFullscreen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    setCanNativeFullscreen(
      typeof el.requestFullscreen === 'function' ||
      typeof (el as any).webkitRequestFullscreen === 'function',
    );
    setIsTouchDevice(('ontouchstart' in window) || navigator.maxTouchPoints > 0);

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
    const tryMobileImmersive = () => {
      window.scrollTo(0, 1);
      setTimeout(() => window.scrollTo(0, 1), 50);
    };
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' });
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      } else {
        tryMobileImmersive();
      }
    } catch {
      tryMobileImmersive();
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

  const showImmersiveControl = canNativeFullscreen || isTouchDevice;

  return { isFullscreen, isSupported: canNativeFullscreen, canNativeFullscreen, showImmersiveControl, enter, exit };
}
