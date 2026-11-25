import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { preloadPage } from './app/routeChunks';
import './styles/globals.css';

// fetch the current page chunk in parallel with the shell and the analysis worker
preloadPage(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
