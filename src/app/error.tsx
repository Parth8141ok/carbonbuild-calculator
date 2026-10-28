"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/primitives";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-danger">Something went wrong</p>
      <h1 className="mt-2 text-2xl font-semibold">This page could not be displayed</h1>
      <p className="mt-3 text-ink-muted">
        Your projects are stored in this browser and have not been changed. Try again, or go back to the dashboard. If the problem continues, download a backup from Settings.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <Button asChild variant="secondary">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
