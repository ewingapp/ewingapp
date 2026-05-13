"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-rose-50 border border-rose-200 rounded-lg p-5">
        <h1 className="text-lg font-semibold text-rose-900 mb-2">
          Something went wrong
        </h1>
        <pre className="text-sm text-rose-900 whitespace-pre-wrap break-words bg-white border border-rose-200 rounded p-3 overflow-auto">
          {error.message || String(error)}
          {error.digest && `\n\ndigest: ${error.digest}`}
          {error.stack && `\n\n${error.stack}`}
        </pre>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex items-center gap-2 h-9 px-3.5 rounded-md text-sm font-medium text-white"
          style={{ background: "#0085CA", border: "2px solid #0085CA" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
