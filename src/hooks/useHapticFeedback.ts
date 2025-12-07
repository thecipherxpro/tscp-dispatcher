/**
 * Haptic feedback utility for native-like mobile feel
 */
export function useHapticFeedback() {
  const vibrate = (pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  return {
    // Light tap - for buttons, selections
    light: () => vibrate(10),
    // Medium feedback - for successful actions
    medium: () => vibrate(25),
    // Heavy feedback - for errors or important actions
    heavy: () => vibrate([30, 10, 30]),
    // Success pattern
    success: () => vibrate([10, 50, 20]),
    // Error pattern
    error: () => vibrate([50, 30, 50]),
  };
}
