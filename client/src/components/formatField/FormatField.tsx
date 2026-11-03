// Manga or light novel, on the add and edit forms. Picking a title from
// AniList's suggestions sets it; they can always change it
import { formStyles as styles } from "../../styles/form";

export default function FormatField({
  lightNovel,
  onChange,
}: {
  lightNovel: boolean;
  onChange: (lightNovel: boolean) => void;
}) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel} id="format-label">
        Type
      </span>
      <div
        className={styles.segmented}
        role="radiogroup"
        aria-labelledby="format-label"
      >
        <input
          type="radio"
          id="format-manga"
          name="format"
          checked={!lightNovel}
          onChange={() => onChange(false)}
        />
        <label htmlFor="format-manga" className={styles.segmentLabel}>
          Manga
        </label>
        <input
          type="radio"
          id="format-novel"
          name="format"
          checked={lightNovel}
          onChange={() => onChange(true)}
        />
        <label htmlFor="format-novel" className={styles.segmentLabel}>
          Light novel
        </label>
      </div>
    </div>
  );
}
