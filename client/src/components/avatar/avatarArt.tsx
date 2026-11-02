// The cast of profile pictures: the kinds of people who read manga, and some of
// the things that keep them company. All original, drawn here so they use the
// same ink as Kenji. The .printed wrapper keeps their colours the same in dark mode.
import type { ReactNode } from "react";

const round = "[stroke-linecap:round] [stroke-linejoin:round]";
const INK = `fill-none stroke-line stroke-[3] ${round}`;
const FINE = `fill-none stroke-line stroke-2 ${round}`;
const SOLID = `fill-line stroke-line stroke-2 ${round}`;
const CARD = `fill-card stroke-line stroke-[3] ${round}`;
const RED = `fill-accent stroke-line stroke-[3] ${round}`;
const GOLD = `fill-star stroke-line stroke-[3] ${round}`;
const GREY = `fill-paper-2 stroke-line stroke-[3] ${round}`;
const MID = `fill-[color-mix(in_srgb,var(--accent)_45%,var(--card))] stroke-line stroke-[3] ${round}`;
const DEEP = `fill-[color-mix(in_srgb,var(--accent)_62%,var(--line))] stroke-line stroke-[3] ${round}`;
const BLUSH = "fill-accent opacity-45";

const Art = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 100 100" className="block size-full" aria-hidden>
    {children}
  </svg>
);

// the same two shoulders under most of the people
const Bust = ({ className = RED }: { className?: string }) => (
  <path className={className} d="M14 104c1-20 15-29 36-29s35 9 36 29Z" />
);
const Head = ({ className = CARD }: { className?: string }) => (
  <circle className={className} cx="50" cy="50" r="24" />
);
const DotEyes = ({ y = 52, dx = 9 }: { y?: number; dx?: number }) => (
  <>
    <circle className="fill-line" cx={50 - dx} cy={y} r="3" />
    <circle className="fill-line" cx={50 + dx} cy={y} r="3" />
  </>
);
// big shiny shojo eyes
const BigEyes = ({ y = 52, light = false }: { y?: number; light?: boolean }) => (
  <>
    <ellipse className="fill-line" cx="40" cy={y} rx="5" ry="6.5" />
    <ellipse className="fill-line" cx="60" cy={y} rx="5" ry="6.5" />
    <circle className={light ? "fill-paper" : "fill-card"} cx="42" cy={y - 2.5} r="2.1" />
    <circle className={light ? "fill-paper" : "fill-card"} cx="62" cy={y - 2.5} r="2.1" />
  </>
);
/* ---------- readers ---------- */

export const Mangaka = () => (
  <Art>
    <circle className={SOLID} cx="50" cy="19" r="10" />
    <path className={`fill-none stroke-accent stroke-[4] ${round}`} d="M36 11l27 17" />
    <Bust className={GREY} />
    <path className={INK} d="M38 76l12 11 12-11" />
    <Head />
    <path className={SOLID} d="M26 52c-3-17 9-28 24-28s27 11 24 28l-5-10-7 5-3-8-9 7-5-7-7 7-4-5-3 3Z" />
    <path className={FINE} d="M35 54l10 1M55 55l10-1" />
    <DotEyes y={57} />
    <path className={FINE} d="M36 62q4 2 8 0M56 62q4 2 8 0" />
    <path className={FINE} d="M46 67h8" />
    <path className="fill-line" d="M62 66c3-2 7 0 6 3s-5 3-7 1 0-3 1-4Z" />
  </Art>
);

export const Librarian = () => (
  <Art>
    <circle className={SOLID} cx="50" cy="20" r="9" />
    <Bust />
    <path className={CARD} d="M42 76l8 9 8-9" />
    <Head />
    <path className={SOLID} d="M26 50c-2-16 9-26 24-26s26 10 24 26c-5-7-13-13-24-13s-19 6-24 13Z" />
    <circle className={INK} cx="39" cy="54" r="7.5" />
    <circle className={INK} cx="61" cy="54" r="7.5" />
    <path className={INK} d="M46.5 54h7" />
    <DotEyes y={54} dx={11} />
    <path className={FINE} d="M44 65h9" />
    <path className={CARD} d="M66 104V68a4 4 0 0 1 8 0v36Z" />
  </Art>
);

export const PunkBob = () => (
  <Art>
    <path className={SOLID} d="M22 64C18 34 34 22 52 22s30 14 26 42l-9 4V48H31v20Z" />
    <Bust className={GREY} />
    <path className={INK} d="M36 79l-3 22M64 79l3 22" />
    <Head className={MID} />
    <path className={RED} d="M26 54c-3-18 10-31 27-31 4 8-2 18-10 23-5 3-11 3-17 8Z" />
    <path className={SOLID} d="M50 24c13-2 26 9 24 28-8-3-15-11-18-20-1-3-4-6-6-8Z" />
    <path className={INK} d="M35 50l9 3M56 53l9-3" />
    <DotEyes y={57} />
    <path className={INK} d="M44 66q8 2 12-3" />
    <circle className="fill-none stroke-star stroke-[3]" cx="26" cy="64" r="4" />
  </Art>
);

export const Grandma = () => (
  <Art>
    <circle className={GREY} cx="50" cy="18" r="10" />
    <path className={FINE} d="M44 14q6 6 11 2" />
    <Bust className={GOLD} />
    <path className={INK} d="M50 76v28" />
    <Head />
    <path className={GREY} d="M26 52c-3-17 9-28 24-28s27 11 24 28c-7-3-13-10-15-16-3 6-9 10-17 11-6 1-12 2-16 5Z" />
    <circle className={INK} cx="40" cy="55" r="6.5" />
    <circle className={INK} cx="60" cy="55" r="6.5" />
    <path className={FINE} d="M46.5 55h7" />
    <path className={FINE} d="M36 56q4-4 8 0M56 56q4-4 8 0" />
    <path className={INK} d="M43 65q7 6 14 0" />
    <circle className={BLUSH} cx="31" cy="63" r="3.5" />
    <circle className={BLUSH} cx="69" cy="63" r="3.5" />
  </Art>
);

export const TwinTails = () => (
  <Art>
    <path className={RED} d="M28 34C10 34 4 58 12 80c7-5 13-16 16-27Z" />
    <path className={RED} d="M72 34c18 0 24 24 16 46-7-5-13-16-16-27Z" />
    <Bust className={GREY} />
    <path className={RED} d="M44 77l6 7 6-7-6 15Z" />
    <Head />
    <path className={RED} d="M26 54c-4-19 9-31 24-31s28 12 24 31c-3-4-6-7-7-11l-5 5-3-8-6 7-5-8-6 8-3-7-4 7c-3 2-6 5-9 7Z" />
    <circle className={GOLD} cx="27" cy="35" r="4" />
    <circle className={GOLD} cx="73" cy="35" r="4" />
    <BigEyes y={55} />
    <path className="fill-accent stroke-line stroke-2" d="M45 65q5 8 10 0Z" />
    <path className="fill-star stroke-line stroke-1" d="M78 15l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" />
  </Art>
);

export const SilentRival = () => (
  <Art>
    <path className={SOLID} d="M24 100V46c0-16 11-25 26-25s26 9 26 25v54H62V60H38v40Z" />
    <Bust className={GREY} />
    <path className={SOLID} d="M24 100V62l14-2v40ZM76 100V62l-14-2v40Z" />
    <Head />
    <path className={SOLID} d="M26 50c-1-17 9-27 24-27s25 10 24 27H26Z" />
    <path className={INK} d="M34 57l10 1M56 58l10-1" />
    <path className="fill-line" d="M36 61h9v3h-9ZM55 61h9v3h-9Z" />
    <path className={FINE} d="M46 68h8" />
  </Art>
);

export const TrainingArc = () => (
  <Art>
    <path className={SOLID} d="M66 28c16-5 26 8 22 34-7-8-12-16-22-22Z" />
    <Bust />
    <path className={CARD} d="M40 76l10 8 10-8" />
    <Head className={MID} />
    <path className={SOLID} d="M26 44c1-14 11-22 24-22s23 8 24 22H26Z" />
    <path className={RED} d="M25 40h50v8H25Z" />
    <path className={RED} d="M25 42l-12-5 2 11ZM25 44l-10 6 9 4Z" />
    <path className={INK} d="M35 53l10 4M65 53l-10 4" />
    <DotEyes y={60} dx={8} />
    <path className={INK} d="M45 67h10" />
    <path className="fill-accent stroke-line stroke-2" d="M47 10c7 5 10 10 6 16 3-1 5-3 6-5 4 7-1 13-9 13s-13-6-9-13c1 2 2 3 4 3-2-5-1-9 2-14Z" transform="translate(30 -6) scale(.55)" />
  </Art>
);

export const BookstoreRegular = () => (
  <Art>
    <circle className={SOLID} cx="26" cy="30" r="14" />
    <circle className={SOLID} cx="74" cy="30" r="14" />
    <Bust className={GOLD} />
    <Head className={DEEP} />
    <path className={SOLID} d="M26 48c0-15 10-25 24-25s24 10 24 25c-6-8-14-11-24-11s-18 3-24 11Z" />
    <path className={`fill-none stroke-card stroke-[3] ${round}`} d="M37 56q4-5 8 0M55 56q4-5 8 0" />
    <path className="fill-card stroke-line stroke-2" d="M41 62q9 9 18 0Z" />
    <rect className={RED} x="31" y="82" width="38" height="24" rx="1" />
    <path className={INK} d="M50 82v24" />
  </Art>
);

export const ReadingNook = () => (
  <Art>
    <path className={RED} d="M14 104c0-24 6-40 13-54C28 28 38 18 50 18s22 10 23 32c7 14 13 30 13 54Z" />
    <path className={MID} d="M30 53c0-13 8-21 20-21s20 8 20 21-8 22-20 22-20-9-20-22Z" />
    <path className={INK} d="M38 52q4-4 8 0M54 52q4-4 8 0" />
    <path className={INK} d="M43 62q7 6 14 0" />
    <circle className={BLUSH} cx="36" cy="60" r="3" />
    <circle className={BLUSH} cx="64" cy="60" r="3" />
    <rect className={CARD} x="33" y="82" width="34" height="24" rx="1" />
    <path className={INK} d="M50 82v24" />
  </Art>
);

export const TooCool = () => (
  <Art>
    <path className={SOLID} d="M21 62c-4-8-1-13 2-17-2-7 3-13 8-15 3-7 11-10 18-8 7-3 15 0 19 6 7 2 11 9 9 16 4 5 5 11 1 18l-10 5-40 1Z" />
    <Bust className={GREY} />
    <path className={RED} d="M38 76h24v8H38Z" />
    <Head className={MID} />
    <path className={SOLID} d="M26 48c3-13 12-20 24-20s21 7 24 20c-12-8-36-8-48 0Z" />
    <path className="fill-line stroke-line stroke-2" d="M31 51h17l-2 11h-12ZM52 51h17l-3 11H54ZM47 53h6" />
    <path className={`fill-none stroke-card stroke-2 ${round}`} d="M35 54l4 5M56 54l4 5" />
    <path className={INK} d="M45 69q6 0 11-4" />
  </Art>
);

export const NotCrying = () => (
  <Art>
    <path className={SOLID} d="M24 92V48c0-17 11-27 26-27s26 10 26 27v44l-10 4V60H34v36Z" />
    <Bust className={GOLD} />
    <Head />
    <path className={SOLID} d="M26 53c-3-18 9-30 24-30s27 12 24 30c-4-3-7-8-9-13-6 6-13 8-21 7-4 1-7 3-9 6-2-3-4 0-9 0Z" />
    <path className={INK} d="M34 54q5 4 11 0M55 54q5 4 11 0" />
    <path className="fill-[color-mix(in_srgb,var(--card)_55%,var(--accent-wash))] stroke-line stroke-2" d="M35 57h9v18l-4 4-5-3ZM56 57h9v19l-5 3-4-4Z" />
    <path className={FINE} d="M46 66q4-4 8 0" />
    <path className={INK} d="M34 42l10 4M66 42l-10 4" />
  </Art>
);

export const OneMoreChapter = () => (
  <Art>
    <path className={SOLID} d="M20 60c0-24 14-39 30-39s30 15 30 39l-3 10-8-6-2-14H33l-2 14-8 6Z" />
    <Bust className={GREY} />
    <Head className={DEEP} />
    <path className={SOLID} d="M27 48c0-14 10-25 23-25s23 11 23 25c-8-1-14-5-18-11-5 6-14 10-28 11Z" />
    <path className={`fill-none stroke-card stroke-[3] ${round}`} d="M36 55h9M55 55h9" />
    <path className={`fill-none stroke-card stroke-2 ${round}`} d="M36 60q4 3 8 0M56 60q4 3 8 0" />
    <path className={`fill-none stroke-card stroke-2 ${round}`} d="M47 67h6" />
    <path className="fill-star stroke-line stroke-2" d="M80 20a10 10 0 1 1-11-9 8 8 0 0 0 11 9Z" />
    <rect className={GOLD} x="30" y="84" width="40" height="22" rx="1" />
  </Art>
);

export const EdgyArc = () => (
  <Art>
    <Bust className={GREY} />
    <path className={SOLID} d="M34 76h32l-4 13H38Z" />
    <Head />
    <path className={SOLID} d="M24 54C20 40 24 28 33 24l-5-14 15 9 7-14 7 14 14-9-3 15c8 5 12 15 8 29l-8-12-6 8-6-13-8 9-7-10-8 10-4-7Z" />
    <path className="fill-line" d="M34 52h16v13l-8 2-8-3Z" />
    <path className={INK} d="M26 47l48 8" />
    <path className={INK} d="M56 53l10 2" />
    <circle className="fill-accent stroke-line stroke-2" cx="60" cy="60" r="3.5" />
    <path className={INK} d="M50 69q5 1 9-3" />
  </Art>
);

export const OldMaster = () => (
  <Art>
    <Bust className={GREY} />
    <Head />
    <path className={CARD} d="M24 56c-2 18 12 40 26 44 14-4 28-26 26-44-7 5-16 4-26 4s-19 1-26-4Z" />
    <path className={FINE} d="M42 70q2 10 5 18M50 68v24M58 70q-2 10-5 18" />
    <path className={INK} d="M32 45l12 4M68 45l-12 4" />
    <path className={INK} d="M36 53q4 3 8 0M56 53q4 3 8 0" />
    <path className={CARD} d="M38 60q6-5 12 0 6-5 12 0-6 5-12 2-6 3-12-2Z" />
    <path className={FINE} d="M42 30q8-5 16 0" />
  </Art>
);

export const Strategist = () => (
  <Art>
    <Bust />
    <path className={CARD} d="M38 75l12 12 12-12" />
    <Head />
    <path className={SOLID} d="M26 48c-1-17 9-27 24-27s25 10 24 27l-6-10-9 4-10-5-8 6-7-4Z" />
    <rect className="fill-card stroke-line stroke-[3]" x="30" y="50" width="17" height="12" rx="1" />
    <rect className="fill-card stroke-line stroke-[3]" x="53" y="50" width="17" height="12" rx="1" />
    <path className={INK} d="M47 54h6" />
    <path className={FINE} d="M34 60l7-8M38 60l7-8M57 60l7-8M61 60l7-8" />
    <path className={INK} d="M44 69q7 2 13-3" />
  </Art>
);

export const ThreeAM = () => (
  <Art>
    <Bust className={GREY} />
    <Head />
    <path className={RED} d="M25 49c0-18 11-28 25-28s25 10 25 28Z" />
    <path className={INK} d="M23 49h54" />
    <path className={FINE} d="M34 28v20M43 24v24M52 23v25M61 25v23M68 31v17" />
    <circle className={INK} cx="40" cy="57" r="4.5" />
    <circle className={INK} cx="60" cy="57" r="4.5" />
    <circle className="fill-line" cx="41" cy="57" r="1.6" />
    <circle className="fill-line" cx="59" cy="58" r="1.6" />
    <path className={FINE} d="M34 64q6 3 11 0M55 64q6 3 11 0" />
    <path className={FINE} d="M46 70q4-3 8 0" />
    <path className="fill-star stroke-line stroke-[1.5]" d="M15 14l1.7 5 5 1.7-5 1.7-1.7 5-1.7-5-5-1.7 5-1.7ZM84 28l1.3 4 4 1.3-4 1.3-1.3 4-1.3-4-4-1.3 4-1.3Z" />
  </Art>
);

/* ---------- creatures ---------- */

export const ShelfCat = () => (
  <Art>
    <path className={GOLD} d="M24 40L20 14l18 12c8-3 16-3 24 0l18-12-4 26c4 6 6 13 4 21-3 13-15 21-30 21s-27-8-30-21c-2-8 0-15 4-21Z" />
    <path className={INK} d="M50 28v9M42 29l2 7M58 29l-2 7" />
    <ellipse className="fill-line" cx="38" cy="52" rx="4" ry="6" />
    <ellipse className="fill-line" cx="62" cy="52" rx="4" ry="6" />
    <path className="fill-accent stroke-line stroke-2" d="M47 60h6l-3 4Z" />
    <path className={FINE} d="M50 64q-4 5-8 2M50 64q4 5 8 2M22 56l11 2M20 64l12-1M78 56l-11 2M80 64l-12-1" />
    <rect className={RED} x="12" y="82" width="76" height="11" rx="1" />
    <path className={FINE} d="M20 87h60" />
  </Art>
);

export const Tanuki = () => (
  <Art>
    <circle className={GREY} cx="27" cy="27" r="9" />
    <circle className={GREY} cx="73" cy="27" r="9" />
    <circle className={GOLD} cx="50" cy="52" r="33" />
    <path className="fill-line" d="M23 52c0-8 16-12 21-4 2 5-2 13-9 14-7 0-12-3-12-10ZM77 52c0-8-16-12-21-4-2 5 2 13 9 14 7 0 12-3 12-10Z" />
    <circle className="fill-card" cx="37" cy="52" r="3.5" />
    <circle className="fill-card" cx="63" cy="52" r="3.5" />
    <path className={CARD} d="M38 74c0-9 5-13 12-13s12 4 12 13-24 9-24 0Z" />
    <ellipse className="fill-line" cx="50" cy="65" rx="4" ry="3" />
    <path className={FINE} d="M50 68v3M45 72q5 3 10 0" />
    <path className={RED} d="M50 22c-9-3-13-10-11-17 9-1 15 6 11 17Zm0 0c9-3 13-10 11-17-9-1-15 6-11 17Z" />
  </Art>
);

export const BacklogGhost = () => (
  <Art>
    <path className={`fill-card stroke-line stroke-[3] ${round}`} d="M22 90V46a28 28 0 0 1 56 0v44l-9-7-10 8-9-8-9 8-10-8Z" />
    <ellipse className="fill-line" cx="40" cy="44" rx="4.5" ry="7" />
    <ellipse className="fill-line" cx="60" cy="44" rx="4.5" ry="7" />
    <path className="fill-line" d="M45 56q5 7 10 0Z" />
    <rect className={RED} x="31" y="62" width="38" height="16" rx="1" />
    <path className={FINE} d="M50 62v16" />
    <path className={BLUSH} d="M30 53a3 3 0 1 0 0 .1ZM76 53a3 3 0 1 0 0 .1Z" />
  </Art>
);

export const Kappa = () => (
  <Art>
    <path className={SOLID} d="M18 42c0-15 14-26 32-26s32 11 32 26l-8-5-7 7-7-8-10 8-10-8-7 8-7-7Z" />
    <path className={`fill-stamp-new stroke-line stroke-[3] ${round}`} d="M23 42c0 24 10 38 27 38s27-14 27-38c-16-6-38-6-54 0Z" />
    <path className={SOLID} d="M21 43l8 8 7-9 7 7 7-8 7 8 7-7 7 9 8-8c-8-12-50-12-58 0Z" />
    <ellipse className="fill-card stroke-line stroke-[3]" cx="50" cy="19" rx="19" ry="7" />
    <circle className="fill-card stroke-line stroke-2" cx="39" cy="57" r="5" />
    <circle className="fill-card stroke-line stroke-2" cx="61" cy="57" r="5" />
    <DotEyes y={57} dx={11} />
    <path className={GOLD} d="M38 66q12-7 24 0-12 11-24 0Z" />
    <path className={FINE} d="M38 66q12 3 24 0" />
  </Art>
);

export const LittleOni = () => (
  <Art>
    <path className={GOLD} d="M32 28L28 6l15 15ZM68 28l4-22-15 15Z" />
    <circle className={RED} cx="50" cy="54" r="31" />
    <path className={SOLID} d="M24 40c4-15 15-21 26-21s22 6 26 21l-8-6-5 6-5-7-8 7-8-7-5 7Z" />
    <path className={INK} d="M32 47l14 5M68 47l-14 5" />
    <circle className={CARD} cx="39" cy="57" r="5" />
    <circle className={CARD} cx="61" cy="57" r="5" />
    <circle className="fill-line" cx="40" cy="57" r="2" />
    <circle className="fill-line" cx="60" cy="57" r="2" />
    <path className="fill-line stroke-line stroke-2" d="M36 69q14 8 28 0-14 13-28 0Z" />
    <path className="fill-card stroke-line stroke-[1.5]" d="M41 71l3 7 3-5ZM59 71l-3 7-3-5Z" />
  </Art>
);

export const Kitsune = () => (
  <Art>
    <path className={RED} d="M24 45L13 11l24 14a30 30 0 0 1 26 0l24-14-11 34c5 14-1 28-26 44-25-16-31-30-26-44Z" />
    <path className={CARD} d="M24 50c7 2 16 7 26 39 10-32 19-37 26-39-3 19-13 33-26 39-13-6-23-20-26-39Z" />
    <path className={INK} d="M32 50q6-4 12 2M68 50q-6-4-12 2" />
    <ellipse className="fill-line" cx="50" cy="84" rx="4" ry="3" />
    <path className={FINE} d="M33 25l-7-6M67 25l7-6" />
  </Art>
);

export const Daruma = () => (
  <Art>
    <path className={RED} d="M50 9c24 0 36 19 36 44 0 26-15 38-36 38S14 79 14 53C14 28 26 9 50 9Z" />
    <path className={CARD} d="M28 39c0-8 11-11 22-11s22 3 22 11c0 15-9 24-22 24S28 54 28 39Z" />
    <circle className={CARD} cx="40" cy="42" r="7.5" />
    <circle className={CARD} cx="60" cy="42" r="7.5" />
    <circle className="fill-line" cx="40" cy="42" r="3.5" />
    <path className={INK} d="M32 33l9-3M68 33l-9-3" />
    <path className={INK} d="M43 55q7-4 14 0" />
    <path className={`fill-none stroke-star stroke-[3] ${round}`} d="M38 74l6 4 6-6 6 6 6-4" />
  </Art>
);

/* ---------- things ---------- */

export const RamenBowl = () => (
  <Art>
    <path className={FINE} d="M36 28q-6-6 0-11t0-11M50 26q-6-6 0-11t0-11M64 28q-6-6 0-11t0-11" />
    <path className={`fill-none stroke-line stroke-[4] ${round}`} d="M58 40L90 8M66 42L96 18" />
    <ellipse className={GOLD} cx="50" cy="41" rx="38" ry="10" />
    <path className={FINE} d="M24 41q6-5 11 0t11 0 11 0 11 0" />
    <circle className={CARD} cx="72" cy="39" r="5" />
    <path className={RED} d="M12 43c2 26 16 42 38 42s36-16 38-42c-10 7-66 7-76 0Z" />
    <circle className="fill-line" cx="40" cy="62" r="3" />
    <circle className="fill-line" cx="60" cy="62" r="3" />
    <path className={FINE} d="M44 69q6 5 12 0" />
    <circle className="fill-card opacity-45" cx="32" cy="68" r="3" />
    <circle className="fill-card opacity-45" cx="68" cy="68" r="3" />
    <rect className={CARD} x="36" y="85" width="28" height="6" />
  </Art>
);

export const Dango = () => (
  <Art>
    <path className={`fill-none stroke-line stroke-[4] ${round}`} d="M78 93L27 8" />
    <circle className={RED} cx="36" cy="26" r="15" />
    <circle className={CARD} cx="50" cy="49" r="15" />
    <circle className={GOLD} cx="64" cy="72" r="15" />
    <path className={FINE} d="M29 24v1M42 22v1M32 31q4 3 7 0" />
    <path className={FINE} d="M44 47q2-2 4 0M53 45q2-2 4 0M46 54q4 3 8-1" />
    <path className="fill-line" d="M57 69h3v3h-3ZM68 67h3v3h-3Z" />
    <path className={FINE} d="M60 78q5-4 9 0" />
  </Art>
);

export const TeaBreak = () => (
  <Art>
    <path className={FINE} d="M38 26q-5-6 0-11t0-11M50 26q-5-6 0-11t0-11M62 26q-5-6 0-11t0-11" />
    <path className={CARD} d="M18 33h64l-5 42c-1 7-6 11-12 11H35c-6 0-11-4-12-11Z" />
    <ellipse className={GOLD} cx="50" cy="33" rx="32" ry="6" />
    <path className={INK} d="M36 53q4-4 8 0M56 53q4-4 8 0" />
    <path className={FINE} d="M44 62q6 5 12 0" />
    <circle className={BLUSH} cx="33" cy="60" r="3.5" />
    <circle className={BLUSH} cx="67" cy="60" r="3.5" />
    <path className={RED} d="M16 86h68v5H16Z" />
  </Art>
);

export const SpeechBubble = () => (
  <Art>
    <path className={CARD} d="M50 12c24 0 40 13 40 30S74 72 52 72c-4 0-8 0-11-1L23 88l4-23C16 60 10 52 10 42c0-17 16-30 40-30Z" />
    <circle className="fill-line" cx="33" cy="43" r="5" />
    <circle className="fill-line" cx="50" cy="43" r="5" />
    <circle className="fill-line" cx="67" cy="43" r="5" />
  </Art>
);

export const BigShock = () => (
  <Art>
    <path className={GOLD} d="M50 5l9 19 16-13-1 21 20-3-12 17 16 10-20 6 8 20-19-7-4 20-13-15-13 15-4-20-19 7 8-20-20-6 16-10L6 29l20 3-1-21 16 13Z" />
    <path className="fill-accent stroke-line stroke-[2.5]" d="M35 28h14l-3 30h-8ZM57 28h14l-6 30h-8Z" />
    <circle className={RED} cx="41" cy="67" r="5.5" />
    <circle className={RED} cx="58" cy="67" r="5.5" />
  </Art>
);

export const LiveBookmark = () => (
  <Art>
    <path className={RED} d="M28 8h44v84L50 74 28 92Z" />
    <path className={INK} d="M36 16h28" />
    <circle className="fill-line" cx="41" cy="38" r="3.5" />
    <circle className="fill-line" cx="59" cy="38" r="3.5" />
    <circle className="fill-card" cx="42" cy="37" r="1.2" />
    <circle className="fill-card" cx="60" cy="37" r="1.2" />
    <path className="fill-card stroke-line stroke-2" d="M43 46q7 9 14 0Z" />
    <path className="fill-star stroke-line stroke-[1.5]" d="M82 26l1.7 5 5 1.7-5 1.7-1.7 5-1.7-5-5-1.7 5-1.7Z" />
  </Art>
);

export const PenNib = () => (
  <Art>
    <path className={GREY} d="M34 8h32v22l10 20-26 42-26-42 10-20Z" />
    <path className={INK} d="M34 30h32M50 74v18" />
    <circle className="fill-line" cx="50" cy="71" r="4" />
    <circle className="fill-line" cx="41" cy="46" r="3" />
    <circle className="fill-line" cx="59" cy="46" r="3" />
    <path className={FINE} d="M44 54q6 4 12 0" />
    <path className="fill-line" d="M26 93c-6 0-9-3-8-6s6-3 9-1 2 7-1 7ZM78 88c-3 0-5-2-4-4s4-2 5-1 2 5-1 5Z" />
  </Art>
);
