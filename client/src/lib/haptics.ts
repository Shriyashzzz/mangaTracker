// A buzz under the thumb on Android. iPhones have no vibration in the
// browser, so nothing happens there, and nothing is lost

// how long, in milliseconds
export function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // no buzz on this device
  }
}

// the light tick of a tap that changes their shelf: a volume or book ticked
// on the strip, the reading counter moved
export const tick = () => buzz(10);
