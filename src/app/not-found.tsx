import Link from "next/link";
import { Button } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-leaf">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-3 text-ink-muted">The page you are looking for does not exist.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
