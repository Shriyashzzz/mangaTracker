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
// on the strip, each spine a slide reaches (every strip of spines: the
// series page's, the Volumes tab's, the add and edit forms'), the reading
// counter moved. 20ms: a 10ms pulse is too short for many phones' motors to
// be felt at all (Android's log showed them played, the hand felt nothing)
export const tick = () => buzz(20);
