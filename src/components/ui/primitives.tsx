"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import { forwardRef, useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-ink hover:bg-primary-hover shadow-sm",
        secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-sunken",
        ghost: "text-ink-muted hover:bg-surface-sunken hover:text-ink",
        soft: "bg-primary-soft text-primary hover:bg-[#cfe0d3]",
        danger: "border border-danger-line bg-surface text-danger hover:bg-danger-soft",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} type={asChild ? undefined : (type ?? "button")} {...props} />;
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(31,35,40,0.04)]", className)} {...props} />;
}

export function CardHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

const badgeVariants = cva("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "bg-surface-sunken text-ink-muted",
      green: "bg-primary-soft text-primary",
      amber: "bg-amber-soft text-amber",
      red: "bg-danger-soft text-danger",
      outline: "border border-line text-ink-muted",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Callout
// ---------------------------------------------------------------------------

export function Callout({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "error"; title?: ReactNode; children?: ReactNode; className?: string }) {
  const Icon = tone === "error" ? OctagonAlert : tone === "warning" ? AlertTriangle : Info;
  const styles = {
    info: "border-line bg-info-soft text-ink",
    warning: "border-amber-line bg-amber-soft text-ink",
    error: "border-danger-line bg-danger-soft text-ink",
  }[tone];
  const iconColor = { info: "text-ink-muted", warning: "text-amber", error: "text-danger" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "note"} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", styles, className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconColor)} aria-hidden />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-ink-muted [&_strong]:text-ink">{children}</div> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

const controlClass =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors hover:border-ink-subtle focus-visible:outline-2 focus-visible:outline-leaf disabled:bg-surface-sunken disabled:text-ink-subtle aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(controlClass, className)} {...props} />;
});

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "h-auto min-h-20 py-2", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(controlClass, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23565c63%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_0.75rem_center] bg-no-repeat pr-8", className)} {...props}>
      {children}
    </select>
  );
}

/**
 * Number input that distinguishes an empty field (null) from zero, and keeps the
 * text the user is typing (for example "0.") while the value is incomplete.
 */
export function NumberInput({
  value,
  onValueChange,
  className,
  suffix,
  min,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | null;
  onValueChange: (v: number | null) => void;
  suffix?: ReactNode;
}) {
  const toText = (v: number | null) => (v === null || v === undefined ? "" : String(v));
  const [text, setText] = useState(toText(value));
  const [prevValue, setPrevValue] = useState(value);
  // Sync with external changes (e.g. a preset applied elsewhere) without clobbering text being typed.
  if (value !== prevValue) {
    setPrevValue(value);
    const parsed = text.trim() === "" ? null : Number(text);
    if (parsed !== value) setText(toText(value));
  }
  const input = (
    <input
      inputMode="decimal"
      type="text"
      className={cn(controlClass, "num", suffix ? "pr-14" : "", className)}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(",", ".");
        setText(t);
        if (t.trim() === "") onValueChange(null);
        else {
          const n = Number(t);
          if (Number.isFinite(n)) onValueChange(n);
        }
      }}
      aria-invalid={props["aria-invalid"] ?? (text.trim() !== "" && (!Number.isFinite(Number(text)) || (min !== undefined && Number(text) < Number(min))))}
      {...props}
    />
  );
  if (!suffix) return input;
  return (
    <div className="relative">
      {input}
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-subtle">{suffix}</span>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  optional,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (id: string) => ReactNode;
  className?: string;
  htmlFor?: string;
  optional?: boolean;
}) {
  const auto = useId();
  const id = htmlFor ?? auto;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline gap-2 text-sm font-medium text-ink">
        {label}
        {optional ? <span className="text-xs font-normal text-ink-subtle">optional</span> : null}
      </label>
      {children(id)}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, description, className, ...props }: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" {...props} />
      <label htmlFor={id} className="text-sm">
        <span className="font-medium text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-ink-muted">{description}</span> : null}
      </label>
    </div>
  );
}

/** A radio group rendered as a row of buttons. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex flex-wrap rounded-lg border border-line-strong bg-surface-sunken p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md font-medium transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface p-4", className)}>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="num mt-1.5 text-xl font-semibold tracking-tight text-ink">{value}</p>
      {sub ? <p className="mt-1 text-xs text-ink-subtle">{sub}</p> : null}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="max-w-3xl">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wider text-leaf">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
