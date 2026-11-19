// The two panels a one-job page is drawn in: the manga art on one side, a
// card with a title on the other. Each stage of the reset password page and
// of an email's link (confirm, unsubscribe) is one of these.
import type { ReactNode } from "react";
import { authStyles as styles } from "../../styles/auth";
import AuthArt from "./AuthArt";

type Props = {
  // the lettering, and the line under it
  sfx: string;
  line: string;
  chapter?: string;
  title: string;
  children: ReactNode;
};

export default function Spread({ sfx, line, chapter, title, children }: Props) {
  return (
    <div className={styles.container}>
      <div className={`${styles.spread} fade-in`}>
        <AuthArt sfx={sfx} line={line} chapter={chapter} />
        <div className={styles.card}>
          <h1 className={styles.title}>{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
