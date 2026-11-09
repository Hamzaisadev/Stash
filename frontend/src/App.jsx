import { useState, useEffect, lazy, Suspense } from 'react';
import Landing from './pages/Landing.jsx';
import NotFound from './pages/NotFound.jsx';

/**
 * The app and the legal pages are split out of the initial bundle.
 *
 * AppPage drags in socket.io, the UI kit and the QR generator, none of which
 * the landing page uses. Loading them eagerly put ~400 KB in front of first
 * paint on a throttled phone, where the landing page is most of the traffic.
 */
const AppPage = lazy(() => import('./pages/AppPage.jsx'));
const Privacy = lazy(() =>
  import('./pages/Legal.jsx').then((m) => ({ default: m.Privacy })),
);
const Terms = lazy(() =>
  import('./pages/Legal.jsx').then((m) => ({ default: m.Terms })),
);

// Static pages that must not be treated as room names by normalizePath().
const RESERVED_PATHS = new Set(['/privacy', '/terms']);

/**
 * A legacy flat room link is a single path segment shaped like a room id:
 * lowercase alphanumerics and dashes, up to the 64 chars createRoom allows.
 *
 * Matching this shape rather than "any path" matters, because rewriting
 * everything to /rooms/* meant a genuinely unknown URL silently opened an
 * empty room instead of the 404 page.
 */
const ROOM_ID_PATH = /^\/[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Rewrite legacy flat room links (e.g. /my-room) to /rooms/my-room.
 *
 * Runs once at module scope, before the first render, so the app never paints
 * against the pre-rewrite path and no state update is needed to correct it.
 */
function normalizePath() {
  const path = window.location.pathname;
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  if (RESERVED_PATHS.has(normalized)) {
    return normalized;
  }
  if (
    normalized !== '/' &&
    !normalized.startsWith('/rooms') &&
    ROOM_ID_PATH.test(normalized)
  ) {
    const rewritten = `/rooms${normalized}`;
    window.history.replaceState({}, '', rewritten);
    return rewritten;
  }
  return normalized;
}

normalizePath();

/** Neutral hold while a route chunk arrives. Matches the app's own ground. */
function RouteFallback() {
  return (
    <div
      style={{ minHeight: '100svh', background: '#f8fafc' }}
      aria-busy="true"
      aria-label="Loading"
    />
  );
}

function App() {
  const [currentRoute, setCurrentRoute] = useState(() => normalizePath());

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentRoute(normalizePath());
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Intercept QR Code scans that land with query parameters (e.g., ?download=id)
  const hasDownloadParam = new URLSearchParams(window.location.search).has('download');

  // The landing page is not lazy: it is the most common entry point, so it
  // stays in the initial chunk and paints without a second round trip.
  if (currentRoute === '/' && !hasDownloadParam) {
    return <Landing />;
  }

  let page;
  if (currentRoute === '/privacy') {
    page = <Privacy />;
  } else if (currentRoute === '/terms') {
    page = <Terms />;
  } else if (
    currentRoute === '/rooms' ||
    currentRoute.startsWith('/rooms/') ||
    // A QR scan can land on "/?download=<id>", which belongs to the app even
    // though the path is the root.
    (currentRoute === '/' && hasDownloadParam)
  ) {
    page = <AppPage />;
  } else {
    // normalizePath() rewrites bare paths to /rooms/*, so anything still
    // unmatched here is a genuinely unknown URL.
    page = <NotFound />;
  }

  return <Suspense fallback={<RouteFallback />}>{page}</Suspense>;
}

export default App;
