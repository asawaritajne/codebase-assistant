import { useEffect, useState } from "react";
import { ApiError, fetchEmbeddingMap } from "../api";
import type { EmbeddingMap } from "../types";

// The map is the same for everyone and only changes when the projection is rebuilt, so one fetch
// per page load is shared by every section that shows it.
let cached: EmbeddingMap | null = null;
let inFlight: Promise<EmbeddingMap> | null = null;

/** Loads the 3D map, but only once `enabled` turns true (i.e. the view is actually on screen). */
export function useEmbeddingMap(enabled: boolean) {
  const [map, setMap] = useState<EmbeddingMap | null>(cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || cached) return;
    let cancelled = false;
    inFlight ??= fetchEmbeddingMap();
    inFlight
      .then((loaded) => {
        cached = loaded;
        if (!cancelled) setMap(loaded);
      })
      .catch((err: unknown) => {
        inFlight = null; // Allow a later retry.
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Couldn't load the embedding map.");
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { map, error };
}
