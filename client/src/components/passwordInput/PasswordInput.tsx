import { useState, type ComponentProps } from "react";
import { authStyles as styles } from "../../styles/auth";
import { EyeIcon, EyeOffIcon } from "../icons/Icons";

// a password field with a show / hide toggle. React 19 passes `ref` as a
// normal prop, so it rides along with the rest
export default function PasswordInput({
  ref,
  ...props
}: ComponentProps<"input">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.inputWrap}>
      <input
        {...props}
        ref={ref}
        className={styles.input}
        type={visible ? "text" : "password"}
      />
      <button
        type="button"
        className={styles.reveal}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
