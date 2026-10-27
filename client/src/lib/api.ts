// Talking to the API. Every request sends the session cookie, so the
// server knows who's signed in. VITE_API_URL is the API's address
// (http://localhost:8080 in development).
import type { ApiError } from "./types";

export const API_URL: string = import.meta.env.VITE_API_URL ?? "";

type FetchOptions = Omit<RequestInit, "body"> & { body?: unknown };

// thin wrapper around fetch that always sends the session cookie
// and serialises JSON bodies
export function apiFetch(
  path: string,
  { body, headers, ...options }: FetchOptions = {},
) {
  return fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers:
      body !== undefined
        ? { "Content-Type": "application/json", ...headers }
        : headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// GET as JSON. Throws with the server's own message so pages can show it
export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await apiFetch(path, { signal });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (data as ApiError | null)?.error?.[0]?.msg ??
        "Something went wrong. Try again.",
    );
  }
  return data as T;
}

// the messages in an error response, for showing under a form
export async function errorMessages(res: Response): Promise<string[]> {
  const data = (await res.json().catch(() => null)) as ApiError | null;
  return data?.error?.map((e) => e.msg) ?? ["Something went wrong, please try again!"];
}

// where to go after signing in: the page that sent people to sign in, if
// it's one of ours, otherwise the shelf
export const afterSignIn = (params: URLSearchParams) => {
  const next = params.get("next") ?? "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/shelf";
};

// a sign-in link that comes back to `path` afterwards
export const signInPath = (path: string) =>
  `/signin?${new URLSearchParams({ next: path })}`;

export const FALLBACK_COVER =
  "https://images.penguinrandomhouse.com/cover/9781569319003";
