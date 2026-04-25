/**
 * Returns the base URL for the backend API.
 */
export function apiBaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  const base = raw || "http://localhost:4000";
  return base.replace(/\/+$/, "");
}

/**
 * Fetches a URL and returns JSON (or text) while throwing on non-2xx responses.
 */
export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input, init);
  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const message =
      typeof body === "string"
        ? body
        : (body?.error as string | undefined) ?? "Request failed";
    throw new Error(message);
  }

  return body as T;
}
