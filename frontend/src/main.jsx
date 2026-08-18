import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { TooltipProvider } from './components/ui/tooltip.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import "./index.css";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <TooltipProvider delay={300}>
        <App />
      </TooltipProvider>
    </ErrorBoundary>
  </StrictMode>,
);
