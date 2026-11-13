// Where Kenji's speech bubble sits on the screen, worked out from the box he's
// pointing at (the "hole") and the room around it. Pure arithmetic: the tour
// measures the page and hands the numbers in.

// the gap between the bubble and what it points at
export const BUBBLE_GAP = 26;
// the least gap between the bubble and the screen's edge
export const SCREEN_MARGIN = 12;

// what he's pointing at, in screen pixels
export type Box = { top: number; left: number; width: number; height: number };

// keeps a number between a least and a most
const between = (least: number, value: number, most: number) =>
  Math.min(Math.max(least, value), most);

// the bubble's top edge. In order:
//   beside the section     level with its top
//   in the corner          at the bottom of the screen, above the bottom bar
//   on top of a big page   above the section, scrolling with it
//   nothing to point at    the middle of the screen
//   otherwise              under or over the hole, kept on screen
export function bubbleTopFor(at: {
  // sitting to the right of the section
  beside: boolean;
  // out of the way at the bottom, for a section too big to sit by
  inCorner: boolean;
  // the step wants him above the section, moving with it
  onTop: boolean;
  // there's a hole to point at
  showHole: boolean;
  // under the hole, not over it
  below: boolean;
  box: Box | null;
  bubbleHeight: number;
  viewHeight: number;
  // the phone's bottom bar, 0 where there's none
  barSpace: number;
  // the page is scrolled down at all
  scrolled: boolean;
}) {
  const { box, bubbleHeight, viewHeight } = at;
  if (at.beside) return box!.top;
  if (at.inCorner)
    return viewHeight - bubbleHeight - SCREEN_MARGIN - at.barSpace;

  const aboveTheHole = box ? box.top - bubbleHeight - BUBBLE_GAP : 0;
  if (at.onTop && at.showHole) {
    // at the very top of the page there may not be room above the section,
    // so there he stays on screen
    return at.scrolled ? aboveTheHole : Math.max(SCREEN_MARGIN, aboveTheHole);
  }
  if (!at.showHole)
    return Math.max(SCREEN_MARGIN, (viewHeight - bubbleHeight) / 2);

  const underTheHole = box!.top + box!.height + BUBBLE_GAP;
  return between(
    SCREEN_MARGIN,
    at.below ? underTheHole : aboveTheHole,
    viewHeight - bubbleHeight - SCREEN_MARGIN,
  );
}

// the bubble's left edge: beside the section, in the middle of the screen
// when there's nothing to point at, else centered on the hole and kept on
// screen
export function bubbleLeftFor(at: {
  beside: boolean;
  showHole: boolean;
  box: Box | null;
  // the middle of the hole, left to right
  holeCenter: number;
  bubbleWidth: number;
  viewWidth: number;
}) {
  const { box, bubbleWidth, viewWidth } = at;
  if (at.beside) return box!.left + box!.width + BUBBLE_GAP;
  if (!at.showHole) return (viewWidth - bubbleWidth) / 2;
  return between(
    SCREEN_MARGIN,
    at.holeCenter - bubbleWidth / 2,
    viewWidth - bubbleWidth - SCREEN_MARGIN,
  );
}
