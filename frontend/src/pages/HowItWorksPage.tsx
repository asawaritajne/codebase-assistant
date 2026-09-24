import { Link } from "react-router";
import { Reveal } from "../components/Reveal";
import { GalaxySection } from "../galaxy/GalaxySection";
import { Pipeline3D, type PipelineStage } from "../galaxy/Pipeline3D";
import { catalogTotals, formatNumber } from "../lib/format";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { useRepos } from "../repos/ReposContext";

const INDEXING_STAGES: PipelineStage[] = [
  { title: "GitHub REST API", detail: "Source files and tests, the last 200 commits, and the last 100 merged pull requests." },
  { title: "Chunking", detail: "Code split at block boundaries and prose at paragraphs, about 350 tokens per chunk." },
  { title: "Gemini embeddings", detail: "Each chunk becomes a 768-number vector that captures its meaning." },
  { title: "Atlas Vector Search", detail: "Vectors indexed for cosine similarity, filterable by repository." },
];

const ANSWERING_STAGES: PipelineStage[] = [
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
      "Search works best on small, self-contained pieces. Code is split where blocks begin — top-level declarations, functions, individual test cases — and never in the middle of a line. Pieces too small to stand alone are merged into their neighbours.",
      "Commit messages and pull-request descriptions are split by paragraph, with leftover template comments removed. Every code chunk remembers its line range, which is what lets a citation open the exact lines on GitHub.",
    ],
  },
  {
    title: "Embeddings",
    paragraphs: [
      "Each chunk becomes a vector with Google's gemini-embedding-2 model, kept at 768 dimensions rather than the default 3,072 — a quarter of the storage with little loss in search quality, which keeps the free database tier comfortable.",
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
      "The free tier's main model is often overloaded, so generation falls back across several Gemini models within a time budget rather than failing the question.",
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
    body: "Gemini's free tier often answers “high demand”. Requests retry with backoff, fall back to other models, and time out rather than hanging a question.",
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
  { layer: "Interface", tech: "React 19, TypeScript, Tailwind CSS, Vite, React Router" },
  { layer: "3D", tech: "three.js via React Three Fiber" },
  { layer: "API", tech: "Node.js, Express 5, TypeScript" },
  { layer: "Storage and search", tech: "MongoDB Atlas with Atlas Vector Search" },
  { layer: "Embeddings", tech: "Google Gemini · gemini-embedding-2 (768 dimensions)" },
  { layer: "Answers", tech: "Google Gemini · flash models with fallback" },
  { layer: "Source data", tech: "GitHub REST API" },
];

export function HowItWorksPage() {
  useDocumentTitle("How it works");
  const { repos } = useRepos();
  const totals = repos ? catalogTotals(repos) : null;

  const liveStats = [
    { label: "repositories", value: totals?.repos },
    { label: "code files", value: totals?.files },
    { label: "commits & PRs", value: totals?.history },
    { label: "searchable chunks", value: totals?.chunks },
  ];

  return (
    <div>
      <header className="relative overflow-hidden border-b border-white/5">
        <div aria-hidden="true" className="bg-grid absolute inset-0 opacity-40 mask-[radial-gradient(70%_70%_at_30%_0%,black,transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
          <Reveal>
            <p className="font-mono text-xs tracking-[0.2em] text-glow uppercase">How it works</p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight text-balance text-chalk sm:text-5xl">
              A retrieval pipeline that has to <span className="text-aurora">show its sources</span>
            </h1>
            <p className="mt-5 max-w-2xl leading-relaxed text-mist">
              Instead of answering from memory, the assistant finds the parts of a real codebase that relate to your
              question, writes an answer from those parts alone, and proves it with citations.
            </p>
            <dl className="mt-10 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
              {liveStats.map((stat) => (
                <div key={stat.label} className="glass rounded-xl px-4 py-3">
                  <dd className="font-display text-2xl font-semibold tracking-tight text-chalk tabular-nums">
                    {stat.value === undefined ? "—" : formatNumber(stat.value)}
                  </dd>
                  <dt className="mt-1 font-mono text-[0.7rem] tracking-wider text-mist/80 uppercase">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-chalk">Indexing, ahead of time</h2>
          <p className="mt-2 text-sm text-mist">Runs once per repository, in batches budgeted against the daily quota.</p>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INDEXING_STAGES.map((stage, index) => (
              <li key={stage.title} className="glass glass-hover relative rounded-2xl p-5">
                <span className="font-mono text-xs text-glow">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-1.5 font-display text-sm font-semibold text-chalk">{stage.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-mist">{stage.detail}</p>
                {index < INDEXING_STAGES.length - 1 && (
                  <span aria-hidden="true" className="absolute top-1/2 -right-2.5 hidden text-mist/50 lg:block">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal className="mt-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-chalk">Answering, per question</h2>
          <p className="mt-2 text-sm text-mist">
            Runs in seconds, every time you ask. Each sphere below is a stage; the motes travelling between them are chunks
            of your repository moving through the pipeline.
          </p>
          <div className="mt-6">
            <Pipeline3D stages={ANSWERING_STAGES} />
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <Reveal>
          <GalaxySection
            heading="What “searching by meaning” actually looks like"
            intro="Retrieval doesn't match words; it matches positions in this space. Your question lands in the same space, and the nearest motes become the sources for its answer. Highlight a repository to see how its code, history, and discussions group together."
          />
        </Reveal>
      </section>

      <section className="relative border-y border-white/5 bg-deep/50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-chalk">Each stage in detail</h2>
          </Reveal>
          <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {SECTIONS.map((section, index) => (
              <Reveal key={section.title} delay={(index % 2) * 80}>
                <article>
                  <h3 className="flex items-baseline gap-3 font-display font-semibold text-chalk">
                    <span className="font-mono text-xs text-glow">{String(index + 1).padStart(2, "0")}</span>
                    {section.title}
                  </h3>
                  <div className="mt-3 space-y-3 text-sm leading-relaxed text-mist">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                    ))}
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-chalk">Built to run on free tiers</h2>
          <p className="mt-3 max-w-2xl text-mist">
            Every service here runs on a free plan, and each one has limits the design had to respect.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {CONSTRAINTS.map((constraint, index) => (
            <Reveal key={constraint.title} delay={(index % 2) * 80}>
              <div className="glass glass-hover h-full rounded-2xl p-6">
                <h3 className="font-display font-semibold text-chalk">{constraint.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist">{constraint.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-chalk">Tech stack</h2>
          <div className="glass mt-6 overflow-x-auto rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/8 font-mono text-[0.7rem] tracking-wider text-mist/80 uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Layer
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Technology
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {STACK.map((row) => (
                  <tr key={row.layer}>
                    <th scope="row" className="px-5 py-3 font-medium whitespace-nowrap text-chalk">
                      {row.layer}
                    </th>
                    <td className="px-5 py-3 text-mist">{row.tech}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-12">
            <Link
              to="/repos"
              className="rounded-xl bg-linear-to-r from-glow to-iris px-6 py-3.5 text-sm font-semibold text-void transition-transform hover:-translate-y-0.5"
            >
              Try it on a repository
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
