"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A labelled control. The label is always rendered and always associated —
 * placeholder-as-label breaks the moment a field has a value, which in a form
 * this dense is most of the time.
 */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: (props: {
    id: string;
    describedBy: string | undefined;
  }) => React.ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children({ id, describedBy })}
      {error ? (
        <p
          className="text-[0.6875rem] leading-tight text-destructive"
          id={errorId}
        >
          {error}
        </p>
      ) : hint ? (
        <p
          className="text-[0.6875rem] leading-tight text-muted-foreground"
          id={hintId}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Money entry in whole forints. Uses a text input with a numeric inputmode
 * rather than `type="number"`: number inputs silently discard the value on a
 * stray character, swallow it on scroll wheel, and can't show grouped digits.
 */
export function MoneyField({
  label,
  hint,
  error,
  value,
  onChange,
  placeholder,
  className,
  required,
}: {
  label: string;
  hint?: string;
  error?: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}) {
  return (
    <Field className={className} error={error} hint={hint} label={label}>
      {({ id, describedBy }) => (
        <div className="relative">
          <Input
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className="numeric pr-7 text-right"
            id={id}
            inputMode="numeric"
            onChange={(event) => {
              const digits = event.target.value.replace(/[^\d]/g, "");
              onChange(digits ? Number.parseInt(digits, 10) : 0);
            }}
            placeholder={placeholder ?? "0"}
            required={required}
            value={value === 0 ? "" : formatGrouped(value)}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[0.6875rem] text-muted-foreground"
          >
            Ft
          </span>
        </div>
      )}
    </Field>
  );
}

/** Thin-space grouping, matching how Hungarian sites print prices. */
function formatGrouped(value: number): string {
  return value.toLocaleString("hu-HU", { maximumFractionDigits: 0 });
}

/** Three-letter IATA code. Uppercases as you type so BUD and bud both work. */
export function AirportField({
  label,
  value,
  onChange,
  error,
  placeholder = "BUD",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <Field error={error} label={label}>
      {({ id, describedBy }) => (
        <Input
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          autoCapitalize="characters"
          autoComplete="off"
          className="numeric w-full uppercase tracking-[0.12em]"
          id={id}
          maxLength={3}
          onChange={(event) =>
            onChange(event.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())
          }
          placeholder={placeholder}
          required={required}
          spellCheck={false}
          value={value}
        />
      )}
    </Field>
  );
}

/**
 * A read-only derived figure. Everything the app calculates renders through
 * this, so computed values are visually distinguishable from typed ones.
 */
export function Readout({
  label,
  value,
  tone = "default",
  size = "sm",
  className,
}: {
  label: string;
  value: string;
  tone?: "default" | "strong" | "accent" | "muted";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="field-label">{label}</span>
      <span
        className={cn(
          "numeric truncate leading-none",
          size === "sm" && "text-xs",
          size === "md" && "text-sm",
          size === "lg" && "text-lg",
          tone === "default" && "text-foreground",
          tone === "strong" && "font-medium text-foreground",
          tone === "accent" && "font-medium text-secondary",
          tone === "muted" && "text-muted-foreground",
        )}
        data-numeric=""
      >
        {value}
      </span>
    </div>
  );
}
