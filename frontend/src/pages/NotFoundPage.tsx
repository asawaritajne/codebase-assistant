import { Link } from "react-router";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function NotFoundPage() {
  useDocumentTitle("Page not found");
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-24">
      <div aria-hidden="true" className="bg-grid absolute inset-0 opacity-40 mask-[radial-gradient(60%_60%_at_50%_50%,black,transparent)]" />
      <div className="relative text-center">
        <p className="font-mono text-sm text-glow">404</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-chalk">Lost in the vector space</h1>
        <p className="mt-4 text-mist">That page doesn't exist, but the codebases do.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="rounded-xl bg-linear-to-r from-glow to-iris px-5 py-3 text-sm font-semibold text-void transition-transform hover:-translate-y-0.5"
          >
            Go home
          </Link>
          <Link
            to="/repos"
            className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-chalk transition-colors hover:bg-white/5"
          >
            Browse repositories
          </Link>
        </div>
      </div>
    </div>
  );
}
