"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * State saved in the browser's localStorage. It is read with useSyncExternalStore, so the
 * server-rendered page and the first client render both show the default, and the saved
 * value appears right after hydration. If storage is blocked (private window), the value
 * is kept in memory for the session instead.
 */
const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useStoredState<T>(key: string, fallback: T, sanitize: (raw: unknown) => T): [T, (next: T | ((prev: T) => T)) => void] {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);

  const parse = useCallback(
    (text: string | null): T => {
      if (text === null) return fallback;
      try {
        return sanitize(JSON.parse(text));
      } catch {
        return fallback;
      }
    },
    [fallback, sanitize],
  );

  const value = useMemo(() => parse(raw), [parse, raw]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = parse(read(key));
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      const text = JSON.stringify(resolved);
      memory.set(key, text);
      try {
        localStorage.setItem(key, text);
      } catch {
        /* storage blocked or full: keep the in-memory copy */
      }
      listeners.forEach((l) => l());
    },
    [key, parse],
  );

  return [value, set];
}
