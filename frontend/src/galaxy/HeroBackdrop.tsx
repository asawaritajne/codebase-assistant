import { Suspense, lazy, useEffect, useState } from "react";
import { useEmbeddingMap } from "./useEmbeddingMap";

const HeroGalaxy = lazy(() => import("./HeroGalaxy"));

/** True when the viewport is at least `minWidth` and the visitor hasn't asked for less motion. */
function useAmbientMotion(minWidth: number): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const wideEnough = window.matchMedia(`(min-width: ${minWidth}px)`);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(wideEnough.matches && !reduced.matches);
    update();
    wideEnough.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      wideEnough.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, [minWidth]);
  return enabled;
}

/**
 * The live embedding cloud behind the hero. Phones and reduced-motion visitors get the gradient
 * alone, and the canvas never intercepts clicks meant for the buttons above it.
 */
export function HeroBackdrop() {
  const enabled = useAmbientMotion(768);
  const { map } = useEmbeddingMap(enabled);

  if (!enabled || !map) return null;
  return (
    // Faded out over the left half so the cloud never competes with the headline for legibility.
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-70 mask-[linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.25)_38%,black_62%,black_100%)]"
    >
      <Suspense fallback={null}>
        <HeroGalaxy map={map} interactive />
      </Suspense>
    </div>
  );
}
