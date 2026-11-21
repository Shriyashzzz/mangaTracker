// The last few series picked from a search, newest first, kept on this
// device: the app's full-screen search lists them while its box is empty
// (pages/Prices/SeriesSearchBox.tsx)
const KEY = "recentSearches";
const KEEP = 5;

export function recentSearches(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list)
      ? list.filter((n): n is string => typeof n === "string")
      : [];
  } catch {
    return [];
  }
}

export function rememberSearch(name: string) {
  const list = [name, ...recentSearches().filter((n) => n !== name)];
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, KEEP)));
  } catch {
    // storage full or off: nothing to keep
  }
}
