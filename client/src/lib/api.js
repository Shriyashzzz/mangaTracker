export const API_URL = import.meta.env.VITE_API_URL;

// thin wrapper around fetch that always sends the session cookie
// and serialises JSON bodies
export function apiFetch(path, { body, headers, ...options } = {}) {
  return fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: body
      ? { "Content-Type": "application/json", ...headers }
      : headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// where to go after signing in: the page that sent people to sign in, if
// it's one of ours, otherwise the shelf
export const afterSignIn = (params) => {
  const next = params.get("next") ?? "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/shelf";
};

// a sign-in link that comes back to `path` afterwards
export const signInPath = (path) =>
  `/signin?${new URLSearchParams({ next: path })}`;

export const FALLBACK_COVER =
  "https://images.penguinrandomhouse.com/cover/9781569319003";
