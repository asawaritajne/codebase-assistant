import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function Layout() {
  const { pathname } = useLocation();
  // The chat page is a full-height app view, so it has no footer.
  const isChat = pathname.startsWith("/ask/");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-white text-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex flex-1 flex-col">
        <Outlet />
      </main>
      {!isChat && <SiteFooter />}
    </div>
  );
}
