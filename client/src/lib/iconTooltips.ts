// Android's tooltip: holding a button that's only an icon (the bag, search,
// sort, a row's ⋮) shows a small label saying what it does, above it, and
// the hold doesn't also press it. The words are the button's own aria-label.
// Set up once in the app (lib/inApp.ts)
const HOLD_MS = 500;
const SHOWN_MS = 1500;

// a button or link with nothing to read on it but its label
function iconOnly(target: EventTarget | null) {
  const el = (target as Element | null)?.closest?.(
    "button[aria-label], a[aria-label]",
  );
  if (!(el instanceof HTMLElement)) return null;
  return el.innerText.trim() ? null : el;
}

export function showIconTooltips() {
  let timer = 0;
  let tip: HTMLDivElement | null = null;
  let held: HTMLElement | null = null;

  const hide = () => {
    window.clearTimeout(timer);
    tip?.remove();
    tip = null;
  };
  const show = (el: HTMLElement) => {
    hide();
    const r = el.getBoundingClientRect();
    tip = document.createElement("div");
    tip.className = "app-tooltip";
    tip.setAttribute("role", "tooltip");
    tip.textContent = el.getAttribute("aria-label");
    document.body.append(tip);
    const w = tip.offsetWidth;
    const left = Math.min(
      window.innerWidth - w - 8,
      Math.max(8, r.left + r.width / 2 - w / 2),
    );
    // above it, or under it when it's at the top of the screen
    const top = r.top > 48 ? r.top - tip.offsetHeight - 8 : r.bottom + 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    held = el;
    navigator.vibrate?.(10);
  };

  document.addEventListener(
    "touchstart",
    (e) => {
      const el = iconOnly(e.target);
      held = null;
      if (!el) return;
      timer = window.setTimeout(() => show(el), HOLD_MS);
    },
    { capture: true, passive: true },
  );
  document.addEventListener("touchmove", () => window.clearTimeout(timer), {
    capture: true,
    passive: true,
  });
  document.addEventListener(
    "touchend",
    () => {
      window.clearTimeout(timer);
      if (tip) timer = window.setTimeout(hide, SHOWN_MS);
    },
    { capture: true },
  );
  // the click that ends a hold that showed a label presses nothing
  document.addEventListener(
    "click",
    (e) => {
      if (!held) return;
      if (held.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
      }
      held = null;
    },
    { capture: true },
  );
  window.addEventListener("scroll", hide, { passive: true });
}
