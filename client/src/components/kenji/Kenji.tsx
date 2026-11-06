// Kenji, the site's mascot, as he peeks in: his head, and the fingers he holds
// the window's edge with. Shared by the coffee note (SupportPeek) and the import
// note (ImportPeek)
const skin = "fill-card stroke-line stroke-3";

// always ink on paper: `printed` keeps these colors in the dark theme too
export function Head({ grin }: { grin: boolean }) {
  return (
    <g className="[stroke-linejoin:round]">
      <circle className={skin} cx="21" cy="80" r="7" />
      <circle className={skin} cx="103" cy="80" r="7" />
      <circle className={skin} cx="62" cy="72" r="42" />
      <path
        className="fill-line stroke-line stroke-2"
        transform="translate(-8 2)"
        d="M28 70C24 46 34 30 46 26L40 9l18 13 4-18 12 16 12-14 2 18 16-10-6 18c12 8 16 22 14 38l-8-12-6 8-6-14-8 10-8-12-8 10-8-12-8 12-6-10-8 14Z"
      />
      <path
        className="fill-none stroke-line stroke-5 [stroke-linecap:round]"
        d="M37 64q8-6 17-3M70 61q9-3 17 3"
      />
      {/* glancing over at what he's saying */}
      <g className="support-peek-eyes">
        <ellipse className="fill-line" cx="47" cy="77" rx="7.5" ry="9.5" />
        <ellipse className="fill-line" cx="79" cy="77" rx="7.5" ry="9.5" />
        <circle className="fill-card" cx="50.5" cy="73" r="2.8" />
        <circle className="fill-card" cx="82.5" cy="73" r="2.8" />
      </g>
      <path
        className="fill-star stroke-line stroke-[1.5]"
        d="M15 26l2.5 6.5 6.5 2.5-6.5 2.5-2.5 6.5-2.5-6.5-6.5-2.5 6.5-2.5Z"
      />
      {grin && (
        <path
          className="fill-accent stroke-line stroke-3"
          d="M50 94h26q-2 13-13 13t-13-13Z"
        />
      )}
    </g>
  );
}

export function Fingers({ x }: { x: number }) {
  return [0, 11, 22].map((offset) => (
    <rect
      key={offset}
      className="fill-card stroke-line stroke-[2.5]"
      x={x + offset}
      y={offset === 11 ? 72 : 75}
      width="11"
      height="26"
      rx="5.5"
    />
  ));
}
