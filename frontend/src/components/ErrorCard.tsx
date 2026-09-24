import type { ApiErrorKind } from "../api";

const TITLES: Record<ApiErrorKind, string> = {
  unreachable: "Can't reach the server",
  "rate-limited": "Rate limit reached",
  busy: "The AI service is busy",
  timeout: "The request timed out",
  "invalid-question": "Couldn't use that question",
  server: "Something went wrong",
};

interface ErrorCardProps {
  kind: ApiErrorKind;
  message: string;
  /** Omitted while another question is in progress. */
  onRetry?: () => void;
}

export function ErrorCard({ kind, message, onRetry }: ErrorCardProps) {
  // Re-sending a rejected question would just be rejected again.
  const retryable = kind !== "invalid-question";

  return (
    <div role="alert" className="rounded-2xl border border-ember/25 bg-ember/10 px-5 py-4 text-sm backdrop-blur">
      <p className="font-medium text-ember">{TITLES[kind]}</p>
      <p className="mt-1 text-chalk/80">{message}</p>
      {retryable && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-ember/30 bg-white/5 px-3 py-1.5 text-xs font-semibold text-ember transition-colors hover:bg-white/10"
        >
          Try again
        </button>
      )}
    </div>
  );
}
