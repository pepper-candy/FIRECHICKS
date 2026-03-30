/** Short vibration buzz for mobile devices. No-op on unsupported browsers. */
export function buzz(ms = 50) {
  const tryCapacitorHaptics = () => {
    const capacitor = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> } }).Capacitor;
    const isNative = !!capacitor?.isNativePlatform?.();
    if (!isNative) return;

    const haptics = capacitor?.Plugins?.Haptics as
      | { vibrate?: (opts?: { duration?: number }) => Promise<void>; impact?: (opts?: { style?: string }) => Promise<void> }
      | undefined;

    if (!haptics) return;

    if (typeof haptics.vibrate === 'function') {
      void haptics.vibrate({ duration: ms });
      return;
    }

    if (typeof haptics.impact === 'function') {
      void haptics.impact({ style: 'LIGHT' });
    }
  };

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      const didVibrate = navigator.vibrate(ms);
      if (didVibrate) return;
    }

    tryCapacitorHaptics();
  } catch {
    tryCapacitorHaptics();
  }
}
