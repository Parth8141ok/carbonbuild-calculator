"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/assess", label: "New project" },
  { href: "/projects", label: "My projects" },
  { href: "/materials", label: "Material library" },
  { href: "/factors", label: "Emission factors" },
  { href: "/reports", label: "Reports" },
  { href: "/methodology", label: "Methodology" },
  { href: "/settings", label: "Settings" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[rgba(248,246,241,0.92)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="CarbonBuild home" className="rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-0.5 xl:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={pathname.startsWith(n.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-2 text-sm font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink",
                pathname.startsWith(n.href) && "text-ink",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/assess">Calculate footprint</Link>
          </Button>
          <Button variant="ghost" size="icon" className="xl:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {open ? (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-line bg-page px-4 py-3 xl:hidden">
          <ul className="space-y-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-surface-sunken">
                  {n.label}
                </Link>
              </li>
            ))}
            <li className="pt-2 sm:hidden">
              <Button asChild className="w-full">
                <Link href="/assess" onClick={() => setOpen(false)}>
                  Calculate footprint
                </Link>
              </Button>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-ink-muted">
            Measure. Understand. Reduce. A transparent estimator of construction-stage carbon emissions, developed as a B.Tech Civil Engineering project at SCET, Sarvajanik University, Surat (2026).
          </p>
        </div>
        <FooterCol title="Tool" links={[["/dashboard", "Dashboard"], ["/assess", "New project"], ["/results", "Results"], ["/projects", "My projects"], ["/reports", "Reports"]]} />
        <FooterCol title="Documentation" links={[["/methodology", "Methodology"], ["/methodology#reconciliation", "Reference reconciliation"], ["/methodology#limitations", "Limitations"], ["/materials", "Material library"], ["/factors", "Emission factors"]]} />
        <FooterCol title="About" links={[["/about", "About the project"], ["/settings", "Settings"], ["/privacy", "Privacy"], ["/disclaimer", "Disclaimer"]]} />
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-ink-subtle sm:px-6">
          Academic project for learning and demonstration. Results are estimates that depend on the quantities and emission factors entered; they are not intended for professional, commercial or compliance use.
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link className="text-ink-muted hover:text-ink" href={href}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
