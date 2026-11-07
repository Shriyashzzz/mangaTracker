// Talking to the API. Every request sends the session cookie, so the
// server knows who's signed in. VITE_API_URL is the API's address
// (http://localhost:8080 in development). It's empty in production, where
// /api on the site itself is passed on to the API (see client/server.ts)
import { demoResponse, isDemo } from "./demo";
import type { ApiError } from "./types";

export const API_URL: string = import.meta.env.VITE_API_URL ?? "";

type FetchOptions = Omit<RequestInit, "body"> & { body?: unknown };

// thin wrapper around fetch that always sends the session cookie
// and serialises JSON bodies
export function apiFetch(
  path: string,
  { body, headers, ...options }: FetchOptions = {},
) {
  // the tour's practice account never touches the real server
  if (isDemo()) {
    return demoResponse(
      path,
      options.method,
      body !== undefined ? JSON.stringify(body) : undefined,
    );
  }
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

// a failed request, with the server's message and its status (404 and the
// rest), so callers can tell "not there" from "didn't answer"
export class HttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// GET as JSON. Throws with the server's own message so pages can show it
export async function getJson<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const res = await apiFetch(path, { signal });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new HttpError(
      (data as ApiError | null)?.error?.[0]?.msg ??
        "Something went wrong. Try again.",
      res.status,
    );
  }
  return data as T;
}

// the messages in an error response, for showing under a form
export async function errorMessages(res: Response): Promise<string[]> {
  const data = (await res.json().catch(() => null)) as ApiError | null;
  return (
    data?.error?.map((e) => e.msg) ?? [
      "Something went wrong, please try again!",
    ]
  );
}

// where to go after signing in: the page that sent people to sign in, if
// it's one of ours, otherwise the shelf
export const afterSignIn = (params: URLSearchParams) => {
  const next = params.get("next") ?? "";
  if (!next.startsWith("/")) return "/shelf";
  // read the way the browser will: "/\t/evil.com" and "/\\evil.com" turn
  // into another site, so only a path that stays on this one is followed
  try {
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin) return "/shelf";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/shelf";
  }
};

// a sign-in link that comes back to `path` afterwards
export const signInPath = (path: string) =>
  `/signin?${new URLSearchParams({ next: path })}`;
