import { Suspense, lazy, useEffect, useRef, useState } from "react";

const PipelineScene = lazy(() => import("./PipelineScene"));

export interface PipelineStage {
  title: string;
  detail: string;
  /** The real quantity at this stage, e.g. "8,247" — shown under the caption. */
  value?: string;
  /** What that quantity counts, e.g. "chunks searched". */
  unit?: string;
  /** A second real measurement, e.g. "120ms median". */
  note?: string;
  /**
   * Share of the pipeline's data this stage holds, 0 to 1. It sizes the sphere and the density of
   * motes leaving it, so the funnel — whole index, five sources, one answer — is visible.
   */
  weight?: number;
}

/**
 * The answering pipeline in 3D, sized by what actually flows through it. Hovering a caption
 * highlights its sphere and vice versa; the scene loads only when it scrolls into view.
 */
export function Pipeline3D({ stages }: { stages: PipelineStage[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || near) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && setNear(true),
      { rootMargin: "250px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near]);

  const weights = stages.map((stage) => stage.weight ?? 0.5);

  return (
    <div ref={ref} className="relative overflow-hidden rounded-3xl border border-white/8 bg-deep/60">
      <div aria-hidden="true" className="bg-grid absolute inset-0 opacity-50" />
      <div className="relative h-56 sm:h-64">
        {near && (
          <Suspense fallback={null}>
            <PipelineScene stages={stages.length} weights={weights} active={active} onHover={setActive} />
          </Suspense>
        )}
      </div>
      <ol className="relative grid gap-px border-t border-white/8 bg-white/5 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage, index) => (
          <li
            key={stage.title}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
            className={`p-5 transition-colors ${active === index ? "bg-deep ring-1 ring-white/10" : "bg-deep/80"}`}
          >
            <span className="font-mono text-xs text-glow">{String(index + 1).padStart(2, "0")}</span>
            <h3 className="mt-1.5 text-sm font-medium text-chalk">{stage.title}</h3>
            {stage.value && (
              <p className="mt-2 display text-2xl text-chalk tabular-nums">
                {stage.value}
                {stage.unit && <span className="ml-1.5 font-mono text-[0.7rem] text-mist/70">{stage.unit}</span>}
              </p>
            )}
            {stage.note && <p className="mt-0.5 font-mono text-[0.7rem] text-glow/80">{stage.note}</p>}
            <p className="mt-2 text-xs leading-relaxed text-mist">{stage.detail}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
