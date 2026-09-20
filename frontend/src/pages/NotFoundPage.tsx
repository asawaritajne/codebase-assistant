import { Link } from "react-router";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function NotFoundPage() {
  useDocumentTitle("Page not found");
  return (
    <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-mono text-sm font-semibold text-indigo-600">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Page not found</h1>
      <p className="mt-3 text-slate-600">That page doesn't exist, but the codebases do.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">
          Go home
        </Link>
        <Link to="/repos" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-400">
          Browse repositories
        </Link>
      </div>
    </div>
  );
}
