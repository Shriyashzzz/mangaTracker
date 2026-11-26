// "Continue with Apple" (lib/appleSignIn.ts), beside Google's button and
// the same size: Apple's rules ask for its logo and words in black on white
// with an outline, or white on black. White with an outline on the light
// paper, as Google's is; black on the dark, as Google's is there
import { useSyncExternalStore } from "react";
import { continueWithApple } from "../../lib/appleSignIn";
import { currentTheme, onThemeChange } from "../../lib/prefs";

export default function AppleButton({ next }: { next: string }) {
  const dark = useSyncExternalStore(onThemeChange, currentTheme) === "dark";
  return (
    <div className="flex w-full justify-center">
      <button
        type="button"
        onClick={() => continueWithApple(next)}
        className={`tap flex h-10 w-full max-w-[300px] cursor-pointer items-center justify-center gap-2 rounded-[4px] border font-[system-ui,-apple-system,sans-serif] text-[14px] font-medium ${dark ? "border-[#8e918f] bg-black text-white" : "border-[#747775] bg-white text-black"}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 814 1000"
          className="h-[17px] w-[14px] fill-current"
        >
          <path d="M788 341c-6 4-108 62-108 190 0 149 131 201 135 202-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-165-40c-77 0-104 41-166 41s-106-57-156-127C45 791 0 666 0 548 0 358 124 257 246 257c65 0 119 43 160 43 39 0 100-45 174-45 28 0 129 2 208 86zM559 163c31-36 52-87 52-138 0-7-1-14-2-20-50 2-110 33-146 75-28 32-55 83-55 135 0 8 1 15 2 18 3 1 9 1 14 1 45 0 102-30 135-71z" />
        </svg>
        Continue with Apple
      </button>
    </div>
  );
}
