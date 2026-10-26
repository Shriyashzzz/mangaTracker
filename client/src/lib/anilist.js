// AniList's public GraphQL API: free, no key, ~30-90 requests a minute
const ANILIST_URL = "https://graphql.anilist.co";

const SEARCH_QUERY = `
  query ($search: String) {
    Page(perPage: 6) {
      media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
        id
        title { english romaji }
        startDate { year }
        coverImage { extraLarge large }
        genres
        tags { name rank isMediaSpoiler }
      }
    }
  }
`;

// AniList tags that name one of our genres outright. AniList tags almost
// everything with something, so most need a high rank (0-100) to count;
// the ones that define a series whenever they show up get a lower bar
const TAG_GENRES = {
  Isekai: { genre: "Isekai", minRank: 65 },
  Food: { genre: "Gourmet", minRank: 75 },
  Cooking: { genre: "Gourmet", minRank: 75 },
  Superhero: { genre: "Superhero", minRank: 80 },
  Cyberpunk: { genre: "Cyberpunk", minRank: 90 },
  Steampunk: { genre: "Steampunk", minRank: 90 },
  "Post-Apocalyptic": { genre: "Post-Apocalyptic", minRank: 90 },
  Dystopian: { genre: "Dystopian", minRank: 90 },
  Military: { genre: "Military", minRank: 90 },
  Historical: { genre: "Historical", minRank: 90 },
  "Female Harem": { genre: "Harem", minRank: 90 },
  "Male Harem": { genre: "Harem", minRank: 90 },
};

// AniList genres in the order we'd rather show them, the broad ones last
const GENRE_PRIORITY = [
  ["Mahou Shoujo", "Magical Girl"],
  ["Mecha", "Mecha"],
  ["Sports", "Sports"],
  ["Horror", "Horror"],
  ["Romance", "Romance"],
  ["Mystery", "Mystery"],
  ["Sci-Fi", "Sci-Fi"],
  ["Thriller", "Thriller"],
  ["Supernatural", "Supernatural"],
  ["Slice of Life", "Slice of Life"],
  ["Adventure", "Adventure"],
  ["Action", "Action"],
  ["Comedy", "Comedy"],
  ["Fantasy", "Fantasy"],
  ["Drama", "Drama"],
  ["Ecchi", "Ecchi"],
];

// picks the one genre from lib/genres.js that best describes an AniList entry
export function pickGenre(genres = [], tags = []) {
  const has = (g) => genres.includes(g);
  if (has("Mahou Shoujo")) return "Magical Girl";

  const isekai = tags.find((t) => t.name === "Isekai");
  if (isekai && isekai.rank >= TAG_GENRES.Isekai.minRank) return "Isekai";

  if (has("Fantasy") && has("Horror")) return "Dark Fantasy";
  if (has("Psychological") && has("Thriller")) return "Psychological Thriller";

  // otherwise the strongest qualifying tag wins
  const tagHit = tags
    .filter(
      (t) =>
        !t.isMediaSpoiler &&
        TAG_GENRES[t.name] &&
        t.rank >= TAG_GENRES[t.name].minRank,
    )
    .sort((x, y) => y.rank - x.rank)[0];
  if (tagHit) return TAG_GENRES[tagHit.name].genre;

  const genreHit = GENRE_PRIORITY.find(([g]) => has(g));
  return genreHit ? genreHit[1] : "";
}

// returns [{ id, title, year, cover, genre }], throws on network / rate limit errors
export async function searchCovers(search, signal) {
  const response = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: SEARCH_QUERY, variables: { search } }),
    signal,
  });
  if (!response.ok) throw new Error(`AniList responded ${response.status}`);

  const { data } = await response.json();
  return (data?.Page?.media ?? [])
    .filter((m) => m.coverImage?.large)
    .map((m) => ({
      id: m.id,
      title: m.title.english || m.title.romaji,
      year: m.startDate?.year,
      cover: m.coverImage.extraLarge || m.coverImage.large,
      genre: pickGenre(m.genres, m.tags),
    }));
}
