import type { IngestionOptions } from "../ingestion/types.js";

export interface RepoConfig {
  /** URL-safe id used by the API and the website, e.g. "express". */
  id: string;
  /** GitHub "owner/name"; also the `repo` value stored on every document and chunk. */
  fullName: string;
  name: string;
  /** Short label for what kind of library it is. */
  category: string;
  description: string;
  /** Code files under these directories are ingested; test files are included and flagged. */
  sourceDirs: string[];
  commitLimit: number;
  pullRequestLimit: number;
  /** Starter questions the website offers; each should be answerable from the ingested code. */
  exampleQuestions: string[];
}

/**
 * Every repository the assistant can answer questions about. Order matters: embedding runs work
 * through repos in this order, so smaller repos come first and become usable sooner.
 */
export const REPOS: RepoConfig[] = [
  {
    id: "react-hook-form",
    fullName: "react-hook-form/react-hook-form",
    name: "React Hook Form",
    category: "Forms",
    description: "Performant, flexible forms with easy-to-use validation for React.",
    sourceDirs: ["src"],
    commitLimit: 200,
    pullRequestLimit: 100,
    exampleQuestions: [
      "How does field validation work in this library?",
      "How does useFieldArray keep track of its fields?",
      "How does the library decide whether a field is dirty?",
      "What changed recently in how forms are submitted?",
    ],
  },
  {
    id: "zustand",
    fullName: "pmndrs/zustand",
    name: "Zustand",
    category: "State management",
    description: "Small, fast, and scalable state management for React.",
    sourceDirs: ["src", "tests"],
    commitLimit: 200,
    pullRequestLimit: 100,
    exampleQuestions: [
      "How does create() build a store and notify subscribers?",
      "How does the persist middleware save and rehydrate state?",
      "How does useStore avoid unnecessary re-renders?",
      "What does the devtools middleware do?",
    ],
  },
  {
    id: "express",
    fullName: "expressjs/express",
    name: "Express",
    category: "Web framework",
    description: "Fast, unopinionated, minimalist web framework for Node.js.",
    sourceDirs: ["lib", "test"],
    commitLimit: 200,
    pullRequestLimit: 100,
    exampleQuestions: [
      "How does res.send decide what Content-Type to use?",
      "How does app.listen start the server?",
      "How does res.redirect work?",
      "How are errors passed to error-handling middleware?",
    ],
  },
  {
    id: "axios",
    fullName: "axios/axios",
    name: "Axios",
    category: "HTTP client",
    description: "Promise-based HTTP client for the browser and Node.js.",
    sourceDirs: ["lib", "tests"],
    commitLimit: 200,
    pullRequestLimit: 100,
    exampleQuestions: [
      "How do request and response interceptors work?",
      "How does axios cancel a request?",
      "How are request configs merged with the defaults?",
      "How does the Node.js HTTP adapter follow redirects?",
    ],
  },
  {
    id: "redux",
    fullName: "reduxjs/redux",
    name: "Redux",
    category: "State management",
    description: "A predictable state container for JavaScript apps.",
    sourceDirs: ["src", "test"],
    commitLimit: 200,
    pullRequestLimit: 100,
    exampleQuestions: [
      "How does createStore handle dispatch and subscribers?",
      "What does combineReducers do with unexpected state keys?",
      "How does applyMiddleware wrap dispatch?",
      "How does replaceReducer swap the reducer at runtime?",
    ],
  },
  {
    id: "trpc",
    fullName: "trpc/trpc",
    name: "tRPC",
    category: "RPC framework",
    description: "End-to-end typesafe APIs without schemas or code generation.",
    sourceDirs: ["packages/server/src"],
    commitLimit: 200,
    pullRequestLimit: 100,
    exampleQuestions: [
      "How does the server build a router from procedures?",
      "How are input validators applied to a procedure?",
      "How does middleware chaining work?",
      "How are errors formatted before they're returned?",
    ],
  },
  {
    id: "xstate",
    fullName: "statelyai/xstate",
    name: "XState",
    category: "State machines",
    description: "State machines and statecharts for the modern web.",
    sourceDirs: ["packages/core/src"],
    commitLimit: 200,
    pullRequestLimit: 100,
    exampleQuestions: [
      "How does a machine transition between states?",
      "How do guards decide whether a transition happens?",
      "How are actions executed during a transition?",
      "How is a machine's initial state computed?",
    ],
  },
  {
    id: "tanstack-query",
    fullName: "TanStack/query",
    name: "TanStack Query",
    category: "Data fetching",
    description: "Asynchronous state management, caching, and data fetching.",
    sourceDirs: ["packages/query-core/src"],
    commitLimit: 200,
    pullRequestLimit: 100,
    exampleQuestions: [
      "How does the query cache decide whether data is stale?",
      "How are retries and backoff handled?",
      "How does query invalidation work?",
      "How are duplicate requests deduplicated?",
    ],
  },
  {
    id: "react-router",
    fullName: "remix-run/react-router",
    name: "React Router",
    category: "Routing",
    description: "Declarative routing for React applications.",
    sourceDirs: ["packages/react-router/lib"],
    commitLimit: 200,
    pullRequestLimit: 100,
    exampleQuestions: [
      "How does the router match a URL to a route?",
      "How do nested routes resolve their paths?",
      "How does navigation update the history stack?",
      "How are route params parsed from a path?",
    ],
  },
  {
    id: "dayjs",
    fullName: "iamkun/dayjs",
    name: "Day.js",
    category: "Dates",
    description: "A 2KB immutable date library with a Moment.js-compatible API.",
    sourceDirs: ["src", "test"],
    commitLimit: 200,
    pullRequestLimit: 100,
    exampleQuestions: [
      "How does Day.js parse a date string?",
      "How does the format method build its output?",
      "How do plugins extend the Dayjs prototype?",
      "How is UTC handling implemented?",
    ],
  },
  {
    id: "preact",
    fullName: "preactjs/preact",
    name: "Preact",
    category: "UI library",
    description: "A fast 3KB alternative to React with the same modern API.",
    sourceDirs: ["src", "test"],
    commitLimit: 200,
    pullRequestLimit: 100,
    exampleQuestions: [
      "How does Preact diff virtual DOM nodes?",
      "How are hooks stored between renders?",
      "How does the re-render queue work?",
      "How are event listeners attached to DOM nodes?",
    ],
  },
  {
    id: "zod",
    fullName: "colinhacks/zod",
    name: "Zod",
    category: "Validation",
    description: "TypeScript-first schema validation with static type inference.",
    sourceDirs: ["packages/zod/src"],
    commitLimit: 200,
    pullRequestLimit: 100,
    exampleQuestions: [
      "How does a schema parse and validate a value?",
      "How are validation errors collected and reported?",
      "How does .refine() add custom validation?",
      "How do object schemas handle unknown keys?",
    ],
  },
  {
    id: "vite",
    fullName: "vitejs/vite",
    name: "Vite",
    category: "Build tool",
    description: "Next-generation frontend tooling with a fast dev server and optimized builds.",
    sourceDirs: ["packages/vite/src"],
    commitLimit: 200,
    pullRequestLimit: 100,
    exampleQuestions: [
      "How does Vite's hot module replacement work?",
      "How does dependency pre-bundling work?",
      "How are CSS imports processed?",
      "How does the dev server transform a requested module?",
    ],
  },
];

export function findRepo(id: string): RepoConfig | undefined {
  return REPOS.find((repo) => repo.id === id);
}

export function ingestionOptionsFor(repo: RepoConfig): IngestionOptions {
  return {
    repo: repo.fullName,
    sourceDirs: repo.sourceDirs,
    commitLimit: repo.commitLimit,
    pullRequestLimit: repo.pullRequestLimit,
  };
}
