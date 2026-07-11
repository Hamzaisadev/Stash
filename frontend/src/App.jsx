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

  // Intercept QR Code scans that land on '/' with query parameters (e.g., ?download=id)
  const hasDownloadParam = new URLSearchParams(window.location.search).has('download');

  if (currentRoute === '/' && !hasDownloadParam) {
    return <Landing />;
  }

  // Route to the redesigned app page
  return <AppPage />;
}

export default App;
