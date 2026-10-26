const API_URL = import.meta.env.VITE_API_URL;

// thin wrapper around fetch that always sends the session cookie
// and serialises JSON bodies
export function apiFetch(path, { body, headers, ...options } = {}) {
  return fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: body ? { "Content-Type": "application/json", ...headers } : headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export const FALLBACK_COVER =
  "https://images.penguinrandomhouse.com/cover/9781569319003";
