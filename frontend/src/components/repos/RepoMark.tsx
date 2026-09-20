/** A colored monogram tile that identifies a repository at a glance. */
const MARKS: Record<string, { monogram: string; className: string }> = {
  "react-hook-form": { monogram: "RH", className: "bg-rose-500" },
  zustand: { monogram: "Zu", className: "bg-amber-700" },
  express: { monogram: "Ex", className: "bg-slate-800" },
  axios: { monogram: "Ax", className: "bg-violet-600" },
  vite: { monogram: "Vi", className: "bg-indigo-500" },
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
