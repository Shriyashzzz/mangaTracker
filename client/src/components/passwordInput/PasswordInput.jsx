import { forwardRef, useState } from "react";
import styles from "../../styles/Auth.module.css";
import { EyeIcon, EyeOffIcon } from "../icons/Icons";

const PasswordInput = forwardRef(function PasswordInput(props, ref) {
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
});

export default PasswordInput;
