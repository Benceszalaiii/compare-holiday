/**
 * Generates a unique id for a destination or hotel.
 *
 * `crypto.randomUUID` is restricted to secure contexts, so it is simply
 * missing when the app is opened over plain HTTP from another machine on the
 * LAN — which is exactly how this gets used from a second computer. The
 * fallbacks keep that working:
 *
 *   1. `crypto.randomUUID` on localhost and HTTPS.
 *   2. `crypto.getRandomValues`, which has no secure-context requirement, laid
 *      out as a v4 UUID by hand.
 *   3. `Math.random`, for the case where neither exists. Not cryptographically
 *      random, but these ids only have to be unique within one browser's saved
 *      research, never unguessable.
 */
export function newId(): string {
  const cryptoObj = globalThis.crypto;

  if (typeof cryptoObj?.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }

  if (typeof cryptoObj?.getRandomValues === "function") {
    const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
    // Set the version (4) and variant (RFC 4122) bits.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
