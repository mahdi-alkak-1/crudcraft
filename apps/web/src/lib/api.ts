export function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

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

