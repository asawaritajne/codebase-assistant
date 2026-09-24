import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { useRepos } from "../../repos/ReposContext";
import { SITE_NAME } from "../../site";
import { Logo } from "./Logo";

const NAV_ITEMS = [
  { to: "/repos", label: "Repositories" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/quality", label: "Quality" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "text-chalk" : "text-mist hover:text-chalk"
  }`;

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const { repos } = useRepos();
  const startRepo = repos?.find((repo) => repo.stats.chunks > 0)?.id ?? "react-hook-form";

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-void/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3 display text-xl text-chalk">
          <Logo className="size-9" />
          {SITE_NAME}
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
          <Link
            to={`/ask/${startRepo}`}
            className="ml-3 rounded-xl bg-linear-to-r from-glow to-iris px-4 py-2 text-sm font-semibold text-void transition-transform hover:-translate-y-0.5"
          >
            Start asking
          </Link>
        </nav>

        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((open) => !open)}
          className="grid size-10 place-items-center rounded-lg text-mist hover:bg-white/5 hover:text-chalk md:hidden"
        >
          <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-5">
            {menuOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      <nav id="mobile-nav" aria-label="Main" hidden={!menuOpen} className="border-t border-white/5 bg-deep px-4 py-3 md:hidden">
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
          <Link
            to={`/ask/${startRepo}`}
            className="mt-2 rounded-xl bg-linear-to-r from-glow to-iris px-3 py-2 text-center text-sm font-semibold text-void"
          >
            Start asking
          </Link>
        </div>
      </nav>
    </header>
  );
}
