/**
 * Utility to trigger device haptic feedback using the standard Web Vibration API.
 * This pattern enhances the premium feel on mobile devices.
 */

// Safe execution wrapper to avoid SSR issues or unsupported browsers
function triggerVibration(pattern: number | number[]) {
  if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
    try {
      window.navigator.vibrate(pattern);
    } catch {
      // Vibration API not supported — intentional noop
    }
  }
}

export const haptics = {
  /** Light tap, good for simple buttons or tab switches */
  light: () => triggerVibration(10),
  /** Medium tap, good for primary actions like submitting a form */
  medium: () => triggerVibration(20),
  /** Heavy tap, good for destructive actions or important alerts */
  heavy: () => triggerVibration(30),
  /** Success pattern, two light taps */
  success: () => triggerVibration([10, 50, 10]),
  /** Error/Warning pattern, heavier double tap */
  warning: () => triggerVibration([30, 50, 30]),
  /** Gentle build up pattern, good for opening large modals or drawers */
  drawerOpen: () => triggerVibration([15, 30, 20]),
};
