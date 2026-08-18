import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

/**
 * Copy text to the clipboard, reporting whether it actually worked.
 *
 * `navigator.clipboard` is undefined on insecure origins (plain-HTTP LAN
 * access, which this app is built for) and `writeText` rejects when the
 * document lacks focus or permission. Callers must only claim success when
 * this resolves true.
 */
export async function copyToClipboard(text) {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
