// The profile pictures: a few original drawings to choose from, in the same ink
// as Kenji. Static, so nobody's stuck with something moving on their profile.
import type { ReactNode } from "react";
import { DEFAULT_AVATAR } from "../../lib/avatars";
import Mascot from "../mascot/Mascot";
import * as Art from "./avatarArt";

const INK =
  "fill-none stroke-line stroke-[3.5] [stroke-linecap:round] [stroke-linejoin:round]";
const PAPER = "fill-card stroke-line stroke-[3.5] [stroke-linejoin:round]";
const RED = "fill-accent stroke-line stroke-[3.5] [stroke-linejoin:round]";

// a pile of volumes they will definitely read one day
const Tower = () => (
  <svg viewBox="0 0 100 100" className="block size-full" aria-hidden>
    <rect
      className={PAPER}
      x="24"
      y="72"
      width="54"
      height="14"
      rx="1"
      transform="rotate(-3 50 79)"
    />
    <rect
      className={RED}
      x="20"
      y="58"
      width="56"
      height="14"
      rx="1"
      transform="rotate(2 50 65)"
    />
    <rect
      className={PAPER}
      x="27"
      y="44"
      width="48"
      height="14"
      rx="1"
      transform="rotate(-5 50 51)"
    />
    <rect
      className={RED}
      x="23"
      y="16"
      width="50"
      height="28"
      rx="1"
      transform="rotate(3 50 30)"
    />
    <circle className="fill-line" cx="41" cy="28" r="3" />
    <circle className="fill-line" cx="58" cy="29" r="3" />
    <path className={INK} d="M44 37q5-4 11 0" />
    <path
      className="fill-paper stroke-line stroke-2"
      d="M76 12c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11Z"
    />
  </svg>
);

// someone knocked the ink over, and it has opinions
const InkBlot = () => (
  <svg viewBox="0 0 100 100" className="block size-full" aria-hidden>
    <path
      className="fill-line stroke-line stroke-2"
      d="M50 13c10-2 13 7 21 8 9 2 15 9 12 18-2 7 5 12 3 21-2 8-11 9-15 15-3 5 0 12-7 13s-7-8-14-8c-8 0-14 6-21 1-6-4-1-11-5-17-4-7-12-10-10-19 1-8 10-9 13-16 3-8 12-15 23-16Z"
    />
    <circle className="fill-card" cx="39" cy="44" r="9" />
    <circle className="fill-card" cx="63" cy="44" r="9" />
    <circle className="fill-line" cx="41" cy="46" r="4" />
    <circle className="fill-line" cx="61" cy="46" r="4" />
    <path
      className="fill-none stroke-card stroke-[3.5] [stroke-linecap:round]"
      d="M42 65q9 7 18 0"
    />
  </svg>
);

// reading through lunch
const Onigiri = () => (
  <svg viewBox="0 0 100 100" className="block size-full" aria-hidden>
    <path
      className={PAPER}
      d="M50 13c6 0 10 4 14 11l20 36c5 10 0 22-12 22H28c-12 0-17-12-12-22l20-36c4-7 8-11 14-11Z"
    />
    <path className="fill-line" d="M34 62h32v20H34z" />
    <circle className="fill-line" cx="39" cy="44" r="3.5" />
    <circle className="fill-line" cx="61" cy="44" r="3.5" />
    <path className={INK} d="M45 50q5 5 10 0" />
    <circle className="fill-accent opacity-60" cx="31" cy="51" r="4.5" />
    <circle className="fill-accent opacity-60" cx="69" cy="51" r="4.5" />
  </svg>
);

const crop = (mood: "happy" | "panic" | "confused"): ReactNode => (
  <span className="block w-[86%]">
    <Mascot mood={mood} />
  </span>
);

// the panel behind each one: inked screentone, focus lines, or a flat colour
const TONE =
  "bg-paper-2 bg-[radial-gradient(var(--dots-strong)_1.1px,transparent_1.4px)] bg-size-[6px_6px]";
const LINES =
  "bg-paper bg-[radial-gradient(circle_at_50%_50%,var(--paper)_0_34%,transparent_70%),repeating-conic-gradient(from_0deg_at_50%_50%,var(--line)_0deg_0.7deg,transparent_0.7deg_7deg)]";
const PLAIN = "bg-paper-2";
const WASH = "bg-[color-mix(in_srgb,var(--accent)_22%,var(--card))]";
const SUN = "bg-[color-mix(in_srgb,var(--star)_35%,var(--card))]";
const NIGHT = "bg-line";

const ART: Record<string, { art: ReactNode; panel: string }> = {
  kenji: { art: crop("happy"), panel: PLAIN },
  panic: { art: crop("panic"), panel: LINES },
  lost: { art: crop("confused"), panel: TONE },
  tower: { art: <Tower />, panel: SUN },
  ink: { art: <InkBlot />, panel: WASH },
  onigiri: { art: <Onigiri />, panel: TONE },
  mangaka: { art: <Art.Mangaka />, panel: LINES },
  librarian: { art: <Art.Librarian />, panel: SUN },
  punk: { art: <Art.PunkBob />, panel: TONE },
  grandma: { art: <Art.Grandma />, panel: WASH },
  twintails: { art: <Art.TwinTails />, panel: SUN },
  rival: { art: <Art.SilentRival />, panel: TONE },
  training: { art: <Art.TrainingArc />, panel: LINES },
  regular: { art: <Art.BookstoreRegular />, panel: WASH },
  nook: { art: <Art.ReadingNook />, panel: SUN },
  cool: { art: <Art.TooCool />, panel: TONE },
  crying: { art: <Art.NotCrying />, panel: LINES },
  onemore: { art: <Art.OneMoreChapter />, panel: NIGHT },
  edgy: { art: <Art.EdgyArc />, panel: WASH },
  master: { art: <Art.OldMaster />, panel: TONE },
  strategist: { art: <Art.Strategist />, panel: LINES },
  threeam: { art: <Art.ThreeAM />, panel: NIGHT },
  cat: { art: <Art.ShelfCat />, panel: WASH },
  tanuki: { art: <Art.Tanuki />, panel: TONE },
  ghost: { art: <Art.BacklogGhost />, panel: NIGHT },
  kappa: { art: <Art.Kappa />, panel: SUN },
  oni: { art: <Art.LittleOni />, panel: TONE },
  kitsune: { art: <Art.Kitsune />, panel: SUN },
  daruma: { art: <Art.Daruma />, panel: PLAIN },
  ramen: { art: <Art.RamenBowl />, panel: LINES },
  dango: { art: <Art.Dango />, panel: PLAIN },
  tea: { art: <Art.TeaBreak />, panel: TONE },
  bubble: { art: <Art.SpeechBubble />, panel: WASH },
  shock: { art: <Art.BigShock />, panel: LINES },
  bookmark: { art: <Art.LiveBookmark />, panel: SUN },
  nib: { art: <Art.PenNib />, panel: TONE },
};

// always shows something: anything unknown gets the default
export default function Avatar({
  id,
  className = "",
}: {
  id?: string | null;
  className?: string;
}) {
  const { art, panel } = ART[id ?? DEFAULT_AVATAR] ?? ART[DEFAULT_AVATAR]!;
  return (
    <span
      className={`printed grid aspect-square place-items-center overflow-hidden rounded-full border-[2.5px] border-line ${panel} ${className}`}
      aria-hidden
    >
      {art}
    </span>
  );
}
