/** Point colors for the 3D map, picked to stay legible against its dark background. */
const COLORS: Record<string, string> = {
  "react-hook-form": "#f43f5e",
  zustand: "#f59e0b",
  express: "#94a3b8",
  axios: "#8b5cf6",
  vite: "#6366f1",
  redux: "#a855f7",
  trpc: "#0ea5e9",
  xstate: "#d946ef",
  "tanstack-query": "#ef4444",
  "react-router": "#fb7185",
  dayjs: "#f97316",
  preact: "#818cf8",
  zod: "#3b82f6",
};

const FALLBACKS = ["#22d3ee", "#34d399", "#facc15", "#f472b6"];

export function repoColor(repoId: string, index = 0): string {
  return COLORS[repoId] ?? FALLBACKS[index % FALLBACKS.length]!;
}
