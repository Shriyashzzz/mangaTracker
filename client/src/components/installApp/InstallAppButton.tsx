// "Install the app": opens the browser's own install box, or on an iPhone
// the steps to put it on the home screen. Nothing at all where the site
// can't be installed, or already is. The account menu has its own row for
// it (it closes as it's tapped, so the sheet can't live inside it).
import { useState, type ReactNode } from "react";
import { openInstallBox, useInstallWay } from "../../lib/install";
import InstallSheet from "./InstallSheet";

type Props = { className: string; children: ReactNode };

export default function InstallAppButton({ className, children }: Props) {
  const way = useInstallWay();
  const [showSteps, setShowSteps] = useState(false);
  if (!way) return null;
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() =>
          way === "prompt" ? void openInstallBox() : setShowSteps(true)
        }
      >
        {children}
      </button>
      {showSteps && <InstallSheet onClose={() => setShowSteps(false)} />}
    </>
  );
}
