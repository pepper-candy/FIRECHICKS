/** Short vibration buzz for mobile devices. No-op on unsupported browsers. */
export function buzz(ms = 50) {
  try {
    navigator?.vibrate?.(ms);
  } catch {
    // silently ignore
  }
}
