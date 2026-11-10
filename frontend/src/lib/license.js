/**
 * Client-side license storage.
 *
 * The key is a bearer credential kept in localStorage — the same place the room
 * and host tokens already live. There is no account to log into by design: the
 * product's whole promise is that nothing asks who you are, and a billing
 * system that forced a sign-up would take more from the product than $6/month
 * gives back.
 *
 * The server verifies the key on every request. Nothing here is a security
 * boundary; editing localStorage to say "team" changes only what this UI draws,
 * and the next upload is still metered against the real plan.
 */

const STORAGE_KEY = 'stash_license_key';

/** Notifies open tabs/components when the key changes. */
const LICENSE_EVENT = 'stash:license-changed';

export const getLicenseKey = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    // Private browsing or disabled storage. Free plan still works.
    return null;
  }
};

export const setLicenseKey = (key) => {
  try {
    if (key) {
      localStorage.setItem(STORAGE_KEY, String(key).trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent(LICENSE_EVENT));
    return true;
  } catch {
    return false;
  }
};

export const clearLicenseKey = () => setLicenseKey(null);

export const onLicenseChange = (handler) => {
  window.addEventListener(LICENSE_EVENT, handler);
  // 'storage' covers the key being redeemed in another tab.
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(LICENSE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
};

/** Header to merge into any API request. Empty when on the free plan. */
export const licenseHeaders = () => {
  const key = getLicenseKey();
  return key ? { 'x-stash-license': key } : {};
};

/** Format bytes for limit copy. Mirrors formatBytes in backend/src/upload.js. */
export const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined) return 'Unlimited';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded =
    value >= 10 || Number.isInteger(value) ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${units[unit]}`;
};
