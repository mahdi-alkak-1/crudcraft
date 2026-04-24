import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiBaseUrl, fetchJson } from "./api";

// Helper to create a mock Response object
function mockResponse(
  body: unknown,
  options: {
    status?: number;
    contentType?: string;
  } = {},
): Response {
  const { status = 200, contentType = "application/json" } = options;

  const isJson = contentType.includes("application/json");
  const bodyStr = isJson ? JSON.stringify(body) : String(body);

  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) => (name === "content-type" ? contentType : null),
    },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(bodyStr),
  } as unknown as Response;
}

describe("apiBaseUrl", () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    // Restore original env after each test
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalEnv;
    }
  });

  it("returns the NEXT_PUBLIC_API_URL env variable when set", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    expect(apiBaseUrl()).toBe("https://api.example.com");
  });

  it("falls back to http://localhost:4000 when env var is not set", () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(apiBaseUrl()).toBe("http://localhost:4000");
  });

  it("returns an empty string value when NEXT_PUBLIC_API_URL is empty string", () => {
    process.env.NEXT_PUBLIC_API_URL = "";
    // nullish coalescing: "" is falsy but not null/undefined, so it keeps ""
    expect(apiBaseUrl()).toBe("");
  });

  it("returns custom port URL when set", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";
    expect(apiBaseUrl()).toBe("http://localhost:8080");
  });
});

describe("fetchJson", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Successful responses ──────────────────────────────────────────────────

  it("returns parsed JSON body on 200 with application/json content-type", async () => {
    const data = { id: "1", title: "Task" };
    vi.mocked(fetch).mockResolvedValue(mockResponse(data));

    const result = await fetchJson<typeof data>("https://api.example.com/tasks");
    expect(result).toEqual(data);
  });

  it("returns undefined (as T) for 204 No Content responses", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(null, { status: 204, contentType: "" }),
    );

    const result = await fetchJson<void>("https://api.example.com/tasks/1", {
      method: "DELETE",
    });
    expect(result).toBeUndefined();
  });

  it("returns text body for non-JSON content type on success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse("plain text response", { contentType: "text/plain" }),
    );

    const result = await fetchJson<string>("https://api.example.com/text");
    expect(result).toBe("plain text response");
  });

  it("passes request init options to fetch", async () => {
    const data = { created: true };
    vi.mocked(fetch).mockResolvedValue(mockResponse(data, { status: 201 }));

    const init: RequestInit = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "New Task" }),
    };

    await fetchJson("https://api.example.com/tasks", init);

    expect(fetch).toHaveBeenCalledWith("https://api.example.com/tasks", init);
  });

  it("accepts a URL object as input", async () => {
    const data = { items: [] };
    vi.mocked(fetch).mockResolvedValue(mockResponse(data));

    const url = new URL("https://api.example.com/tasks");
    const result = await fetchJson<typeof data>(url);
    expect(result).toEqual(data);
    expect(fetch).toHaveBeenCalledWith(url, undefined);
  });

  // ── Error responses ────────────────────────────────────────────────────────

  it("throws an Error with message from JSON body error field on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ error: "Not found" }, { status: 404 }),
    );

    await expect(
      fetchJson("https://api.example.com/tasks/missing"),
    ).rejects.toThrow("Not found");
  });

  it("throws an Error with plain text body when response is text and not ok", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse("Internal Server Error", {
        status: 500,
        contentType: "text/plain",
      }),
    );

    await expect(
      fetchJson("https://api.example.com/tasks"),
    ).rejects.toThrow("Internal Server Error");
  });

  it("throws 'Request failed' when JSON error body has no error field", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ message: "Something broke" }, { status: 500 }),
    );

    await expect(
      fetchJson("https://api.example.com/tasks"),
    ).rejects.toThrow("Request failed");
  });

  it("throws an Error on 400 Bad Request with error message", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ error: "Invalid body" }, { status: 400 }),
    );

    await expect(
      fetchJson("https://api.example.com/tasks", { method: "POST" }),
    ).rejects.toThrow("Invalid body");
  });

  it("throws an Error on 401 Unauthorized", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ error: "Unauthorized" }, { status: 401 }),
    );

    await expect(
      fetchJson("https://api.example.com/protected"),
    ).rejects.toThrow("Unauthorized");
  });

  it("propagates network errors from fetch", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    await expect(
      fetchJson("https://api.example.com/tasks"),
    ).rejects.toThrow("Network error");
  });

  // ── Content-type edge cases ────────────────────────────────────────────────

  it("treats missing content-type header as non-JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse("response text", { contentType: "" }),
    );
    // status 200, no content-type -> text path
    const result = await fetchJson<string>("https://api.example.com/data");
    expect(result).toBe("response text");
  });

  it("parses JSON when content-type includes charset (application/json; charset=utf-8)", async () => {
    const data = { value: 42 };
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(data, { contentType: "application/json; charset=utf-8" }),
    );

    const result = await fetchJson<typeof data>("https://api.example.com/data");
    expect(result).toEqual(data);
  });

  // ── Type safety boundary ────────────────────────────────────────────────────

  it("returns typed result that TypeScript accepts without assertion", async () => {
    type User = { id: number; name: string };
    const data: User = { id: 1, name: "Alice" };
    vi.mocked(fetch).mockResolvedValue(mockResponse(data));

    const result = await fetchJson<User>("https://api.example.com/user");
    // These property accesses prove the TypeScript type is correct at compile time
    expect(result.id).toBe(1);
    expect(result.name).toBe("Alice");
  });
});