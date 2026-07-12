import React, { useState, useEffect } from 'react';
import Landing from './pages/Landing.jsx';
import AppPage from './pages/AppPage.jsx';

function App() {
  const [currentRoute, setCurrentRoute] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentRoute(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Intercept QR Code scans that land with query parameters (e.g., ?download=id)
  const hasDownloadParam = new URLSearchParams(window.location.search).has('download');

  // Redirection handler to route legacy and flat room links (e.g. /room-id) into /rooms/room-id
  useEffect(() => {
    const path = window.location.pathname;
    if (path !== '/' && !path.startsWith('/rooms') && !path.includes('.')) {
      window.history.replaceState({}, '', `/rooms${path}`);
      setCurrentRoute(`/rooms${path}`);
    }
  }, [currentRoute]);

  if (currentRoute === '/' && !hasDownloadParam) {
    return <Landing />;
  }

  // Route to the redesigned app page
  return <AppPage />;
}

export default App;
