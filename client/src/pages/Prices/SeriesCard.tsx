import { NavLink } from "react-router";
import SeriesPicture from "../../components/cover/SeriesPicture";
import { novelParts, seriesCanonicalPath, seriesPath } from "../../lib/prices";
import { SeriesScoreBadge } from "./SeriesScore";
import { pricesStyles as styles } from "./styles";

// one series: cover, name and a line of facts. Used on the price home
// (popular this season, search results) and the /series index
// the fields a card shows; search hits and index entries both fit
type SeriesCardData = {
  name: string;
  coverUrl: string | null;
  year?: number | null;
  // how many volumes Japan has (AniList's count)
  volumes?: number | null;
  // how many are out in English, where we've counted them
  englishVolumes?: number | null;
  score?: number | null;
  genre?: string;
};

const vols = (count: number) => `${count} vol${count === 1 ? "" : "s"}`;

// How many volumes there are, the English count first: that's the one a
// shopper here can buy. "14 in English · 24 in Japan", or plain "24 vols"
// when both are the same. Without an English count, AniList's is said to be
// Japan's (the US edition can be fewer, or omnibuses). A novel's count is
// the English list we keep
function volumesText(series: SeriesCardData, lightNovel: boolean) {
  const { volumes: japan, englishVolumes: english } = series;
  if (lightNovel) return japan ? vols(japan) : null;
  if (!english) return japan ? `${vols(japan)} in Japan` : null;
  if (!japan || english === japan) return vols(english);
  return `${english} in English · ${japan} in Japan`;
}

// `canonical`: the name is AniList's own (a stored series), so the link can be
// the clean address search engines know it by, with no ?name=
export default function SeriesCard({
  series,
  canonical = false,
  to,
}: {
  series: SeriesCardData;
  canonical?: boolean;
  // where the card goes, when it isn't the series' price page
  to?: string;
}) {
  const pricePage = canonical
    ? seriesCanonicalPath(series.name)
    : seriesPath(series.name);
  // "Overlord Light Novel" is shown as Overlord, a light novel
  const shown = novelParts(series.name);
  return (
    <NavLink to={to ?? pricePage} className={styles.card} viewTransition>
      <span className={styles.scoredCover}>
        <span className={styles.cover}>
          <SeriesPicture
            name={series.name}
            url={series.coverUrl}
            sizes="(max-width: 720px) 110px, 156px"
          />
        </span>
        {/* AniList's score, as stars */}
        <SeriesScoreBadge percent={series.score} />
      </span>
      <span className={styles.cardTitle}>{shown.title}</span>
      <span className={styles.cardMeta}>
        {[
          shown.lightNovel && "Light novel",
          series.year,
          volumesText(series, shown.lightNovel),
          series.genre,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </NavLink>
  );
}
