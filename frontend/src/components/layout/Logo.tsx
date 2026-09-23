export function Logo({ className = "size-9" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative grid shrink-0 place-items-center rounded-xl bg-linear-to-br from-glow/80 via-iris/80 to-ember/80 text-void shadow-[0_0_24px_-6px_var(--color-iris)] ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="size-[58%]">
        <path d="m8 8-4 4 4 4" />
        <path d="m16 8 4 4-4 4" />
        <path d="m13.5 6-3 12" />
      </svg>
    </span>
  );
}
