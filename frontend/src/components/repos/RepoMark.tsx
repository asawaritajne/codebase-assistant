/** A colored monogram tile that identifies a repository at a glance. */
const MARKS: Record<string, { monogram: string; className: string }> = {
  "react-hook-form": { monogram: "RH", className: "bg-rose-500" },
  zustand: { monogram: "Zu", className: "bg-amber-700" },
  express: { monogram: "Ex", className: "bg-slate-800" },
  axios: { monogram: "Ax", className: "bg-violet-600" },
  vite: { monogram: "Vi", className: "bg-indigo-500" },
  redux: { monogram: "Rx", className: "bg-purple-700" },
  trpc: { monogram: "tR", className: "bg-sky-600" },
  xstate: { monogram: "XS", className: "bg-fuchsia-700" },
  "tanstack-query": { monogram: "TQ", className: "bg-red-500" },
  "react-router": { monogram: "RR", className: "bg-rose-600" },
  dayjs: { monogram: "Dj", className: "bg-orange-600" },
  preact: { monogram: "Pr", className: "bg-indigo-700" },
  zod: { monogram: "Zo", className: "bg-blue-700" },
};

const SIZES = {
  sm: "size-8 rounded-lg text-xs",
  md: "size-10 rounded-xl text-sm",
  lg: "size-14 rounded-2xl text-lg",
};

interface RepoMarkProps {
  repoId: string;
  name: string;
  size?: keyof typeof SIZES;
}

export function RepoMark({ repoId, name, size = "md" }: RepoMarkProps) {
  const mark = MARKS[repoId];
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center font-semibold text-white shadow-sm ${SIZES[size]} ${mark?.className ?? "bg-teal-600"}`}
    >
      {mark?.monogram ?? name.slice(0, 2)}
    </span>
  );
}
