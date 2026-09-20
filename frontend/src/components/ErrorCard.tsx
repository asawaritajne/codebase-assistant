import type { ApiErrorKind } from "../api";

const TITLES: Record<ApiErrorKind, string> = {
  unreachable: "Can't reach the server",
  "rate-limited": "Rate limit reached",
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
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm">
      <p className="font-medium text-red-800">{TITLES[kind]}</p>
      <p className="mt-1 text-red-700">{message}</p>
      {retryable && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
        >
          Try again
        </button>
      )}
    </div>
  );
}
