import { Link } from "react-router";
import { AUTHOR, SITE_NAME } from "../../site";
import { Logo } from "./Logo";

const EXPLORE_LINKS = [
  { to: "/", label: "Home" },
  { to: "/repos", label: "Repositories" },
  { to: "/how-it-works", label: "How it works" },
];

const BUILT_WITH = ["React + TypeScript", "three.js", "Node.js + Express", "MongoDB Atlas Vector Search", "Google Gemini"];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/5 bg-deep">
      <div aria-hidden="true" className="bg-grid absolute inset-0 opacity-40 mask-[radial-gradient(70%_100%_at_50%_0%,black,transparent)]" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Link to="/" className="inline-flex items-center gap-3 display text-xl text-chalk">
            <Logo className="size-8" />
            {SITE_NAME}
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-mist">
            Questions about real open-source code, answered from the source itself and cited to the exact lines on GitHub.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-medium text-chalk">Explore</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {EXPLORE_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-mist transition-colors hover:text-glow">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-medium text-chalk">Built with</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-mist">
            {BUILT_WITH.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="relative border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-mist/80 sm:flex-row sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {AUTHOR}. Built as a portfolio project.
          </p>
          <p>Answers are AI-generated and can be wrong; the linked sources are the ground truth.</p>
        </div>
      </div>
    </footer>
  );
}
