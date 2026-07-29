"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";

type Status = "idle" | "copied" | "failed";

/**
 * A button that puts a transfer code on the clipboard and says so afterwards.
 *
 * The failure state is not decoration: clipboard writes are refused outright
 * on a non-secure origin, which is exactly how this app gets opened from a
 * second machine on the LAN. A button that silently did nothing there would
 * read as broken, so a refusal is named and — where there is one — a fallback
 * route is offered in the tooltip.
 */
export function CopyButton({
  text,
  ariaLabel,
  copiedAriaLabel,
  label,
  copiedLabel = "Kimásolva",
  failedLabel = "Sikertelen",
  hint,
  failedHint,
  size = "sm",
  variant = "ghost",
  className,
}: {
  /** Built on click rather than on every render; the payload can be long. */
  text: () => string;
  ariaLabel: string;
  /** Announced once the copy lands, when "kimásolva" alone would be vague. */
  copiedAriaLabel?: string;
  /** Omit for an icon-only button. */
  label?: string;
  copiedLabel?: string;
  failedLabel?: string;
  hint?: string;
  failedHint?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function handleClick() {
    const ok = await copyText(text());
    setStatus(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <Button
      aria-label={
        status === "copied" ? (copiedAriaLabel ?? ariaLabel) : ariaLabel
      }
      className={className}
      onClick={handleClick}
      size={size}
      title={status === "failed" ? (failedHint ?? hint) : hint}
      type="button"
      variant={variant}
    >
      {status === "copied" ? (
        <CheckIcon
          aria-hidden="true"
          data-icon={label ? "inline-start" : undefined}
          weight="bold"
        />
      ) : (
        <CopyIcon
          aria-hidden="true"
          data-icon={label ? "inline-start" : undefined}
        />
      )}
      {label
        ? status === "copied"
          ? copiedLabel
          : status === "failed"
            ? failedLabel
            : label
        : null}
    </Button>
  );
}
