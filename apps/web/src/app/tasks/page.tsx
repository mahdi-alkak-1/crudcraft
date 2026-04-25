"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { apiBaseUrl, fetchJson } from "@/lib/api";

type TaskStatus = "todo" | "doing" | "done";

type Task = {
  _id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  items: Task[];
  total: number;
  limit: number;
  offset: number;
};

function formatDate(input?: string) {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}

export default function TasksPage() {
  const baseUrl = useMemo(() => apiBaseUrl(), []);
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>(
    {},
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<ListResponse>(`${baseUrl}/api/tasks`);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await fetchJson<Task>(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description: description.trim() ? description : undefined,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        }),
      });
      setTitle("");
      setDescription("");
      setDueDate("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task");
    }
  }

  async function setStatus(id: string, status: TaskStatus) {
    if (statusUpdating[id]) return;
    setError(null);
    setStatusUpdating((prev) => ({ ...prev, [id]: true }));
    setItems((prev) => prev.map((t) => (t._id === id ? { ...t, status } : t)));
    try {
      await fetchJson<Task>(`${baseUrl}/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update task");
      await load();
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function remove(id: string) {
    setError(null);
    const before = items;
    setItems((prev) => prev.filter((t) => t._id !== id));
    try {
      await fetchJson<void>(`${baseUrl}/api/tasks/${id}`, { method: "DELETE" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete task");
      setItems(before);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <Link
          href="/"
          className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
        >
          Home
        </Link>
      </div>

      <p className="mt-2 text-sm text-zinc-600">
        API: <span className="font-mono text-zinc-800">{baseUrl}</span>
      </p>

      <form
        onSubmit={createTask}
        className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-800">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 rounded-lg border border-zinc-200 px-3 outline-none ring-zinc-300 focus:ring-2"
              placeholder="Buy groceries"
              required
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-800">Due date</span>
            <input
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              type="date"
              className="h-10 rounded-lg border border-zinc-200 px-3 outline-none ring-zinc-300 focus:ring-2"
            />
          </label>
        </div>
        <label className="mt-3 grid gap-1">
          <span className="text-sm font-medium text-zinc-800">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-24 rounded-lg border border-zinc-200 px-3 py-2 outline-none ring-zinc-300 focus:ring-2"
            placeholder="Optional notes…"
          />
        </label>
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            disabled={!title.trim()}
          >
            Add task
          </button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </form>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-800">Your tasks</h2>
          {loading ? (
            <span className="text-xs text-zinc-500">Loading…</span>
          ) : (
            <button
              onClick={() => void load()}
              className="text-xs text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
              type="button"
            >
              Refresh
            </button>
          )}
        </div>

        <ul className="mt-3 grid gap-3">
          {!loading && items.length === 0 ? (
            <li className="rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-sm text-zinc-600">
              No tasks yet — add one above.
            </li>
          ) : null}

          {items.map((t) => (
            <li
              key={t._id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-zinc-900">
                    {t.title}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {t.description ? t.description : "—"}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Due: {formatDate(t.dueDate) || "—"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={t.status}
                    onChange={(e) =>
                      void setStatus(t._id, e.target.value as TaskStatus)
                    }
                    disabled={!!statusUpdating[t._id]}
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none ring-zinc-300 focus:ring-2 disabled:opacity-50"
                  >
                    <option value="todo">Todo</option>
                    <option value="doing">Doing</option>
                    <option value="done">Done</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void remove(t._id)}
                    className="h-9 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
