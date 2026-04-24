import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiBaseUrl, fetchJson } from "@/lib/api";

// ---------------------------------------------------------------------------
// apiBaseUrl tests
// ---------------------------------------------------------------------------
describe("apiBaseUrl", () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalEnv;
    }
  });

  it("returns the default localhost URL when env var is not set", () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(apiBaseUrl()).toBe("http://localhost:4000");
  });

  it("returns the configured URL when NEXT_PUBLIC_API_URL is set", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    expect(apiBaseUrl()).toBe("https://api.example.com");
  });

  it("returns the env var value even if it has a trailing slash", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/";
    expect(apiBaseUrl()).toBe("https://api.example.com/");
  });
});

// ---------------------------------------------------------------------------
// fetchJson tests
// ---------------------------------------------------------------------------
describe("fetchJson", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(status: number, body: unknown, contentType = "application/json") {
    const text = typeof body === "string" ? body : JSON.stringify(body);
    global.fetch = vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      headers: {
        get: (header: string) => {
          if (header === "content-type") return contentType;
          return null;
        },
      },
      json: vi.fn().mockResolvedValue(body),
      text: vi.fn().mockResolvedValue(text),
    });
  }

  it("returns parsed JSON for a successful response", async () => {
    mockFetch(200, { id: 1, title: "Task" });
    const result = await fetchJson<{ id: number; title: string }>("https://api.example.com/tasks");
    expect(result).toEqual({ id: 1, title: "Task" });
  });

  it("returns undefined for a 204 No Content response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 204,
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue(null),
      },
    });
    const result = await fetchJson<void>("https://api.example.com/tasks/1", { method: "DELETE" });
    expect(result).toBeUndefined();
  });

  it("throws an error with the body.error message for non-ok JSON response", async () => {
    mockFetch(404, { error: "Not found" });
    await expect(fetchJson("https://api.example.com/tasks/999")).rejects.toThrow("Not found");
  });

  it("throws an error with the text body for non-ok text response", async () => {
    mockFetch(500, "Internal Server Error", "text/plain");
    await expect(fetchJson("https://api.example.com/tasks")).rejects.toThrow(
      "Internal Server Error",
    );
  });

  it("throws 'Request failed' when non-ok JSON body has no error field", async () => {
    mockFetch(400, { message: "Something went wrong" });
    await expect(fetchJson("https://api.example.com/tasks")).rejects.toThrow("Request failed");
  });

  it("passes init options to fetch", async () => {
    mockFetch(201, { id: 2, title: "New Task" });
    const init: RequestInit = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "New Task" }),
    };
    await fetchJson<{ id: number; title: string }>("https://api.example.com/tasks", init);

    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/tasks", init);
  });

  it("handles 400 error with error message in body", async () => {
    mockFetch(400, { error: "Invalid body" });
    await expect(fetchJson("https://api.example.com/tasks")).rejects.toThrow("Invalid body");
  });

  it("handles 401 unauthorized error", async () => {
    mockFetch(401, { error: "Unauthorized" });
    await expect(fetchJson("https://api.example.com/tasks")).rejects.toThrow("Unauthorized");
  });

  it("returns plain text body as string for successful text/plain response", async () => {
    mockFetch(200, "plain text response", "text/plain");
    const result = await fetchJson<string>("https://api.example.com/ping");
    expect(result).toBe("plain text response");
  });

  it("calls fetch with the provided URL", async () => {
    mockFetch(200, []);
    await fetchJson("https://api.example.com/items");
    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/items", undefined);
  });

  it("handles array response body", async () => {
    const items = [{ id: 1 }, { id: 2 }];
    mockFetch(200, items);
    const result = await fetchJson<typeof items>("https://api.example.com/tasks");
    expect(result).toEqual(items);
  });

  it("does not read body on 204 status", async () => {
    const jsonMock = vi.fn();
    const textMock = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      status: 204,
      ok: true,
      headers: { get: vi.fn().mockReturnValue(null) },
      json: jsonMock,
      text: textMock,
    });

    await fetchJson<void>("https://api.example.com/tasks/1", { method: "DELETE" });
    expect(jsonMock).not.toHaveBeenCalled();
    expect(textMock).not.toHaveBeenCalled();
  });
});