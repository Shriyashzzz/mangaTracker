// For things pressed while a text box should keep the cursor: a dropdown's
// rows, a search box's close button.
import type { PointerEvent, SyntheticEvent } from "react";

const stay = (e: SyntheticEvent) => e.preventDefault();

// Spread onto the thing pressed: the press doesn't take focus from the box.
// Chrome honours a cancelled pointerdown. Safari doesn't: there the focus
// moves on the mousedown that follows, so that's cancelled too. (Without
// it, picking a title on an iPad closed the list before the tap landed.)
export const keepFocus = { onPointerDown: stay, onMouseDown: stay };

// Highlights a row under a real mouse only. On a touch screen Safari can
// swallow the first tap when "hovering" changes the row
export const onMouseHover = (highlight: () => void) => ({
  onPointerEnter: (e: PointerEvent) => {
    if (e.pointerType === "mouse") highlight();
  },
});
