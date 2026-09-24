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
      className="mx-0.5 rounded bg-glow/15 px-1 font-mono text-[0.7rem] font-semibold text-glow ring-1 ring-glow/30 hover:bg-glow/25"
    >
      {marker}
    </a>
  );
}

const code = "rounded bg-white/10 px-1 py-0.5 font-mono text-[0.8em] text-glow";

export function AnswerPreview() {
  return (
    <figure className="glass relative rounded-2xl p-5 shadow-2xl shadow-void/60 sm:p-6">
      <div aria-hidden="true" className="absolute -inset-8 -z-10 rounded-[3rem] bg-iris/20 blur-3xl" />
      <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-4">
        <div className="flex items-center gap-2.5">
          <RepoMark repoId="react-hook-form" name="React Hook Form" size="sm" />
          <div>
            <p className="text-sm font-medium text-chalk">React Hook Form</p>
            <p className="font-mono text-[0.7rem] text-mist/80">example answer</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 font-mono text-[0.7rem] font-medium text-emerald-300 ring-1 ring-emerald-400/25">
          citations checked
        </span>
      </div>

      <p className="mt-5 ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-sm bg-linear-to-r from-glow/20 to-iris/20 px-4 py-2.5 text-sm text-chalk ring-1 ring-white/10">
        How does the library decide whether a field is dirty?
      </p>

      <div className="mt-5 space-y-3 text-sm leading-relaxed text-chalk/85">
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

      <div className="mt-5 space-y-2 border-t border-white/8 pt-4">
        <p className="font-mono text-[0.7rem] tracking-wider text-mist/70 uppercase">sources</p>
        {SOURCES.map((source) => (
          <a
            key={source.marker}
            href={source.href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs transition-colors hover:border-glow/30 hover:bg-glow/5"
          >
            <span className="font-mono font-semibold text-glow">{source.marker}</span>
            <span className="min-w-0 truncate font-mono text-mist">{source.path}</span>
            <span className="ml-auto shrink-0 font-mono text-mist/60">L{source.lines}</span>
          </a>
        ))}
      </div>
      <figcaption className="sr-only">
        An example answer about React Hook Form, with each claim linked to the source file it came from.
      </figcaption>
    </figure>
  );
}
