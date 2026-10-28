"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(31,35,40,0.35)] backdrop-blur-[1px]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-surface shadow-xl",
            wide ? "max-w-3xl" : "max-w-lg",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-0.5 text-sm text-ink-muted">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">Dialog</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="rounded-md p-1 text-ink-muted hover:bg-surface-sunken hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("flex gap-1 overflow-x-auto border-b border-line", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "-mb-px shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink data-[state=active]:border-primary data-[state=active]:text-ink",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = TabsPrimitive.Content;

export function Slider({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  label,
}: {
  value: number;
  onValueChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
}) {
  return (
    <SliderPrimitive.Root
      className="relative flex h-5 w-full touch-none select-none items-center"
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onValueChange(v[0])}
      aria-label={label}
    >
      <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-sunken">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb aria-label={label} className="block size-4 rounded-full border-2 border-primary bg-surface shadow focus-visible:outline-2 focus-visible:outline-leaf" />
    </SliderPrimitive.Root>
  );
}

/** A small "?" button that explains an engineering term. Opens on hover and on keyboard focus. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-line-strong text-[10px] font-semibold leading-none text-ink-muted hover:border-ink-subtle hover:text-ink"
        >
          ?
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content sideOffset={6} collisionPadding={12} className="z-50 max-w-72 rounded-lg bg-ink px-3 py-2 text-xs leading-relaxed text-white shadow-lg">
          {children}
          <TooltipPrimitive.Arrow className="fill-[var(--ink)]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const TooltipProvider = TooltipPrimitive.Provider;
