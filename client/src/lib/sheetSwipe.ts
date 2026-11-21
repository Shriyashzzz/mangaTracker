// Android's bottom sheets close with a swipe down. Every sheet in the app
// (a menu's .app-sheet, a dialog.app-sheet-dialog: index.css) follows the
// finger down from its top and closes past a mark or on a quick flick, and
// springs back otherwise. Only while its list is scrolled to its top, so a
// long list still scrolls: the sheet's own, or a list inside it (the New
// tab's volumes, stacked up from the foot). Set up once in the app
// (lib/inApp.ts).
const SHEETS = ".app-sheet, dialog.app-sheet-dialog[open]";
// how far, or how fast, a swipe closes it
const CLOSE_PX = 90;
const FLICK_PX_PER_MS = 0.6;

// whether a list can still scroll toward its top. One stacked from the foot
// (column-reverse) starts at the bottom, its scrollTop 0 there and below 0
// as it goes up
function canScrollUp(el: Element) {
  if (getComputedStyle(el).flexDirection === "column-reverse")
    return el.scrollHeight - el.clientHeight + el.scrollTop > 1;
  return el.scrollTop > 0;
}

// a list between the finger and the sheet (the sheet too) that isn't at its
// top yet: the drag is that list's to scroll
function listScrollsUp(from: Element | null, sheet: HTMLElement) {
  for (let el = from; el; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight && canScrollUp(el)) return true;
    if (el === sheet) return false;
  }
  return false;
}

// closing a sheet as it closes itself: a dialog shuts; a menu's sheet closes
// on a press outside it, as every menu here listens for
function closeSheet(sheet: HTMLElement) {
  if (sheet instanceof HTMLDialogElement) sheet.close();
  else
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
}

export function swipeSheetsDown() {
  let sheet: HTMLElement | null = null;
  let startY = 0;
  let startAt = 0;
  let moved = 0;
  let dragging = false;
  // where the finger came down
  let target: Element | null = null;

  document.addEventListener(
    "touchstart",
    (e) => {
      const found = (e.target as Element | null)?.closest?.(SHEETS);
      sheet = found instanceof HTMLElement ? found : null;
      dragging = false;
      moved = 0;
      target = e.target as Element | null;
      if (!sheet || listScrollsUp(target, sheet)) {
        sheet = null;
        return;
      }
      startY = e.touches[0]?.clientY ?? 0;
      startAt = performance.now();
    },
    { capture: true, passive: true },
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (!sheet) return;
      moved = (e.touches[0]?.clientY ?? startY) - startY;
      if (!dragging) {
        // up, or scrolled meanwhile: it's the list's, not a swipe
        if (moved <= 4 || listScrollsUp(target, sheet)) {
          if (moved < 0) sheet = null;
          return;
        }
        dragging = true;
        sheet.style.transition = "none";
      }
      e.preventDefault();
      sheet.style.transform = `translateY(${Math.max(0, moved)}px)`;
    },
    { capture: true, passive: false },
  );

  const end = () => {
    if (!sheet || !dragging) {
      sheet = null;
      return;
    }
    const it = sheet;
    sheet = null;
    const fast = moved / Math.max(1, performance.now() - startAt);
    it.style.transition = "transform 200ms cubic-bezier(0.2, 0, 0, 1)";
    if (moved > CLOSE_PX || (moved > 30 && fast > FLICK_PX_PER_MS)) {
      it.style.transform = "translateY(100%)";
      window.setTimeout(() => {
        it.style.transform = "";
        it.style.transition = "";
        closeSheet(it);
      }, 180);
    } else {
      it.style.transform = "";
      window.setTimeout(() => (it.style.transition = ""), 220);
    }
  };
  document.addEventListener("touchend", end, { capture: true });
  document.addEventListener("touchcancel", end, { capture: true });
}
