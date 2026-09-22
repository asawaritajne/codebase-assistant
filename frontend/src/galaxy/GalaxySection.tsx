import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { formatNumber } from "../lib/format";
import { repoColor } from "../lib/repoColors";
import type { EmbeddingMap } from "../types";
import type { HoveredPoint } from "./EmbeddingGalaxy";
import { useEmbeddingMap } from "./useEmbeddingMap";

// three.js is a large dependency, so it only downloads once the galaxy scrolls into view.
const EmbeddingGalaxy = lazy(() => import("./EmbeddingGalaxy"));

const TYPE_LABELS: Record<string, string> = { code: "code", commit: "commit", pr: "pull request" };

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Defers work until the element is near the viewport. */
function useNearViewport<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || near) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && setNear(true),
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near]);
  return { ref, near };
}

function Tooltip({ map, hovered }: { map: EmbeddingMap; hovered: HoveredPoint }) {
  const repo = map.repos[map.repoIndex[hovered.index]!];
  const type = map.types[map.typeIndex[hovered.index]!] ?? "code";
  return (
    <div
      className="pointer-events-none absolute z-10 max-w-xs -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900/95 px-3 py-2 text-xs text-white shadow-lg ring-1 ring-white/10"
      style={{ left: hovered.x, top: hovered.y - 12 }}
    >
      <p className="flex items-center gap-1.5 font-medium">
        <span aria-hidden="true" className="size-2 rounded-full" style={{ background: repoColor(repo?.id ?? "") }} />
        {repo?.name} · {TYPE_LABELS[type] ?? type}
      </p>
      <p className="mt-1 font-mono break-all text-slate-300">{map.titles[hovered.index]}</p>
      <p className="mt-1 text-slate-400">Click to open on GitHub</p>
    </div>
  );
}

export function GalaxySection({ heading, intro }: { heading: string; intro: string }) {
  const { ref, near } = useNearViewport<HTMLDivElement>();
  const { map, error } = useEmbeddingMap(near);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [hovered, setHovered] = useState<HoveredPoint | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div ref={ref}>
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-indigo-600">The index, visualized</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{heading}</h2>
        <p className="mt-4 leading-relaxed text-slate-600">{intro}</p>
      </div>

      <div className="relative mt-8 overflow-hidden rounded-3xl bg-slate-950 ring-1 ring-slate-800">
        <div className="relative h-[420px] md:h-[560px]">
          {error ? (
            <p className="grid h-full place-items-center px-6 text-center text-sm text-slate-400">{error}</p>
          ) : map ? (
            <Suspense fallback={<p className="grid h-full place-items-center text-sm text-slate-400">Loading 3D view…</p>}>
              <EmbeddingGalaxy
                map={map}
                highlight={highlight}
                autoRotate={!reducedMotion && hovered === null}
                onHover={setHovered}
                onSelect={(index) => window.open(map.urls[index], "_blank", "noopener")}
              />
              {hovered && <Tooltip map={map} hovered={hovered} />}
            </Suspense>
          ) : (
            <p className="grid h-full place-items-center text-sm text-slate-400">
              {near ? "Loading the embedding map…" : ""}
            </p>
          )}
        </div>

        {map && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-slate-800 px-5 py-4">
            <p className="text-xs text-slate-400">
              {formatNumber(map.count)} chunks · {map.repos.length} repositories · drag to rotate, scroll to zoom
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setHighlight(null)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  highlight === null ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                All
              </button>
              {map.repos.map((repo, index) => (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => setHighlight(highlight === repo.id ? null : repo.id)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    highlight === repo.id ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ background: repoColor(repo.id, index) }} />
                  {repo.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Each dot is one indexed chunk of code, a commit message, or a pull request description, placed by meaning: the
        768 numbers behind it reduced to three with principal component analysis. Chunks that sit together are chunks the
        search considers similar.
      </p>
    </div>
  );
}
