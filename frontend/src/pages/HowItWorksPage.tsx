import { Link } from "react-router";
import { catalogTotals, formatNumber } from "../lib/format";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { useRepos } from "../repos/ReposContext";

interface Step {
  title: string;
  detail: string;
}

const INDEXING_STEPS: Step[] = [
  { title: "GitHub REST API", detail: "Source files and tests, the last 200 commits, and the last 100 merged pull requests." },
  { title: "Chunking", detail: "Code split at block boundaries and prose at paragraphs, about 350 tokens per chunk." },
  { title: "Gemini embeddings", detail: "Each chunk becomes a 768-number vector that captures its meaning." },
  { title: "Atlas Vector Search", detail: "Vectors indexed for cosine similarity, filterable by repository." },
];

const ANSWERING_STEPS: Step[] = [
  { title: "Your question", detail: "Embedded with the same model, so it can be compared with the chunks." },
  { title: "Vector search", detail: "The five closest chunks from the chosen repository are retrieved." },
  { title: "Grounded answer", detail: "Gemini answers from those chunks alone, citing a source for every claim." },
  { title: "Citation check", detail: "Citations are verified; a failing answer is rewritten or flagged." },
];

const SECTIONS = [
  {
    title: "Ingestion",
    paragraphs: [
      "A TypeScript service pulls each repository's code files and tests, its 200 most recent commits, and its 100 most recently merged pull requests through the GitHub REST API, and stores them in MongoDB exactly as written.",
      "Files are read at a pinned commit, so citation links keep pointing at the right lines even after the repository moves on. Re-running ingestion updates documents in place instead of duplicating them, and GitHub rate limits stop a run cleanly so it can resume later.",
    ],
  },
  {
    title: "Chunking",
    paragraphs: [
      "Search works best on small, self-contained pieces. Code is split where blocks begin, such as top-level declarations, functions, or individual test cases, and never in the middle of a line. Pieces too small to stand alone are merged into their neighbours.",
      "Commit messages and pull-request descriptions are split by paragraph, with leftover template comments removed. Every code chunk remembers its line range, which is what lets a citation open the exact lines on GitHub.",
    ],
  },
  {
    title: "Embeddings",
    paragraphs: [
      "Each chunk is converted into a vector with Google's gemini-embedding-2 model. Vectors are kept at 768 dimensions rather than the default 3,072, a quarter of the storage with little loss in search quality, which keeps the free database tier comfortable.",
      "Documents and questions are embedded with different task instructions, which improves how well questions match the code that answers them. Every document records a fingerprint of what was embedded, so later runs only process new or changed content.",
    ],
  },
  {
    title: "Retrieval",
    paragraphs: [
      "A question is embedded the same way, then MongoDB Atlas Vector Search compares it against about 100 candidate chunks and returns the five most similar. The search is pre-filtered to the repository you picked, so an Express question only ever sees Express code.",
    ],
  },
  {
    title: "Grounded generation",
    paragraphs: [
      "The retrieved chunks are numbered S1 to S5 and handed to Gemini with strict rules: use only these sources, cite a source for every claim, prefer code over tests and history when they disagree, and say plainly when the sources don't contain the answer.",
    ],
  },
  {
    title: "Verification",
    paragraphs: [
      "Before an answer reaches you, a checker reads it. If it cites a source that doesn't exist, or cites nothing, it's generated again with the problem spelled out. Anything still untraceable is shown with a warning, and statements without a citation are counted.",
      "Every question, answer, and citation report is logged so answer quality can be reviewed over time.",
    ],
  },
];

const CONSTRAINTS = [
  {
    title: "A daily embedding quota",
    body: "The free tier allows roughly 1,000 embeddings a day. Indexing runs work to a budget, resume where they stopped, and handle the smallest repositories first.",
  },
  {
    title: "A busy language model",
    body: "Gemini's free tier often answers “high demand”. Requests retry with exponential backoff, and a 45-second timeout stops one stuck request from hanging a question.",
  },
  {
    title: "GitHub rate limits",
    body: "Short secondary limits are waited out; an exhausted hourly quota stops the run cleanly, with everything already fetched saved.",
  },
  {
    title: "A 512 MB database",
    body: "Compact 768-dimension vectors keep every repository within the free MongoDB Atlas cluster, and dropped connections are retried automatically.",
  },
];

const STACK = [
  { layer: "Website", tech: "React 19, TypeScript, Tailwind CSS, Vite" },
  { layer: "API", tech: "Node.js, Express 5, TypeScript" },
  { layer: "Storage and search", tech: "MongoDB Atlas with Atlas Vector Search" },
  { layer: "Embeddings", tech: "Google Gemini · gemini-embedding-2 (768 dimensions)" },
  { layer: "Answers", tech: "Google Gemini · gemini-flash-latest" },
  { layer: "Source data", tech: "GitHub REST API" },
  { layer: "Testing", tech: "Node.js test runner" },
];

function Lane({ label, sublabel, steps }: { label: string; sublabel: string; steps: Step[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{label}</h3>
        <p className="text-xs text-slate-500">{sublabel}</p>
      </div>
      <ol className="mt-5 grid gap-4 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.title} className="relative rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="font-mono text-xs font-semibold text-indigo-600">{String(index + 1).padStart(2, "0")}</span>
            <p className="mt-1 text-sm font-semibold text-slate-900">{step.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{step.detail}</p>
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute -bottom-3.5 left-1/2 z-10 grid size-6 -translate-x-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 lg:top-1/2 lg:-right-3.5 lg:bottom-auto lg:left-auto lg:translate-x-0 lg:-translate-y-1/2"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5 rotate-90 lg:rotate-0">
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.17 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function HowItWorksPage() {
  useDocumentTitle("How it works");
  const { repos } = useRepos();
  const totals = repos ? catalogTotals(repos) : null;

  const liveStats = [
    { label: "Repositories", value: totals?.repos },
    { label: "Code files", value: totals?.files },
    { label: "Commits & PRs", value: totals?.history },
    { label: "Searchable chunks", value: totals?.chunks },
  ];

  return (
    <div>
      <header className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <p className="text-sm font-semibold text-indigo-600">How it works</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-balance text-slate-900 sm:text-4xl">
            A retrieval-augmented pipeline that has to show its sources
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-slate-600">
            Instead of answering from memory, the assistant first finds the parts of a real codebase that relate to your
            question, then writes an answer from those parts alone, and proves it with citations.
          </p>
          <dl className="mt-10 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
            {liveStats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <dt className="text-xs text-slate-500">{stat.label}</dt>
                <dd className="mt-1 text-xl font-semibold tracking-tight text-slate-900 tabular-nums">
                  {stat.value === undefined ? "…" : formatNumber(stat.value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">The pipeline</h2>
        <Lane label="Indexing" sublabel="Runs ahead of time, once per repository" steps={INDEXING_STEPS} />
        <Lane label="Answering" sublabel="Runs for every question, in seconds" steps={ANSWERING_STEPS} />
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Each stage in detail</h2>
          <div className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {SECTIONS.map((section, index) => (
              <article key={section.title}>
                <h3 className="flex items-baseline gap-3 font-semibold text-slate-900">
                  <span className="font-mono text-xs text-indigo-600">{String(index + 1).padStart(2, "0")}</span>
                  {section.title}
                </h3>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Built to run on free tiers</h2>
        <p className="mt-3 max-w-2xl text-slate-600">
          Every service here runs on a free plan, and each one has limits the design had to respect.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {CONSTRAINTS.map((constraint) => (
            <div key={constraint.title} className="rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">{constraint.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{constraint.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Tech stack</h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  Layer
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Technology
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {STACK.map((row) => (
                <tr key={row.layer}>
                  <th scope="row" className="px-5 py-3 font-medium whitespace-nowrap text-slate-900">
                    {row.layer}
                  </th>
                  <td className="px-5 py-3 text-slate-600">{row.tech}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-4">
          <Link to="/repos" className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">
            Try it on a repository
          </Link>
        </div>
      </section>
    </div>
  );
}
