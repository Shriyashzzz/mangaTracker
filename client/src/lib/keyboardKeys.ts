// What the Enter key on Android's keyboard says for each field, as native
// apps set it: "Search" in a search box, "Next" while a form has more boxes
// to fill, "Done" on its last, "Go" on a sign-in's password. Worked out when
// a field gets focus, for any field that doesn't say already. A box of
// several lines keeps its Enter for a new line. Set up once in the app
// (lib/inApp.ts)
const TYPED =
  'input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="number"], input[type="password"]';

function keyFor(field: HTMLInputElement) {
  const words = `${field.type} ${field.name} ${field.placeholder} ${field.getAttribute("aria-label") ?? ""}`;
  if (
    field.type === "search" ||
    /search/i.test(words) ||
    field.closest('[role="search"]')
  )
    return "search";
  const form = field.form;
  if (!form) return "done";
  const fields = [...form.querySelectorAll<HTMLInputElement>(TYPED)].filter(
    (f) => !f.disabled && f.offsetParent !== null,
  );
  if (fields.indexOf(field) < fields.length - 1) return "next";
  return field.type === "password" ? "go" : "done";
}

export function setKeyboardKeys() {
  document.addEventListener(
    "focusin",
    (e) => {
      const field = e.target;
      if (!(field instanceof HTMLInputElement) || !field.matches(TYPED)) return;
      if (field.hasAttribute("enterkeyhint")) return;
      field.setAttribute("enterkeyhint", keyFor(field));
    },
    { capture: true },
  );
}
