export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">CrudCraft</h1>
      <p className="mt-3 text-sm text-zinc-600">
        Simple full-stack CRUD demo (Express + Mongo + Next.js).
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="/tasks"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Open Tasks
        </a>
        <a
          href="http://localhost:4000/api/health"
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
