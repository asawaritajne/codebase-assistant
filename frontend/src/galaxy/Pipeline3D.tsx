import { Suspense, lazy, useEffect, useRef, useState } from "react";

const PipelineScene = lazy(() => import("./PipelineScene"));

export interface PipelineStage {
  title: string;
  detail: string;
}

/** The moving 3D pipeline with its labels; the scene loads only when it scrolls into view. */
export function Pipeline3D({ stages }: { stages: PipelineStage[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

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

  return (
    <div ref={ref} className="relative overflow-hidden rounded-3xl border border-white/8 bg-deep/60">
      <div aria-hidden="true" className="bg-grid absolute inset-0 opacity-50" />
      <div className="relative h-56 sm:h-64">
        {near && (
          <Suspense fallback={null}>
            <PipelineScene stages={stages.length} />
          </Suspense>
        )}
      </div>
      <ol className="relative grid gap-px border-t border-white/8 bg-white/5 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage, index) => (
          <li key={stage.title} className="bg-deep/80 p-5">
            <span className="font-mono text-xs text-glow">{String(index + 1).padStart(2, "0")}</span>
            <h3 className="mt-1.5 font-display text-sm font-semibold text-chalk">{stage.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-mist">{stage.detail}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
