import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { useRepos } from "../../repos/ReposContext";
import { SITE_NAME } from "../../site";
import { Logo } from "./Logo";

const NAV_ITEMS = [
  { to: "/repos", label: "Repositories" },
  { to: "/how-it-works", label: "How it works" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
  }`;

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const { repos } = useRepos();
  const startRepo = repos?.find((repo) => repo.stats.chunks > 0)?.id ?? "react-hook-form";

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-slate-900">
          <Logo />
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
            className="ml-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
          >
            Start asking
          </Link>
        </nav>

        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((open) => !open)}
          className="grid size-10 place-items-center rounded-lg text-slate-700 hover:bg-slate-100 md:hidden"
        >
          <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-5">
            {menuOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      <nav
        id="mobile-nav"
        aria-label="Main"
        hidden={!menuOpen}
        className="border-t border-slate-200 bg-white px-4 py-3 md:hidden"
      >
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
          <Link
            to={`/ask/${startRepo}`}
            className="mt-1 rounded-lg bg-slate-900 px-3 py-2 text-center text-sm font-medium text-white"
          >
            Start asking
          </Link>
        </div>
      </nav>
    </header>
  );
}
