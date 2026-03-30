/** Short vibration buzz for mobile devices. No-op on unsupported browsers. */
export function buzz(ms = 50) {
  const tryCapacitorHaptics = () => {
    const capacitor = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (!capacitor?.isNativePlatform?.()) return;

    void import('@capacitor/haptics')
      .then(({ Haptics, ImpactStyle }) =>
        Haptics.vibrate({ duration: ms }).catch(() => Haptics.impact({ style: ImpactStyle.Medium })),
      )
      .catch(() => {
        // silently ignore
      });
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
