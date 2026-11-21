import { useEffect, useRef, useState } from "react";
import { swallowClosingTap } from "../../lib/inApp";
import { useCloseOnBack } from "../../lib/closeOnBack";

// open, and closed again by a click elsewhere or Escape (focus back on its
// button)
export function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      swallowClosingTap(e.target);
      setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  // Android's back, or Escape
  useCloseOnBack(open, () => {
    setOpen(false);
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
  });
  return { open, setOpen, ref };
}
