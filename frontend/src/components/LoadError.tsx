export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-ember/25 bg-ember/10 px-5 py-4 text-sm backdrop-blur">
      <p className="font-display font-semibold text-ember">Couldn't load the repositories</p>
      <p className="mt-1 text-chalk/80">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-ember/30 bg-white/5 px-3 py-1.5 text-xs font-semibold text-ember transition-colors hover:bg-white/10"
      >
        Try again
      </button>
    </div>
  );
}
