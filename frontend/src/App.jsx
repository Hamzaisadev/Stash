import { useState, useEffect } from 'react';
import Landing from './pages/Landing.jsx';
import AppPage from './pages/AppPage.jsx';

/**
 * Rewrite legacy flat room links (e.g. /my-room) to /rooms/my-room.
 *
 * Runs once at module scope, before the first render, so the app never paints
 * against the pre-rewrite path and no state update is needed to correct it.
 */
function normalizePath() {
  const path = window.location.pathname;
  if (path !== '/' && !path.startsWith('/rooms') && !path.includes('.')) {
    const rewritten = `/rooms${path}`;
    window.history.replaceState({}, '', rewritten);
    return rewritten;
  }
  return path;
}

normalizePath();

function App() {
  const [currentRoute, setCurrentRoute] = useState(() => window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentRoute(normalizePath());
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Intercept QR Code scans that land with query parameters (e.g., ?download=id)
  const hasDownloadParam = new URLSearchParams(window.location.search).has('download');

  if (currentRoute === '/' && !hasDownloadParam) {
    return <Landing />;
  }

  // Route to the redesigned app page
  return <AppPage />;
}

export default App;
