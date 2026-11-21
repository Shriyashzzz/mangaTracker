// "Missing a book?" under a series' editions: a reader names a book no
// catalog lists yet (the edition, its number, the volumes it holds). It shows
// everywhere once three readers say the same, or the site's owner approves it
// (server util/shelf/editionReports.ts). Signed out, it asks them to sign in.
import AppFold from "../../components/appFold/AppFold";
import { useState, type FormEvent } from "react";
import { NavLink, useLocation } from "react-router";
import { signInPath } from "../../lib/api";
import { shownBooks, type LookupLine } from "../../lib/editionLookup";
import { reportBook } from "../../lib/editionsIndex";
import { useAuth } from "../../store/auth";
import { afterAnimeStyles as formStyles } from "../AfterAnime/styles";
import { SortMenu } from "../Home/ShelfBar";

const whole = (typed: string) =>
  /^\d+$/.test(typed.trim()) ? Number(typed) : null;

export default function ReportBook({
  seriesName,
  lines,
}: {
  seriesName: string;
  lines: LookupLine[];
}) {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const { pathname, search } = useLocation();
  const [edition, setEdition] = useState(lines[0]?.key ?? "");
  const [number, setNumber] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [state, setState] = useState<"typing" | "sending" | "sent">("typing");
  const [problem, setProblem] = useState("");

  // the book after the last one shown, as the boxes' hints
  const line = lines.find((l) => l.key === edition) ?? lines[0];
  const last = line ? shownBooks(line).at(-1) : undefined;
  const size = last?.volumes.length ?? 3;
  const nextFrom = (last ? Math.max(...last.volumes) : 0) + 1;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = whole(number);
    const first = whole(from);
    const final = whole(to) ?? first;
    if (!n || !first || !final || final < first || final - first > 11) {
      setProblem("Add the book's number and the volumes it holds.");
      return;
    }
    setState("sending");
    const wrong = await reportBook({
      name: seriesName,
      edition,
      number: n,
      volumes: Array.from({ length: final - first + 1 }, (_, i) => first + i),
    }).catch(() => "That didn't send. Check your connection and try again.");
    setProblem(wrong);
    setState(wrong ? "typing" : "sent");
  };

  if (!lines.length) return null;
  return (
    <AppFold
      className={formStyles.fix}
      summaryClass={formStyles.fixSummary}
      summary="Missing a book?"
    >
      {!isSignedIn ? (
        <p className={formStyles.fixThanks}>
          <NavLink
            to={signInPath(pathname + search)}
            className="underline underline-offset-3"
          >
            Sign in
          </NavLink>{" "}
          to tell us about it.
        </p>
      ) : state === "sent" ? (
        <p className={formStyles.fixThanks} role="status">
          Thanks. It shows here once three readers say the same, or once it's
          checked.
        </p>
      ) : (
        <form className={formStyles.fixForm} onSubmit={submit} noValidate>
          {lines.length > 1 && (
            <div className={`${formStyles.fixField} ${formStyles.fixWide}`}>
              <label htmlFor="report-edition" className={formStyles.fixLabel}>
                Edition
              </label>
              <SortMenu
                box
                id="report-edition"
                menuLabel="Edition"
                options={lines.map((l) => ({ value: l.key, label: l.label }))}
                sortBy={edition}
                onSort={setEdition}
              />
            </div>
          )}
          <label className={`${formStyles.fixField} ${formStyles.fixWide}`}>
            <span className={formStyles.fixLabel}>Book number</span>
            <input
              className={`${formStyles.fixInput} max-w-32`}
              inputMode="numeric"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder={String((last?.number ?? 0) + 1)}
            />
          </label>
          <label className={formStyles.fixField}>
            <span className={formStyles.fixLabel}>First volume in it</span>
            <input
              className={formStyles.fixInput}
              inputMode="numeric"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder={String(nextFrom)}
            />
          </label>
          <label className={formStyles.fixField}>
            <span className={formStyles.fixLabel}>Last volume in it</span>
            <input
              className={formStyles.fixInput}
              inputMode="numeric"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={String(nextFrom + size - 1)}
            />
          </label>
          <div className={formStyles.fixActions}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={state === "sending"}
            >
              {state === "sending" ? "Sending…" : "Send it"}
            </button>
            {problem && (
              <p className={formStyles.fixProblem} role="alert">
                {problem}
              </p>
            )}
          </div>
        </form>
      )}
    </AppFold>
  );
}
