"use client";

import { CalendarBlankIcon, ClockIcon } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import { hu } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDateLong } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- helpers */

/** "2026-08-14" -> a UTC-midnight Date the calendar can select. */
function isoToDate(iso: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  // Constructed in local time so react-day-picker's own local-time comparisons
  // land on the same calendar square the user clicked.
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Splits "2026-08-14T06:15" into its date and time halves. */
export function splitDateTime(value: string): { date: string; time: string } {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(value);
  return { date: m?.[1] ?? "", time: m?.[2] ?? "" };
}

export function joinDateTime(date: string, time: string): string {
  if (!date || !time) return "";
  return `${date}T${time}`;
}

/**
 * Accepts what a person actually types for a time: "6", "615", "6:15", "0615",
 * "6.15". Returns "HH:mm" or "" when it can't be read as a valid time.
 */
export function normalizeTime(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  let h: number;
  let m: number;

  if (/^\d{1,2}[:.\s]\d{1,2}$/.test(raw)) {
    const [hh, mm] = raw.split(/[:.\s]/);
    h = Number(hh);
    m = Number(mm);
  } else if (digits.length <= 2) {
    h = Number(digits);
    m = 0;
  } else if (digits.length === 3) {
    h = Number(digits.slice(0, 1));
    m = Number(digits.slice(1));
  } else {
    h = Number(digits.slice(0, 2));
    m = Number(digits.slice(2, 4));
  }

  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

/* ------------------------------------------------------------- date field */

export function DateField({
  label,
  value,
  onChange,
  error,
  min,
  /** Month the calendar opens on when nothing is picked yet. */
  defaultMonthIso,
  className,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
  min?: string;
  defaultMonthIso?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const errorId = `${id}-error`;
  const selected = isoToDate(value);
  const minDate = min ? isoToDate(min) : undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="field-label" id={`${id}-label`}>
        {label}
      </span>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          render={
            <button
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              // Both ids, so the name is "Érkezés, 2026. aug. 14." — pointing
              // at the label alone would silence the value, because
              // aria-labelledby overrides the button's own content.
              aria-labelledby={`${id}-label ${id}-value`}
              className={cn(
                "flex h-8 w-full items-center gap-2 border border-input bg-transparent px-2.5 text-left text-xs transition-colors outline-none",
                "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50",
                "dark:bg-input/30 dark:hover:bg-input/50",
                error && "border-destructive ring-1 ring-destructive/20",
              )}
              id={id}
              type="button"
            >
              <CalendarBlankIcon
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
              <span
                className={cn(
                  "numeric truncate",
                  value ? "text-foreground" : "text-muted-foreground",
                )}
                id={`${id}-value`}
              >
                {value ? formatDateLong(value) : "Válassz dátumot"}
              </span>
            </button>
          }
        />
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            autoFocus
            captionLayout="dropdown"
            defaultMonth={
              selected ?? isoToDate(defaultMonthIso ?? "") ?? undefined
            }
            disabled={minDate ? { before: minDate } : undefined}
            endMonth={new Date(new Date().getFullYear() + 3, 11)}
            locale={hu}
            mode="single"
            onSelect={(date) => {
              if (!date) return;
              onChange(dateToIso(date));
              setOpen(false);
            }}
            selected={selected}
            startMonth={new Date(new Date().getFullYear() - 1, 0)}
          />
        </PopoverContent>
      </Popover>
      {error ? (
        <p
          className="text-[0.6875rem] leading-tight text-destructive"
          id={errorId}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- time field */

/**
 * Minute-precision time entry. The trigger is a real text input so a time can
 * be typed straight in ("615" becomes 06:15), and the popover offers every
 * hour and every minute as a scrollable column for when pointing is faster.
 */
export function TimeField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (time: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const id = useId();

  // Keep the visible text in step when the value changes from outside.
  useEffect(() => {
    setText(value);
  }, [value]);

  const [hour, minute] = value ? value.split(":") : ["", ""];

  function commit(raw: string) {
    const normalized = normalizeTime(raw);
    setText(normalized);
    onChange(normalized);
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="flex">
        <input
          className={cn(
            "numeric h-8 w-full min-w-0 border border-input border-r-0 bg-transparent px-2.5 text-xs transition-colors outline-none",
            "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50",
            "dark:bg-input/30",
          )}
          id={id}
          inputMode="numeric"
          onBlur={(event) => commit(event.target.value)}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(text);
            }
          }}
          placeholder="--:--"
          value={text}
        />
        <Popover onOpenChange={setOpen} open={open}>
          <PopoverTrigger
            render={
              <Button
                aria-label={`${label} kiválasztása listából`}
                className="border border-input"
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <ClockIcon aria-hidden="true" />
              </Button>
            }
          />
          <PopoverContent align="end" className="w-auto gap-0 p-0">
            <div className="flex h-56">
              <TimeColumn
                ariaLabel="Óra"
                onSelect={(h) => onChange(`${h}:${minute || "00"}`)}
                options={HOURS}
                selected={hour}
              />
              <TimeColumn
                ariaLabel="Perc"
                onSelect={(m) => {
                  onChange(`${hour || "00"}:${m}`);
                  setOpen(false);
                }}
                options={MINUTES}
                selected={minute}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function TimeColumn({
  options,
  selected,
  onSelect,
  ariaLabel,
}: {
  options: readonly string[];
  selected: string;
  onSelect: (value: string) => void;
  ariaLabel: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // Open on the current value rather than at midnight; scrolling 60 rows to
  // find the minute you already picked is the whole reason people hate these.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(
      "[data-selected=true]",
    );
    node?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <div
      aria-label={ariaLabel}
      className="flex w-14 flex-col overflow-y-auto border-border border-r last:border-r-0"
      ref={listRef}
      role="listbox"
      tabIndex={-1}
    >
      {options.map((option) => {
        const isSelected = option === selected;
        return (
          <button
            aria-selected={isSelected}
            className={cn(
              "numeric shrink-0 px-2 py-1.5 text-center text-xs transition-colors",
              "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
              isSelected
                ? "bg-secondary font-medium text-secondary-foreground hover:bg-secondary"
                : "text-foreground",
            )}
            data-selected={isSelected}
            key={option}
            onClick={() => onSelect(option)}
            role="option"
            type="button"
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------- datetime field */

/**
 * Date and time for one flight leg. When only a time is entered, the date
 * falls back to the trip date the leg belongs to — the user already typed
 * those, so making them type them again would be the app failing its own rule.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  fallbackDateIso,
  minDateIso,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  fallbackDateIso?: string;
  minDateIso?: string;
}) {
  const { date, time } = splitDateTime(value);
  const effectiveDate = date || fallbackDateIso || "";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-1.5">
      <DateField
        defaultMonthIso={fallbackDateIso}
        label={label}
        min={minDateIso}
        onChange={(iso) => onChange(joinDateTime(iso, time || "00:00"))}
        value={effectiveDate}
      />
      <TimeField
        className="w-[7.5rem]"
        label="Időpont"
        onChange={(next) =>
          onChange(next ? joinDateTime(effectiveDate, next) : "")
        }
        value={time}
      />
    </div>
  );
}
