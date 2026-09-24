import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { formatNumber } from "../lib/format";
import { repoColor } from "../lib/repoColors";
import type { EmbeddingMap, MapQueryResult } from "../types";
import type { HoveredPoint } from "./CloudPoints";
import type { GalaxyQuery } from "./EmbeddingGalaxy";
import { QuerySearch } from "./QuerySearch";
import { useEmbeddingMap } from "./useEmbeddingMap";

// three.js is a large dependency, so it only downloads once the galaxy scrolls into view.
const EmbeddingGalaxy = lazy(() => import("./EmbeddingGalaxy"));

const TYPE_LABELS: Record<string, string> = { code: "source file", commit: "commit", pr: "pull request" };

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

function pointDetails(map: EmbeddingMap, index: number) {
  const repo = map.repos[map.repoIndex[index]!];
  const type = map.types[map.typeIndex[index]!] ?? "code";
  return {
    repoId: repo?.id ?? "",
    repoName: repo?.name ?? "",
    typeLabel: TYPE_LABELS[type] ?? type,
    title: map.titles[index] ?? "",
    url: map.urls[index] ?? "",
    isTest: map.isTest[index] === 1,
  };
}

function Tooltip({ map, hovered }: { map: EmbeddingMap; hovered: HoveredPoint }) {
  const point = pointDetails(map, hovered.index);
  return (
    <div
      className="glass pointer-events-none absolute z-10 max-w-xs -translate-x-1/2 -translate-y-full rounded-xl px-3 py-2 text-xs shadow-2xl"
      style={{ left: hovered.x, top: hovered.y - 14 }}
    >
      <p className="flex items-center gap-1.5 font-medium text-chalk">
        <span aria-hidden="true" className="size-2 rounded-full" style={{ background: repoColor(point.repoId) }} />
        {point.repoName} · {point.typeLabel}
      </p>
      <p className="mt-1 font-mono break-all text-mist">{point.title}</p>
    </div>
  );
}

function DetailPanel({ map, index, onClose }: { map: EmbeddingMap; index: number; onClose: () => void }) {
  const point = pointDetails(map, index);
  return (
    <div className="glass absolute bottom-4 left-4 z-20 max-w-sm rounded-2xl p-4 shadow-2xl sm:bottom-6 sm:left-6">
      <div className="flex items-start justify-between gap-4">
        <p className="flex items-center gap-2 text-xs font-medium text-mist">
          <span aria-hidden="true" className="size-2 rounded-full" style={{ background: repoColor(point.repoId) }} />
          {point.repoName} · {point.typeLabel}
          {point.isTest && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[0.65rem]">test</span>}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="-m-1 grid size-6 place-items-center rounded-lg text-mist transition-colors hover:bg-white/10 hover:text-chalk"
        >
          <span className="sr-only">Close</span>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-3.5">
            <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <p className="mt-2 font-mono text-sm break-all text-chalk">{point.title}</p>
      <a
        href={point.url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-chalk transition-colors hover:bg-white/20"
      >
        Open on GitHub <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

export function GalaxySection({ heading, intro }: { heading: string; intro: string }) {
  const { ref, near } = useNearViewport<HTMLDivElement>();
  const { map, error } = useEmbeddingMap(near);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [hovered, setHovered] = useState<HoveredPoint | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [queryResult, setQueryResult] = useState<MapQueryResult | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  // Neighbours come back as chunk keys; look up where those chunks sit in the map.
  const query = useMemo<GalaxyQuery | null>(() => {
    if (!map || !queryResult) return null;
    const indexByKey = new Map(map.keys.map((key, index) => [key, index]));
    const neighbourPositions = queryResult.neighbours.flatMap((neighbour) => {
      const index = indexByKey.get(neighbour.key);
      if (index === undefined) return [];
      return [map.positions.slice(index * 3, index * 3 + 3) as [number, number, number]];
    });
    return { position: queryResult.position, neighbourPositions };
  }, [map, queryResult]);

  return (
    <div ref={ref}>
      <div className="max-w-2xl">
        <p className="font-mono text-xs tracking-[0.2em] text-glow uppercase">The index, visualized</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-balance text-chalk sm:text-4xl">{heading}</h2>
        <p className="mt-4 leading-relaxed text-mist">{intro}</p>
      </div>

      <div className="relative mt-8 overflow-hidden rounded-3xl border border-white/8 bg-void shadow-[0_40px_120px_-60px_var(--color-iris)]">
        {map && <QuerySearch result={queryResult} onResult={setQueryResult} />}
        <div className="relative h-115 md:h-155">
          {error ? (
            <p className="grid h-full place-items-center px-6 text-center text-sm text-mist">{error}</p>
          ) : map ? (
            <Suspense fallback={<p className="grid h-full place-items-center text-sm text-mist">Loading 3D view…</p>}>
              <EmbeddingGalaxy
                map={map}
                highlight={highlight}
                autoRotate={!reducedMotion && hovered === null && selected === null && queryResult === null}
                query={query}
                onHover={setHovered}
                onSelect={setSelected}
              />
              {hovered && <Tooltip map={map} hovered={hovered} />}
              {selected !== null && <DetailPanel map={map} index={selected} onClose={() => setSelected(null)} />}
            </Suspense>
          ) : (
            <p className="grid h-full place-items-center text-sm text-mist">{near ? "Loading the embedding map…" : ""}</p>
          )}
        </div>

        {map && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-white/8 bg-deep/60 px-5 py-4">
            <p className="font-mono text-[0.7rem] tracking-wide text-mist">
              {formatNumber(map.count)} chunks · {map.repos.length} repositories · drag to rotate · click a mote for details
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setHighlight(null)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  highlight === null ? "bg-chalk text-void" : "text-mist hover:bg-white/10 hover:text-chalk"
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
                    highlight === repo.id ? "bg-chalk text-void" : "text-mist hover:bg-white/10 hover:text-chalk"
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

      <p className="mt-3 text-xs leading-relaxed text-mist/80">
        Each mote is one indexed chunk — a piece of code, a commit message, or a pull request description — placed by
        meaning: the 768 numbers behind it reduced to three with principal component analysis. Motes that sit together are
        chunks the search considers similar.
      </p>
    </div>
  );
}
