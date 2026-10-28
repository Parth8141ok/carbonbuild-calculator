export function ProsePage({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-leaf">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-ink-muted [&_h2]:pt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</div>
    </div>
  );
}
