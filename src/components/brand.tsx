import { cn } from "@/lib/utils";

/** Building-and-leaf mark: a three-storey frame with a leaf growing from its roofline. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--primary)" />
      <path d="M8 25V13.5l6-3.5v15" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 25V10l6 3.5V25" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6.5 25h19" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.5 17h1.5M10.5 20.5h1.5M16.5 16h1.5M16.5 19.5h1.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M21.5 15c0-4.4 2.6-7.4 6.5-8-.2 4.5-2.6 7.6-6.5 8z" fill="#9fd4ae" />
      <path d="M21.5 15c1.2-2.2 2.7-3.8 4.6-5" stroke="var(--primary)" strokeWidth="1" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="leading-none">
        <span className="block text-[15px] font-semibold tracking-tight text-ink">CarbonBuild</span>
        <span className="mt-0.5 block text-[11px] text-ink-subtle">Construction carbon calculator</span>
      </span>
    </span>
  );
}
