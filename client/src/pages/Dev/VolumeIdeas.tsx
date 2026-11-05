// A practice page, only in development (/dev/volume-ideas): eight ways the add
// and edit forms could ask which volumes someone owns, side by side, each one
// working, so the user can try them before one is picked. Not shipped.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CloseIcon } from "../../components/icons/Icons";
import { parseVolumes, rangesText } from "../../lib/ownedVolumes";
import { formStyles as f } from "../../styles/form";
import { useVolumePicker } from "../../components/volumePicker/VolumePicker";
// the first picker's tickets, kept here for comparing
const vp = {
  tickets:
    "grid max-h-[9.5rem] grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5 overflow-y-auto p-0.5",
  ticket:
    "tap flex h-10 items-center justify-center rounded-[2px] border-[1.5px] border-dashed border-line-soft font-mono text-[0.9rem] text-muted tabular-nums transition-[color,border-color,background-color] duration-120 ease-[ease] hover:border-line hover:text-ink aria-pressed:border-solid aria-pressed:border-line aria-pressed:bg-ink aria-pressed:text-paper",
  more: "tap col-span-2 flex h-10 items-center justify-center text-[0.84rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink",
  picked:
    "flex h-11 w-full items-center overflow-hidden rounded-[2px] border-[1.5px] border-line bg-paper px-[0.85rem] font-mono text-[0.92rem] text-ink text-ellipsis whitespace-nowrap",
};

const start = [1, 4];
const toggle = (list: number[], v: number) =>
  list.includes(v)
    ? list.filter((x) => x !== v)
    : [...list, v].sort((a, b) => a - b);
const upToList = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const said = (list: number[]) =>
  list.length ? `${list.length} owned · ${rangesText(list)}` : "None yet";

// ---------- the page ----------

export default function VolumeIdeas() {
  return (
    <div className="mx-auto max-w-[1180px] pb-24">
      <h1 className="font-brand text-[clamp(1.9rem,3.4vw,2.6rem)] leading-none tracking-[0.02em] uppercase">
        Volume picker ideas
      </h1>
      <p className="mt-2 max-w-[60ch] text-ink-soft">
        Eight ways the add form could ask which volumes you own. Each one works:
        tap, type, switch. They all start from owning vols. 1 and 4. Only on
        your machine, while developing.
      </p>
      <Chosen />
      <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(min(100%,540px),1fr))] gap-8">
        <Idea
          n={1}
          name="Its own row, two modes"
          pitch="Chapter and genre share a row; volumes get the full width with a switch between “Up to” and “Exact”. Tickets appear right there."
          good="Clear, nothing floats, rows line up."
          bad="The form grows a little when picking."
        >
          <OwnRow />
        </Idea>
        <Idea
          n={2}
          name="Drop-down card"
          pitch="The three small fields stay side by side. The volumes field is a button; it drops a card, like the account menu."
          good="Form never grows; feels like the rest of the app."
          bad="A small card for 110 volumes; it closes if you click away."
        >
          <DropCard />
        </Idea>
        <Idea
          n={3}
          name="Sheet"
          pitch="A plain field with “Exact volumes…”. Opens a focused box (a sheet from the bottom on phones) with big tickets and Done."
          good="Roomy on phones, nothing else to look at."
          bad="One more step, and a box over the form."
        >
          <Sheet />
        </Idea>
        <Idea
          n={4}
          name="Shelf of spines"
          pitch="Volumes as book spines on a shelf. Tap a spine to stand it up: yours stand inked, the rest lean pale."
          good="The most manga-shelf feel; one look shows the gaps."
          bad="Takes room; numbers are small on long runs."
        >
          <Spines />
        </Idea>
        <Idea
          n={5}
          name="Range chips"
          pitch="Most people own runs: “From 1 to 14”, then “+ another range” for 16, or 20–22. Each range is a chip with ×."
          good="Fast for runs with a gap or two; no grid."
          bad="Fiddly for scattered single volumes."
        >
          <RangeChips />
        </Idea>
        <Idea
          n={6}
          name="Type first"
          pitch="One smart box: type “1-3, 7” and it turns into chips as you go. “Or tap them” opens tickets underneath."
          good="Quickest with a keyboard; tiny on the page."
          bad="Typing ranges isn't obvious to everyone."
        >
          <TypeFirst />
        </Idea>
        <Idea
          n={7}
          name="Up to, then punch out gaps"
          pitch="Say “up to vol. 14” as now, then “Missing a few?” fills 1–14 in and you tap the ones you don't have."
          good="Matches how people think: a run, minus a couple."
          bad="Odd for someone who owns 1 and 40 only."
        >
          <PunchOut />
        </Idea>
        <Idea
          n={8}
          name="Rows of ten"
          pitch="A grid laid out like seats: 1–10, 11–20… each row labelled, “whole row” to fill ten at once."
          good="Easy to find vol. 37; whole rows in one tap."
          bad="Big for long series; plain-looking."
        >
          <RowsOfTen />
        </Idea>
      </div>
    </div>
  );
}

// the real one, as the add and edit forms have it
function Chosen() {
  const { field } = useVolumePicker({ volumesOwned: 4, ownedList: [1, 4] });
  return (
    <section
      aria-label="The one in the forms"
      className="mt-8 flex max-w-[640px] flex-col gap-4 border-[1.5px] border-line bg-card p-5 shadow-[6px_6px_0_var(--hard-shadow)]"
    >
      <h2 className="font-brand text-[1.45rem] leading-none tracking-[0.02em] uppercase">
        The one in the forms
      </h2>
      {field}
    </section>
  );
}

function Idea({
  n,
  name,
  pitch,
  good,
  bad,
  children,
}: {
  n: number;
  name: string;
  pitch: string;
  good: string;
  bad: string;
  children: ReactNode;
}) {
  return (
    <section
      className="flex flex-col gap-4 border-[1.5px] border-line bg-card p-5 shadow-[6px_6px_0_var(--hard-shadow)]"
      aria-labelledby={`idea-${n}`}
    >
      <div>
        <h2
          id={`idea-${n}`}
          className="flex items-baseline gap-3 font-brand text-[1.45rem] leading-none tracking-[0.02em] uppercase"
        >
          <span className="bg-ink px-1.5 pt-0.5 text-paper">{n}</span>
          {name}
        </h2>
        <p className="mt-2 text-[0.92rem] text-ink-soft">{pitch}</p>
        <p className="mt-1.5 text-[0.84rem]">
          <span className="font-semibold">Good:</span> {good}{" "}
          <span className="font-semibold">Less good:</span> {bad}
        </p>
      </div>
      <div className="border-t border-dashed border-line-soft pt-4">
        {children}
      </div>
    </section>
  );
}

// the chapter and genre fields each mock-up sits beside
const Chapter = () => (
  <div className={f.field}>
    <label className={f.label}>
      Current chapter <b>*</b>
    </label>
    <input className={f.input} defaultValue="40" inputMode="numeric" />
  </div>
);
const Genre = () => (
  <div className={f.field}>
    <label className={f.label}>
      Genre <span className={f.optional}>(from AniList)</span>
    </label>
    <select className={f.select} defaultValue="Adventure">
      <option>Adventure</option>
    </select>
  </div>
);
const Label = ({ children }: { children: ReactNode }) => (
  <span className={f.label}>
    {children} <span className={f.optional}>(optional)</span>
  </span>
);
const Ticket = ({
  v,
  on,
  onClick,
  className = vp.ticket,
}: {
  v: number;
  on: boolean;
  onClick: () => void;
  className?: string;
}) => (
  <button
    type="button"
    className={className}
    aria-pressed={on}
    aria-label={`Vol. ${v}`}
    onClick={onClick}
  >
    {v}
  </button>
);
// a small number box: the form's look, at its own width
const small =
  "h-10 w-16 rounded-[2px] border-[1.5px] border-line bg-paper px-2 text-center font-mono transition-[box-shadow,background-color] duration-120 placeholder:text-muted focus:bg-card focus:shadow-[3px_3px_0_var(--accent)] focus:outline-none";
const link =
  "tap text-[0.84rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current";
const Summary = ({ list }: { list: number[] }) => (
  <p className="font-mono text-[0.84rem] text-ink-soft">{said(list)}</p>
);

// ---------- 1. its own row ----------

function OwnRow() {
  const [mode, setMode] = useState<"upto" | "exact">("exact");
  const [list, setList] = useState(start);
  const [upTo, setUpTo] = useState("14");
  const [shown, setShown] = useState(12);
  return (
    <div className="flex flex-col gap-4">
      <div className={f.row}>
        <Chapter />
        <Genre />
      </div>
      <div className={f.field}>
        <Label>Volumes you own</Label>
        <div
          className={f.segmented}
          role="radiogroup"
          aria-label="How to say it"
        >
          <input
            type="radio"
            id="own-upto-1"
            name="own-mode-1"
            checked={mode === "upto"}
            onChange={() => setMode("upto")}
          />
          <label htmlFor="own-upto-1" className={f.segmentLabel}>
            Up to a volume
          </label>
          <input
            type="radio"
            id="own-exact-1"
            name="own-mode-1"
            checked={mode === "exact"}
            onChange={() => setMode("exact")}
          />
          <label htmlFor="own-exact-1" className={f.segmentLabel}>
            Exact volumes
          </label>
        </div>
        {mode === "upto" ? (
          <div className="mt-1 flex items-center gap-3">
            <span className="text-[0.9rem]">Up to vol.</span>
            <input
              className={`${small} w-20`}
              value={upTo}
              onChange={(e) => setUpTo(e.target.value)}
              inputMode="numeric"
            />
          </div>
        ) : (
          <div className="mt-1 flex flex-col gap-2">
            <div className={vp.tickets}>
              {upToList(shown).map((v) => (
                <Ticket
                  key={v}
                  v={v}
                  on={list.includes(v)}
                  onClick={() => setList(toggle(list, v))}
                />
              ))}
              <button
                type="button"
                className={vp.more}
                onClick={() => setShown(shown + 12)}
              >
                +12 more
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Summary list={list} />
              <span className="flex gap-3">
                <button
                  type="button"
                  className={link}
                  onClick={() => setList(upToList(shown))}
                >
                  All 1–{shown}
                </button>
                <button
                  type="button"
                  className={link}
                  onClick={() => setList([])}
                >
                  None
                </button>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- 2. drop-down card ----------

function DropCard() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(start);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  return (
    <div className={`${f.row} items-start`}>
      <Chapter />
      <div ref={wrap} className={`${f.field} relative`}>
        <Label>Volumes</Label>
        <button
          type="button"
          className={`${f.input} select-chevron flex items-center text-left font-mono text-[0.92rem]`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {list.length ? `Vols. ${rangesText(list)}` : "None"}
        </button>
        {open && (
          <div className="absolute top-[calc(100%+8px)] left-0 z-20 w-[min(300px,80vw)] rounded-ink border-[2.5px] border-line bg-card p-3 shadow-[0_14px_30px_-14px_rgba(20,14,8,0.45)] animate-drop">
            <p className="mb-2 text-[0.85rem] font-semibold">
              Tap the ones you own
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              {upToList(18).map((v) => (
                <Ticket
                  key={v}
                  v={v}
                  on={list.includes(v)}
                  onClick={() => setList(toggle(list, v))}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between">
              <button
                type="button"
                className={link}
                onClick={() => setList([])}
              >
                None
              </button>
              <button
                type="button"
                className={link}
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
      <Genre />
    </div>
  );
}

// ---------- 3. sheet ----------

function Sheet() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(start);
  const [draft, setDraft] = useState(start);
  return (
    <div className={`${f.row} items-end`}>
      <Chapter />
      <div className={f.field}>
        <Label>Volumes</Label>
        <div className="flex gap-2">
          <span className={`${vp.picked} flex-1`}>
            {list.length ? rangesText(list) : "—"}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm h-11 shrink-0"
            onClick={() => {
              setDraft(list);
              setOpen(true);
            }}
          >
            Exact…
          </button>
        </div>
      </div>
      <Genre />
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(20,14,8,0.45)] p-4 upto-520:place-items-end upto-520:p-0"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Which volumes do you own?"
            className="w-[min(520px,100%)] border-[2.5px] border-line bg-card p-5 shadow-[8px_8px_0_var(--hard-shadow)] animate-drop upto-520:border-x-0 upto-520:border-b-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="font-brand text-[1.4rem] leading-none tracking-[0.02em] uppercase">
                Which volumes do you own?
              </h3>
              <button
                type="button"
                className="tap -m-2 p-2 text-muted hover:text-ink"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <CloseIcon className="size-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(3.2rem,1fr))] gap-2">
              {upToList(24).map((v) => (
                <Ticket
                  key={v}
                  v={v}
                  on={draft.includes(v)}
                  onClick={() => setDraft(toggle(draft, v))}
                  className={`${vp.ticket} h-12 text-[1rem]`}
                />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <Summary list={draft} />
              <span className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setList(draft);
                    setOpen(false);
                  }}
                >
                  Done
                </button>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 4. shelf of spines ----------

function Spines() {
  const [list, setList] = useState(start);
  const [shown, setShown] = useState(16);
  return (
    <div className="flex flex-col gap-4">
      <div className={f.row}>
        <Chapter />
        <Genre />
      </div>
      <div className={f.field}>
        <Label>Your shelf</Label>
        <div className="flex items-end gap-[3px] overflow-x-auto border-b-[3px] border-double border-line px-1 pt-2 pb-0">
          {upToList(shown).map((v) => {
            const on = list.includes(v);
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                aria-label={`Vol. ${v}`}
                onClick={() => setList(toggle(list, v))}
                className={`tap flex w-7 shrink-0 flex-col items-center justify-end border-[1.5px] pb-1 font-brand text-[0.95rem] leading-none transition-[height,transform,background-color] duration-150 ease-ink ${
                  on
                    ? "h-24 border-line bg-ink text-paper"
                    : "h-[4.6rem] origin-bottom-left rotate-[4deg] border-dashed border-line-soft bg-paper text-muted hover:rotate-0"
                }`}
              >
                <span className="[writing-mode:vertical-rl] mb-auto pt-1.5 text-[0.62rem] font-sans tracking-[0.08em] uppercase opacity-70">
                  {on ? "yours" : ""}
                </span>
                {v}
              </button>
            );
          })}
          <button
            type="button"
            className={`${link} mb-1 ml-2 shrink-0`}
            onClick={() => setShown(shown + 8)}
          >
            +8
          </button>
        </div>
        <Summary list={list} />
      </div>
    </div>
  );
}

// ---------- 5. range chips ----------

function RangeChips() {
  const [ranges, setRanges] = useState<[number, number][]>([
    [1, 1],
    [4, 4],
  ]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const list = [
    ...new Set(ranges.flatMap(([a, b]) => upToList(b).slice(a - 1))),
  ].sort((x, y) => x - y);
  const add = () => {
    const a = Number(from);
    const b = Number(to || from);
    if (!a || b < a) return;
    setRanges(
      [...ranges, [a, b] as [number, number]].sort((x, y) => x[0] - y[0]),
    );
    setFrom("");
    setTo("");
  };
  return (
    <div className="flex flex-col gap-4">
      <div className={f.row}>
        <Chapter />
        <Genre />
      </div>
      <div className={f.field}>
        <Label>Volumes you own</Label>
        <div className="flex flex-wrap gap-2">
          {ranges.map(([a, b], i) => (
            <span
              key={`${a}-${b}`}
              className="inline-flex h-9 items-center gap-1 border-[1.5px] border-line bg-ink pl-3 font-mono text-[0.9rem] text-paper"
            >
              {a === b ? `Vol. ${a}` : `Vols. ${a}–${b}`}
              <button
                type="button"
                aria-label={`Remove ${a}–${b}`}
                className="tap grid size-8 place-items-center opacity-70 hover:opacity-100"
                onClick={() => setRanges(ranges.filter((_, j) => j !== i))}
              >
                <CloseIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.9rem]">
          From
          <input
            className={small}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            inputMode="numeric"
            placeholder="5"
          />
          to
          <input
            className={small}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            inputMode="numeric"
            placeholder="9"
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm h-10"
            onClick={add}
          >
            + Add range
          </button>
        </div>
        <Summary list={list} />
      </div>
    </div>
  );
}

// ---------- 6. type first ----------

function TypeFirst() {
  const [text, setText] = useState("1, 4");
  const [tap, setTap] = useState(false);
  const parsed = parseVolumes(text);
  const list = parsed ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className={f.row}>
        <Chapter />
        <div className={f.field}>
          <Label>Volumes you own</Label>
          <input
            className={`${f.input} font-mono`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. 1-14, 16"
            aria-invalid={parsed === null}
          />
        </div>
        <Genre />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {parsed === null ? (
          <span className="text-[0.84rem] font-medium text-accent">
            Use numbers and ranges, like 1-5, 8
          </span>
        ) : list.length ? (
          rangesText(list)
            .split(", ")
            .map((part) => (
              <span
                key={part}
                className="border-[1.5px] border-line bg-paper px-2 py-0.5 font-mono text-[0.84rem]"
              >
                {part.includes("–") ? `vols. ${part}` : `vol. ${part}`}
              </span>
            ))
        ) : (
          <span className="text-[0.84rem] text-muted">
            Blank: you don't say
          </span>
        )}
        <button
          type="button"
          className={`${link} ml-auto`}
          aria-expanded={tap}
          onClick={() => setTap(!tap)}
        >
          {tap ? "Hide the tickets" : "Or tap them"}
        </button>
      </div>
      {tap && (
        <div className={vp.tickets}>
          {upToList(18).map((v) => (
            <Ticket
              key={v}
              v={v}
              on={list.includes(v)}
              onClick={() =>
                setText(rangesText(toggle(list, v)).replace(/–/g, "-"))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- 7. up to, then punch out ----------

function PunchOut() {
  const [upTo, setUpTo] = useState(14);
  const [holes, setHoles] = useState<number[]>([2, 3]);
  const [open, setOpen] = useState(true);
  const list = upToList(upTo).filter((v) => !holes.includes(v));
  return (
    <div className="flex flex-col gap-4">
      <div className={f.row}>
        <Chapter />
        <div className={f.field}>
          <Label>Own up to vol.</Label>
          <input
            className={f.input}
            type="number"
            min={1}
            value={upTo}
            onChange={(e) => setUpTo(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <Genre />
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className={`${link} self-start`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {holes.length
            ? `Missing ${holes.length}: ${rangesText(holes)}`
            : "Missing a few?"}
        </button>
        {open && (
          <>
            <p className="text-[0.84rem] text-ink-soft">
              Tap the ones you don't have
            </p>
            <div className={vp.tickets}>
              {upToList(upTo).map((v) => {
                const hole = holes.includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={!hole}
                    aria-label={`Vol. ${v}${hole ? ", not yours" : ""}`}
                    onClick={() => setHoles(toggle(holes, v))}
                    className={`tap flex h-10 items-center justify-center rounded-[2px] border-[1.5px] font-mono text-[0.9rem] tabular-nums transition-colors duration-120 ${
                      hole
                        ? "border-dashed border-line-soft text-muted line-through decoration-accent decoration-2"
                        : "border-line bg-ink text-paper"
                    }`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <Summary list={list} />
      </div>
    </div>
  );
}

// ---------- 8. rows of ten ----------

function RowsOfTen() {
  const [list, setList] = useState(start);
  const [rows, setRows] = useState(2);
  return (
    <div className="flex flex-col gap-4">
      <div className={f.row}>
        <Chapter />
        <Genre />
      </div>
      <div className={f.field}>
        <Label>Volumes you own</Label>
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: rows }, (_, r) => {
            const row = upToList(10).map((v) => v + r * 10);
            const full = row.every((v) => list.includes(v));
            return (
              <div
                key={r}
                className="grid grid-cols-[3.6rem_repeat(10,minmax(0,1fr))] items-center gap-1 upto-520:grid-cols-[repeat(10,minmax(0,1fr))]"
              >
                <button
                  type="button"
                  className={`${link} text-left font-mono text-[0.78rem] upto-520:col-span-10`}
                  onClick={() =>
                    setList(
                      full
                        ? list.filter((v) => !row.includes(v))
                        : [...new Set([...list, ...row])].sort((a, b) => a - b),
                    )
                  }
                >
                  {r * 10 + 1}–{r * 10 + 10}
                </button>
                {row.map((v) => (
                  <Ticket
                    key={v}
                    v={v}
                    on={list.includes(v)}
                    onClick={() => setList(toggle(list, v))}
                    className={`${vp.ticket} h-9 text-[0.8rem]`}
                  />
                ))}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <Summary list={list} />
          <button
            type="button"
            className={link}
            onClick={() => setRows(rows + 1)}
          >
            + row
          </button>
        </div>
      </div>
    </div>
  );
}
