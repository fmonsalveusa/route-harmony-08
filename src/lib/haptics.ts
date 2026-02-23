/**
 * Haptic Feedback helper
 * Uses navigator.vibrate (web) or Capacitor Haptics plugin (native)
 */

import { isNativePlatform } from './nativeTracking';

type HapticPattern = 'success' | 'alert' | 'medium';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  success: 50,       // short tap
  alert: [50, 100, 50], // double vibration
  medium: 100,       // medium tap
};

let nativeHapticsAvailable: boolean | null = null;

async function tryNativeHaptics(pattern: HapticPattern): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    if (pattern === 'success') {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (pattern === 'alert') {
      await Haptics.notification({ type: NotificationType.Warning });
    } else {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
    return true;
  } catch {
    return false;
  }
}

export async function hapticFeedback(pattern: HapticPattern = 'success') {
  // Try native first
  if (nativeHapticsAvailable !== false && isNativePlatform()) {
    const result = await tryNativeHaptics(pattern);
    nativeHapticsAvailable = result;
    if (result) return;
  }

  // Fallback to web vibration API
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(PATTERNS[pattern]);
    } catch {
      // vibration not supported
    }
  }
}
