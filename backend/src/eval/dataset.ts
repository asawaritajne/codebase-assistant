/**
 * A hand-written benchmark for retrieval.
 *
 * Each case names, in advance, the file that genuinely answers the question. Retrieval either finds
 * it in the top results or it doesn't — no model is involved and nothing here can be argued into
 * being right after the fact. Cases were written by reading the indexed repositories, and `expect`
 * lists every file that would be a fair answer, so a correct-but-different location isn't punished.
 */
export interface EvalCase {
  /** Stable id, so a case can be followed across runs. */
  id: string;
  repoId: string;
  question: string;
  /** Files that count as finding the answer; any one of them is a hit. */
  expect: string[];
  /** Why that is the right file — shown next to the result. */
  because: string;
}

export const EVAL_CASES: EvalCase[] = [
  // react-hook-form
  {
    id: "rhf-register",
    repoId: "react-hook-form",
    question: "How does register connect an input element to the form?",
    expect: ["src/logic/createFormControl.ts"],
    because: "register is defined inside createFormControl, which owns the field registry.",
  },
  {
    id: "rhf-validate",
    repoId: "react-hook-form",
    question: "Where are a field's validation rules actually run against its value?",
    expect: ["src/logic/validateField.ts"],
    because: "validateField applies required, min, max, pattern, and custom validators to one field.",
  },
  {
    id: "rhf-field-array",
    repoId: "react-hook-form",
    question: "How does appending an item to a field array update the form state?",
    expect: ["src/useFieldArray.ts"],
    because: "useFieldArray implements append and the state updates that follow it.",
  },
  {
    id: "rhf-controller",
    repoId: "react-hook-form",
    question: "How is a controlled third-party input wired into the form?",
    expect: ["src/controller.tsx", "src/useController.ts"],
    because: "Controller and useController exist for exactly this case.",
  },
  {
    id: "rhf-get-path",
    repoId: "react-hook-form",
    question: "How is a value read from nested state using a dotted path like user.address.city?",
    expect: ["src/utils/get.ts"],
    because: "get walks an object by a dotted or bracketed path.",
  },

  // axios
  {
    id: "axios-adapter",
    repoId: "axios",
    question: "How does axios decide which adapter handles a request?",
    expect: ["lib/adapters/adapters.js"],
    because: "adapters.js resolves the configured adapter and reports why one isn't supported.",
  },
  {
    id: "axios-interceptors",
    repoId: "axios",
    question: "How are request and response interceptors registered and stored?",
    expect: ["lib/core/InterceptorManager.js"],
    because: "InterceptorManager holds the handler list that use() adds to.",
  },
  {
    id: "axios-cancel",
    repoId: "axios",
    question: "How does cancelling a request with a cancel token work?",
    expect: ["lib/cancel/CancelToken.js"],
    because: "CancelToken implements the token, its promise, and the cancel function.",
  },
  {
    id: "axios-full-url",
    repoId: "axios",
    question: "How is the full request URL built from baseURL and a relative url?",
    expect: ["lib/core/buildFullPath.js", "lib/helpers/combineURLs.js"],
    because: "buildFullPath combines the two, delegating the join to combineURLs.",
  },
  {
    id: "axios-settle",
    repoId: "axios",
    question: "What decides whether a response is resolved or rejected based on its status code?",
    expect: ["lib/core/settle.js"],
    because: "settle applies validateStatus and rejects with an AxiosError.",
  },
  {
    id: "axios-headers",
    repoId: "axios",
    question: "How are header names normalized so that Content-Type and content-type are the same header?",
    expect: ["lib/core/AxiosHeaders.js"],
    because: "AxiosHeaders normalizes header keys and holds the header store.",
  },

  // express
  {
    id: "express-send-type",
    repoId: "express",
    question: "How does res.send decide what Content-Type to set?",
    expect: ["lib/response.js"],
    because: "res.send and its type handling live in the response prototype.",
  },
  {
    id: "express-listen",
    repoId: "express",
    question: "What does app.listen actually do?",
    expect: ["lib/application.js"],
    because: "listen is defined on the application prototype.",
  },
  {
    id: "express-trust-proxy",
    repoId: "express",
    question: "How is the client IP determined when the app is behind a proxy?",
    expect: ["lib/request.js"],
    because: "req.ip reads the trust proxy setting and the forwarded headers.",
  },
  {
    id: "express-view",
    repoId: "express",
    question: "How is a view template file located and rendered?",
    expect: ["lib/view.js"],
    because: "The View class resolves the template path and calls the engine.",
  },

  // zustand
  {
    id: "zustand-store",
    repoId: "zustand",
    question: "How does setState notify subscribers when the state changes?",
    expect: ["src/vanilla.ts"],
    because: "createStore in vanilla.ts holds the listener set and calls it on setState.",
  },
  {
    id: "zustand-persist",
    repoId: "zustand",
    question: "How does saved state get rehydrated into the store on startup?",
    expect: ["src/middleware/persist.ts"],
    because: "The persist middleware implements hydration and its lifecycle.",
  },
  {
    id: "zustand-react",
    repoId: "zustand",
    question: "How does a React component subscribe to the store and re-render?",
    expect: ["src/react.ts", "src/traditional.ts"],
    because: "useStore binds the store to React through useSyncExternalStore.",
  },
  {
    id: "zustand-shallow",
    repoId: "zustand",
    question: "How does the shallow equality check compare two values?",
    expect: ["src/vanilla/shallow.ts", "src/shallow.ts"],
    because: "shallow.ts implements the one-level comparison.",
  },

  // redux
  {
    id: "redux-dispatch",
    repoId: "redux",
    question: "How does dispatching an action notify the store's subscribers?",
    expect: ["src/createStore.ts"],
    because: "createStore holds the listener list and calls it after the reducer runs.",
  },
  {
    id: "redux-middleware",
    repoId: "redux",
    question: "How does middleware wrap dispatch?",
    expect: ["src/applyMiddleware.ts"],
    because: "applyMiddleware composes the middleware chain around dispatch.",
  },
  {
    id: "redux-combine",
    repoId: "redux",
    question: "How are several reducers combined into one root reducer?",
    expect: ["src/combineReducers.ts"],
    because: "combineReducers builds the root reducer and validates its shape.",
  },
  {
    id: "redux-plain-object",
    repoId: "redux",
    question: "How does Redux check that an action is a plain object?",
    expect: ["src/utils/isPlainObject.ts", "src/utils/isAction.ts"],
    because: "isPlainObject is the prototype check isAction relies on.",
  },

  // vite
  {
    id: "vite-prebundle",
    repoId: "vite",
    question: "How does Vite find which dependencies need pre-bundling?",
    expect: ["packages/vite/src/node/optimizer/scan.ts", "packages/vite/src/node/optimizer/index.ts"],
    because: "The optimizer's scan crawls the entries to collect bare imports.",
  },
  {
    id: "vite-css",
    repoId: "vite",
    question: "How is a CSS import transformed and injected into the page?",
    expect: ["packages/vite/src/node/plugins/css.ts"],
    because: "The css plugin handles transformation and injection.",
  },
  {
    id: "vite-define",
    repoId: "vite",
    question: "How does the define option replace values in source code?",
    expect: ["packages/vite/src/node/plugins/define.ts"],
    because: "The define plugin performs the replacement.",
  },
  {
    id: "vite-config",
    repoId: "vite",
    question: "How is the config file loaded and merged with defaults?",
    expect: ["packages/vite/src/node/config.ts"],
    because: "config.ts resolves, loads, and merges configuration.",
  },

  // trpc
  {
    id: "trpc-error-shape",
    repoId: "trpc",
    question: "How is a thrown error turned into the error shape sent to the client?",
    expect: [
      "packages/server/src/unstable-core-do-not-import/error/getErrorShape.ts",
      "packages/server/src/unstable-core-do-not-import/error/formatter.ts",
    ],
    because: "getErrorShape builds the payload, using the configured formatter.",
  },
  {
    id: "trpc-fetch-adapter",
    repoId: "trpc",
    question: "How does the fetch adapter turn a Request into a tRPC response?",
    expect: [
      "packages/server/src/adapters/fetch/fetchRequestHandler.ts",
      "packages/server/src/adapters/fetch/index.ts",
    ],
    because: "fetchRequestHandler is the entry point for fetch-based runtimes.",
  },
  {
    id: "trpc-observable",
    repoId: "trpc",
    question: "How does an observable deliver values to its subscribers?",
    expect: ["packages/server/src/observable/observable.ts"],
    because: "observable.ts implements subscribe and the teardown it returns.",
  },

  // xstate
  {
    id: "xstate-assign",
    repoId: "xstate",
    question: "How does an action update the machine's context?",
    expect: ["packages/core/src/actions/assign.ts"],
    because: "assign is the action that produces new context.",
  },
  {
    id: "xstate-actor",
    repoId: "xstate",
    question: "How is a machine started and how are events delivered to it?",
    expect: ["packages/core/src/createActor.ts"],
    because: "createActor implements start, send, and the event queue.",
  },
  {
    id: "xstate-transition",
    repoId: "xstate",
    question: "How does a state decide which transition to take for an event?",
    expect: ["packages/core/src/StateNode.ts", "packages/core/src/StateMachine.ts"],
    because: "Transition selection lives on the state node and its machine.",
  },
];

export const casesForRepos = (repoIds: string[]): EvalCase[] =>
  repoIds.length === 0 ? EVAL_CASES : EVAL_CASES.filter((testCase) => repoIds.includes(testCase.repoId));
