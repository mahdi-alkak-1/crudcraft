import { apiBaseUrl } from "@/lib/api";
import Link from "next/link";

export default function Home() {
  const healthUrl = `${apiBaseUrl()}/api/health`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">CrudCraft</h1>
      <p className="mt-3 text-sm text-zinc-600">
        Simple full-stack CRUD demo (Express + Mongo + Next.js).
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/tasks"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Open Tasks
        </Link>
        <a
          href={healthUrl}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          target="_blank"
          rel="noreferrer"
        >
          API Health
        </a>
      </div>
    </main>
  );
}
