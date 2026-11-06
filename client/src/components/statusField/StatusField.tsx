// Where they are with a series, on the add and edit forms: still reading it,
// finished, or on their To read list. One field for both, so the two forms
// offer the same three
import { Fragment } from "react";
import { formStyles as styles } from "../../styles/form";

export type Stage = "reading" | "finished" | "planned";

const STAGES: [Stage, string][] = [
  ["reading", "Still reading"],
  ["finished", "Finished it"],
  ["planned", "Want to read"],
];

export default function StatusField({
  stage,
  onChange,
  required = false,
}: {
  stage: Stage;
  onChange: (stage: Stage) => void;
  required?: boolean;
}) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel} id="status-label">
        Status {required && <b>*</b>}
      </span>
      <div
        className={styles.segmented}
        role="radiogroup"
        aria-labelledby="status-label"
      >
        {STAGES.map(([value, label]) => (
          <Fragment key={value}>
            <input
              type="radio"
              id={`status-${value}`}
              name="status"
              checked={stage === value}
              onChange={() => onChange(value)}
            />
            <label htmlFor={`status-${value}`} className={styles.segmentLabel}>
              {label}
            </label>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
