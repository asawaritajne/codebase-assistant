import { useState, type FormEvent, type KeyboardEvent } from "react";

/** Matches the backend's limit on POST /ask. */
const MAX_QUESTION_LENGTH = 1000;

interface ComposerProps {
  onSubmit: (question: string) => void;
  /** True while an answer is in progress; typing stays allowed, sending doesn't. */
  busy: boolean;
  placeholder?: string;
}

export function Composer({ onSubmit, busy, placeholder = "Ask a question about the code…" }: ComposerProps) {
  const [value, setValue] = useState("");
  const question = value.trim();
  const canSubmit = question.length > 0 && !busy;
  const remaining = MAX_QUESTION_LENGTH - value.length;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSubmit) return;
    onSubmit(question);
    setValue("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <div className="flex items-end gap-2">
        <label htmlFor="question" className="sr-only">
          Ask a question about the codebase
        </label>
        <textarea
          id="question"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={MAX_QUESTION_LENGTH}
          placeholder={placeholder}
          className="max-h-40 min-h-11 flex-1 resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="h-11 shrink-0 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? "Answering…" : "Ask"}
        </button>
      </div>
      <p className="flex justify-between gap-4 text-xs text-slate-500">
        <span>Enter to ask · Shift+Enter for a new line</span>
        {remaining <= 100 && <span className={remaining === 0 ? "text-red-600" : undefined}>{remaining} characters left</span>}
      </p>
    </form>
  );
}
