export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-900 text-xl font-black text-white">
          AA
        </div>
        <h1 className="text-xl font-bold text-slate-900">You are offline</h1>
        <p className="mt-2 text-sm text-slate-500">
          ASIM AUTOS needs an internet connection to load your shop data.
          Please reconnect and try again.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white"
        >
          Retry
        </a>
      </div>
    </main>
  );
}
