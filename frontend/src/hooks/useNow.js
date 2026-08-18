import { useEffect, useState } from "react";

/**
 * A single shared 1-second clock.
 *
 * Previously every FileCard created its own setInterval for its expiry
 * countdown, so a room with 100 files ran 100 intervals. This module keeps one
 * interval alive for as long as at least one component is subscribed.
 */

const subscribers = new Set();
let intervalId = null;

function tick() {
  const now = Date.now();
  for (const notify of subscribers) notify(now);
}

function subscribe(notify) {
  subscribers.add(notify);
  if (intervalId === null) {
    intervalId = setInterval(tick, 1000);
  }
  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

/** Returns the current epoch ms, re-rendering the caller once per second. */
export function useNow(enabled = true) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    // No initial setNow(): the lazy initializer already seeded the current
    // time, and the shared interval refreshes within a second.
    return subscribe(setNow);
  }, [enabled]);

  return now;
}
