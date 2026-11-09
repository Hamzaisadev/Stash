import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import "./index.css";

// TooltipProvider now wraps AppPage instead of the whole tree: only the app
// uses tooltips, and mounting the provider here pulled @base-ui into the
// initial chunk that the landing page must download before it can paint.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
