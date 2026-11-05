// One volume on the bookcase (VolumePicker.tsx): standing and inked when it's
// theirs. Pointers are handled by the shelf around it, which can tell a tap
// from a drag; the spine itself only answers Enter and Space
import { volumePickerStyles as styles } from "./styles";

export default function Spine({
  volume,
  yours,
  onKeyboard,
}: {
  volume: number;
  yours: boolean;
  onKeyboard: (volume: number, yours: boolean) => void;
}) {
  return (
    <button
      type="button"
      data-vol={volume}
      className={styles.slot}
      aria-pressed={yours}
      aria-label={`Vol. ${volume}`}
      // pointers are the shelf's; this is Enter and Space
      onClick={(e) => {
        if (e.detail === 0) onKeyboard(volume, yours);
      }}
    >
      <span className={yours ? styles.spineUp : styles.spineDown}>
        <span className={volume >= 100 ? styles.numberSmall : styles.number}>
          {volume}
        </span>
      </span>
    </button>
  );
}
