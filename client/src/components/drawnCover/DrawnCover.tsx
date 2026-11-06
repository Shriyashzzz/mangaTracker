// A cover drawn from the series' name, for one with no image (or one that
// won't load): a printed panel with the title lettered on it, so a shelf of
// imports still reads as different books rather than a wall of the same
// placeholder. Fills its box; the lettering scales with it (container units),
// so it works on a big details cover and a small row cover alike
import clsx from "clsx";

export default function DrawnCover({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return (
    // the container is the box itself; the padding sits on the layer inside,
    // since a container's own padding can't be measured in its own units
    <span
      className={clsx(
        "printed @container absolute inset-0 overflow-hidden bg-card bg-[radial-gradient(var(--dots-strong)_1px,transparent_1.2px)] bg-size-[7px_7px]",
        className,
      )}
      aria-hidden
    >
      <span className="flex size-full flex-col justify-between p-[8cqw]">
        {/* a printed band across the top, like a volume's publisher strip */}
        <span className="block h-[5cqw] w-[45%] bg-ink" />
        <span className="line-clamp-5 font-brand text-[clamp(0.45rem,15cqw,2.2rem)] leading-[0.95] tracking-[0.02em] text-balance wrap-anywhere text-ink uppercase">
          {title}
        </span>
        <span className="block h-[2cqw] w-full bg-ink" />
      </span>
    </span>
  );
}
