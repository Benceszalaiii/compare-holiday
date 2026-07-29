/**
 * Copies text, falling back when the async Clipboard API isn't available.
 *
 * `navigator.clipboard` is secure-context-only, so it is missing when the app
 * is opened over plain HTTP from another machine on the LAN. On a deployed
 * HTTPS origin the first branch always wins; the fallback exists for that
 * local case, and for browsers that refuse the permission.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or a non-secure context; try the legacy path.
    }
  }

  if (typeof document === "undefined") return false;

  // A detached textarea, selected and copied via the deprecated command. Kept
  // off-screen rather than hidden, because `display: none` can't hold a
  // selection.
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "-9999px";
  area.style.opacity = "0";
  document.body.appendChild(area);

  try {
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}
