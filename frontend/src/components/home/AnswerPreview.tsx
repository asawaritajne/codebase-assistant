import { RepoMark } from "../repos/RepoMark";

// Paraphrased from a real answer the assistant gave about React Hook Form, with the sources it cited.
const BLOB = "https://github.com/react-hook-form/react-hook-form/blob/65a448d7901a728e23b83ccdb43aa24dfeb402db";
const SOURCES = [
  {
    marker: "S1",
    path: "src/__tests__/logic/getDirtyFields.test.ts",
    lines: "1–76",
    href: `${BLOB}/src/__tests__/logic/getDirtyFields.test.ts#L1-L76`,
  },
  {
    marker: "S2",
    path: "src/logic/getDirtyFields.ts",
    lines: "1–56",
    href: `${BLOB}/src/logic/getDirtyFields.ts#L1-L56`,
  },
];

function Citation({ marker }: { marker: string }) {
  const source = SOURCES.find((candidate) => candidate.marker === marker)!;
  return (
    <a
      href={source.href}
      target="_blank"
      rel="noreferrer"
      title={`${source.path} (lines ${source.lines})`}
      className="mx-0.5 rounded bg-indigo-50 px-1 font-mono text-[0.7rem] font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100"
    >
      {marker}
    </a>
  );
}

const code = "rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.8em] text-slate-800";

export function AnswerPreview() {
  return (
    <figure className="relative">
      <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-linear-to-br from-indigo-200/60 via-white to-rose-100/70 blur-2xl" />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <RepoMark repoId="react-hook-form" name="React Hook Form" size="sm" />
            <div>
              <p className="text-sm font-semibold text-slate-900">React Hook Form</p>
              <p className="text-xs text-slate-500">Example answer</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            Citations checked
          </span>
        </div>

        <p className="mt-5 ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-sm bg-slate-900 px-4 py-2.5 text-sm text-white">
          How does the library decide whether a field is dirty?
        </p>

        <div className="mt-5 space-y-3 text-sm leading-relaxed text-slate-700">
          <p>
            <code className={code}>getDirtyFields</code> compares the form's current values with its defaults and marks each
            field that differs as dirty with <code className={code}>true</code>
            <Citation marker="S2" />.
          </p>
          <p>
            Registered array fields are treated as a single value instead of being compared item by item
            <Citation marker="S2" />.
          </p>
          <p>
            Array items that aren't dirty become <code className={code}>undefined</code>, and unchanged object keys are left out
            <Citation marker="S1" />.
          </p>
        </div>

        <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-500">Sources</p>
          {SOURCES.map((source) => (
            <a
              key={source.marker}
              href={source.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs transition-colors hover:border-indigo-200 hover:bg-indigo-50/50"
            >
              <span className="font-mono font-semibold text-indigo-700">{source.marker}</span>
              <span className="min-w-0 truncate font-mono text-slate-700">{source.path}</span>
              <span className="ml-auto shrink-0 text-slate-400">lines {source.lines}</span>
            </a>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">
        An example answer about React Hook Form, with each claim linked to the source file it came from.
      </figcaption>
    </figure>
  );
}
