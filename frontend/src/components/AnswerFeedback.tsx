import { useState } from "react";
import { sendFeedback } from "../api";
import type { Rating } from "../types";

const THUMB_UP = "M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.04 9.04 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.5 4.5 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.5 4.5 0 0 0-1.423-.23H5.904M6.633 10.25a2.25 2.25 0 0 1-2.25 2.25H3.75a2.25 2.25 0 0 1 0-4.5h.633M6.633 10.25v8.25";
const THUMB_DOWN = "M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 0 1-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398C20.613 14.547 19.833 15 19 15h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 0 0 .303-.54m.023-8.25H16.48a4.5 4.5 0 0 1-1.423-.23l-3.114-1.04a4.5 4.5 0 0 0-1.423-.23H6.504c-.618 0-1.217.247-1.605.729A11.95 11.95 0 0 0 2.25 12c0 .434.023.863.068 1.285C2.427 14.306 3.346 15 4.372 15h3.126c.618 0 .991.724.725 1.282A7.47 7.47 0 0 0 7.5 19.5a2.25 2.25 0 0 0 2.25 2.25.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384";

function Thumb({
  rating,
  chosen,
  disabled,
  onChoose,
}: {
  rating: Rating;
  chosen: Rating | null;
  disabled: boolean;
  onChoose: (rating: Rating) => void;
}) {
  const active = chosen === rating;
  const tone = rating === "up" ? "text-emerald-300" : "text-ember";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={() => onChoose(rating)}
      title={rating === "up" ? "This answer was useful" : "This answer missed the point"}
      className={`grid size-7 place-items-center rounded-lg transition-colors disabled:cursor-not-allowed ${
        active ? tone : "text-mist/60 hover:bg-white/5 hover:text-chalk"
      }`}
    >
      <span className="sr-only">{rating === "up" ? "Helpful" : "Not helpful"}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
      >
        <path d={rating === "up" ? THUMB_UP : THUMB_DOWN} />
      </svg>
    </button>
  );
}

/**
 * Was this answer useful? The verdict is stored against the answer's id, which is what the quality
 * dashboard reads. Failures are swallowed — a rating that doesn't save is not the reader's problem.
 */
export function AnswerFeedback({ shareId }: { shareId: string }) {
  const [chosen, setChosen] = useState<Rating | null>(null);
  const [sending, setSending] = useState(false);

  const choose = (rating: Rating) => {
    setChosen(rating);
    setSending(true);
    void sendFeedback(shareId, rating)
      .catch(() => setChosen(null))
      .finally(() => setSending(false));
  };

  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 font-mono text-[0.7rem] text-mist/60">{chosen ? "thanks" : "useful?"}</span>
      <Thumb rating="up" chosen={chosen} disabled={sending} onChoose={choose} />
      <Thumb rating="down" chosen={chosen} disabled={sending} onChoose={choose} />
    </div>
  );
}
