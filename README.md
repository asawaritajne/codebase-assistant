# Codebase Q&A

Ask natural-language questions about real open-source codebases and get answers built **only** from
their actual source code, commit history, and pull requests, with every claim linked to the exact
lines on GitHub.

> "How does the library decide whether a field is dirty?"
>
> `getDirtyFields` compares the form's current values with its defaults and marks each field that
> differs as dirty **[S2]**. Array items that aren't dirty become `undefined`, and unchanged object
> keys are left out **[S1]**.
>
> Sources: `src/logic/getDirtyFields.ts` (lines 1–56), `src/__tests__/logic/getDirtyFields.test.ts` (lines 1–76)

This is a Retrieval-Augmented Generation (RAG) system: instead of answering from what a model
remembers, it retrieves relevant chunks of real code from a vector database and answers from those
alone, then verifies the citations before showing the answer.

## Indexed repositories

Thirteen widely used JavaScript and TypeScript projects, each indexed the same way: source code and
tests, the 200 most recent commits, and the 100 most recently merged pull requests.

| | | |
| --- | --- | --- |
| [react-hook-form](https://github.com/react-hook-form/react-hook-form) — forms | [zustand](https://github.com/pmndrs/zustand) — state | [express](https://github.com/expressjs/express) — web framework |
| [axios](https://github.com/axios/axios) — HTTP client | [vite](https://github.com/vitejs/vite) — build tool | [redux](https://github.com/reduxjs/redux) — state |
| [trpc](https://github.com/trpc/trpc) — RPC | [xstate](https://github.com/statelyai/xstate) — state machines | [tanstack/query](https://github.com/TanStack/query) — data fetching |
| [react-router](https://github.com/remix-run/react-router) — routing | [dayjs](https://github.com/iamkun/dayjs) — dates | [preact](https://github.com/preactjs/preact) — UI library |
| [zod](https://github.com/colinhacks/zod) — validation | | |

Adding another repository is one entry in [`backend/src/config/repos.ts`](backend/src/config/repos.ts),
followed by an ingestion and an embedding run.

## How it works

**Indexing** (ahead of time, once per repository)

```
GitHub REST API ──► raw_ingestion ──► chunker ──► Gemini embeddings ──► Atlas Vector Search
  files, tests,       (MongoDB,        code split     gemini-embedding-2      cosine index +
  commits, PRs         unmodified)     at block       768 dimensions          repo/type/test
                                       boundaries                             filters
```

**Answering** (per question, in seconds)

```
question ──► embed ──► vector search ──► Gemini answers ──► citation check ──► answer + sources
                       top 5 chunks,     from those          markers verified,
                       filtered by repo  chunks only         retried if invalid
```

Design decisions worth calling out:

- **Citations are enforced, not hoped for.** A checker parses every `[S1]`-style marker; an answer
  citing a source that doesn't exist, or citing nothing, is regenerated once with the problem spelled
  out, and anything still untraceable is flagged in the UI.
- **Links never rot.** Files are read at a pinned commit, so a citation always points at the lines
  that were actually indexed.
- **Chunks follow the code's structure.** Code splits at block boundaries (top-level declarations,
  functions, individual test cases), never mid-line; prose splits at paragraphs.
- **Everything is resumable.** Each document stores a fingerprint of what was embedded, so runs only
  process new or changed content and can stop and continue across days.
- **Built for free tiers.** Rate limits, daily quotas, "high demand" 503s, request timeouts, and
  dropped database connections are all handled explicitly rather than crashing a run. Generation
  falls back across several Gemini models when one is overloaded.
- **Conversations, not one-shots.** Follow-up questions carry the last few turns, and the previous
  question rides along with the search so “and what about caching?” retrieves the right chunks.
- **Every answer is linkable.** Answers are stored and served at `/a/<id>` with their sources, so one
  can be shared with a teammate intact.
- **The index is visible.** Every embedded chunk is projected from 768 dimensions to 3 with PCA and
  rendered as an interactive point cloud, so “search by meaning” is something you can look at — and a
  live question can be placed in that same space, lit up against the chunks it retrieves.
- **Retrieval is benchmarked, not asserted.** 33 hand-written questions each name, in advance, the
  file that genuinely answers them; retrieval either finds it or it doesn't, scored with hit@k and
  MRR. No model takes part, so nothing can be argued into being right afterwards. `/evaluation`
  publishes every case, misses included.
- **The benchmark found a real bug.** Four questions retrieved nothing but test files — a test named
  `persistSync.test.tsx` outranks the implementation it tests, because it restates the question.
  Retrieval now reserves slots for non-test code (`NON_TEST_FLOOR`), so an answer always has an
  implementation to cite.
- **Re-running it is free.** Benchmark question vectors are cached, so iterating on retrieval costs
  no embedding quota — an evaluation you can't afford to re-run is one you stop using.
- **Answers are logged and rated.** Every answer is stored with its citation report, timings, and the
  model that produced it, and readers can rate it; the aggregate is served at `/quality` and shown
  under the benchmark as a secondary record.
- **The diagrams carry real data.** The 3D answering pipeline is sized by what actually flows through
  it: the search stage holds the whole index, the answer stage holds five sources, and the numbers
  under each stage come from the live system rather than the copy.

## Tech stack

| Layer | Technology |
| --- | --- |
| Website | React 19, TypeScript, Tailwind CSS 4, Vite, React Router |
| API | Node.js, Express 5, TypeScript |
| Storage & search | MongoDB Atlas (free M0) with Atlas Vector Search |
| Embeddings | Google Gemini `gemini-embedding-2` (768 dimensions) |
| Answers | Google Gemini `gemini-flash-latest` |
| Source data | GitHub REST API |
| Tests | Node.js built-in test runner |

## Running it locally

**Prerequisites:** Node.js 20.19+, a MongoDB Atlas cluster, a Google Gemini API key
([aistudio.google.com](https://aistudio.google.com), no billing required), and a GitHub personal
access token with `public_repo` scope.

1. **Configure secrets.** Copy `.env.example` to `.env` in the repository root and fill in
   `GITHUB_TOKEN`, `MONGODB_URI`, and `GEMINI_API_KEY`.

2. **Install dependencies.**

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. **Pull the repositories' data into MongoDB** (GitHub API only, no AI quota used):

   ```bash
   cd backend && npm run ingest              # every configured repo
   npm run ingest -- --repo express          # or just one
   ```

4. **Create the Atlas Vector Search index.** This step can't be done from the driver. In Atlas:
   Search & Vector Search → Create Search Index → **Vector Search** → JSON Editor, on database
   `codebase_assistant`, collection `embedded_chunks`, named **`vector_index`**, using
   [`backend/atlas/embedded_chunks.vector-index.json`](backend/atlas/embedded_chunks.vector-index.json).

5. **Embed the chunks.** Gemini's free tier allows roughly 1,000 embeddings a day, so runs are
   budgeted and resumable — run this once a day until nothing is pending:

   ```bash
   npm run embed -- --dry-run                # see what's pending, calls nothing
   npm run embed                             # up to 750 chunks, then stops
   npm run embed -- --repo vite --max-chunks 200
   ```

6. **Build the 3D map** of the embeddings for the website's visualization (re-run it after each
   embedding run):

   ```bash
   npm run map
   ```

   Indexing a large catalogue takes several days of budgeted runs, so
   [`backend/scripts/daily-embed.sh`](backend/scripts/daily-embed.sh) does both steps unattended.
   On macOS, install it as a daily job:

   ```bash
   chmod +x backend/scripts/daily-embed.sh
   cp backend/scripts/com.codebase-assistant.embed.plist ~/Library/LaunchAgents/
   launchctl bootstrap "gui/$UID" ~/Library/LaunchAgents/com.codebase-assistant.embed.plist
   # progress: tail -f ~/Library/Logs/codebase-assistant-embed.log
   # stop:     launchctl bootout "gui/$UID/com.codebase-assistant.embed"
   ```

7. **Start both servers.**

   ```bash
   cd backend && npm run dev                 # http://localhost:3001
   cd frontend && npm run dev                # http://localhost:5173
   ```

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Liveness check |
| `GET /repos` | Repository catalog with live indexing stats |
| `GET /embedding-map` | Every chunk's 3D position, for the visualization |
| `POST /ask` | `{ "repo", "question", "history" }` → answer, sources, citation report, share id |
| `GET /answers/:id` | One stored answer with its sources, behind every share link |
| `POST /embedding-map/query` | Places a question in the 3D map and names the chunks it retrieves |
| `GET /evaluation` | The latest retrieval benchmark run, with every case's result |
| `GET /quality` | Aggregate answer quality: citations, regenerations, latency, ratings |
| `POST /answers/:id/feedback` | `{ "rating": "up" \| "down" }` → records a reader's verdict |
| `POST /ingest/:repoId` | Re-ingest one repository (protect before deploying) |

## Project layout

```
backend/
  src/config/      environment + the repository catalog
  src/ingestion/   GitHub API client, fetchers, raw storage
  src/embedding/   chunker, Gemini embedder, vector storage
  src/retrieval/   Atlas Vector Search queries
  src/generation/  prompt + answer generation
  src/qa/          the RAG pipeline, citation checking, query history, quality metrics
  src/eval/        the retrieval benchmark: golden questions, scoring, stored runs
  src/visualization/  PCA projection of embeddings to 3D
  src/routes/      Express routes
frontend/
  src/pages/       home, repositories, ask, how it works, evaluation
  src/components/  layout, repo index, answer rendering, sources, feedback
  src/galaxy/      the 3D embedding visualization (three.js, lazy-loaded)
```

## Tests

```bash
cd backend && npm test        # citation parsing, retrieval merging, scoring — 39 tests
npm run typecheck             # both backend and frontend
```

### The retrieval benchmark

```bash
cd backend && npm run eval               # every repository
npm run eval -- --repo express           # one of them
npm run eval -- --dry-run                # print the scoreboard without storing it
```

Each case names the file that answers its question, and the run reports where retrieval actually
put it:

```
#1     axios-settle        lib/core/settle.js
MISS   zustand-persist     src/middleware/persist.ts

33 cases · hit@1 54.5% · hit@3 84.8% · hit@5 87.9% · MRR 0.694 · 4 missed
```

Questions are embedded once and cached, so later runs cost no quota. The daily job re-runs it, which
keeps the scoreboard honest as more of the catalogue finishes indexing.

## Roadmap

- Optional Java Spring Boot microservice for the retrieval step
- Deployment: backend on Render, frontend on Vercel
- Authentication on the ingestion endpoint and rate limiting on questions
