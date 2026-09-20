import { Link } from "react-router";
import { AUTHOR, SITE_NAME } from "../../site";
import { Logo } from "./Logo";

const EXPLORE_LINKS = [
  { to: "/", label: "Home" },
  { to: "/repos", label: "Repositories" },
  { to: "/how-it-works", label: "How it works" },
];

const BUILT_WITH = ["React + TypeScript", "Node.js + Express", "MongoDB Atlas Vector Search", "Google Gemini"];

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5 font-semibold text-slate-900">
            <Logo className="size-7" />
            {SITE_NAME}
          </Link>
          <p className="mt-3 max-w-sm text-sm text-slate-600">
            Questions about real open-source code, answered from the source itself and cited to the exact lines on GitHub.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Explore</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {EXPLORE_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-slate-600 hover:text-slate-900">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Built with</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {BUILT_WITH.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {AUTHOR}. Built as a portfolio project.
          </p>
          <p>Answers are AI-generated and can be wrong; the linked sources are the ground truth.</p>
        </div>
      </div>
    </footer>
  );
}
