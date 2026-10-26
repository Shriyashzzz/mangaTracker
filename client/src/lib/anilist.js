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
      }
    }
  }
`;

// returns [{ id, title, year, cover }], throws on network / rate limit errors
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
    }));
}
