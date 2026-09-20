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

| Repository | What it is | Indexed |
| --- | --- | --- |
| [react-hook-form](https://github.com/react-hook-form/react-hook-form) | Forms for React | source + tests, 200 commits, 100 merged PRs |
| [pmndrs/zustand](https://github.com/pmndrs/zustand) | State management | same |
| [expressjs/express](https://github.com/expressjs/express) | Web framework | same |
| [axios/axios](https://github.com/axios/axios) | HTTP client | same |
| [vitejs/vite](https://github.com/vitejs/vite) | Build tool | same |

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
  dropped database connections are all handled explicitly rather than crashing a run.

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

6. **Start both servers.**

   ```bash
   cd backend && npm run dev                 # http://localhost:3001
   cd frontend && npm run dev                # http://localhost:5173
   ```

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Liveness check |
| `GET /repos` | Repository catalog with live indexing stats |
| `POST /ask` | `{ "repo": "express", "question": "..." }` → answer, sources, citation report |
| `POST /ingest/:repoId` | Re-ingest one repository (protect before deploying) |

## Project layout

```
backend/
  src/config/      environment + the repository catalog
  src/ingestion/   GitHub API client, fetchers, raw storage
  src/embedding/   chunker, Gemini embedder, vector storage
  src/retrieval/   Atlas Vector Search queries
  src/generation/  prompt + answer generation
  src/qa/          the RAG pipeline, citation checking, query history
  src/routes/      Express routes
frontend/
  src/pages/       home, repositories, ask, how it works
  src/components/  layout, repo cards, answer rendering, sources panel
```

## Tests

```bash
cd backend && npm test        # citation parsing + regeneration logic
npm run typecheck             # both backend and frontend
```

## Roadmap

- Optional Java Spring Boot microservice for the retrieval step
- Deployment: backend on Render, frontend on Vercel
- Authentication on the ingestion endpoint and rate limiting on questions
