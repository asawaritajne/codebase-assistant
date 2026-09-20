export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm">
      <p className="font-medium text-red-800">Couldn't load the repositories</p>
      <p className="mt-1 text-red-700">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
      >
        Try again
      </button>
    </div>
  );
}
