import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import './index.css';

// Dynamically fetch and store the Google client ID on window so it's available at runtime
fetch('/api/client-id')
  .then(res => res.json())
  .then(data => {
    if (data.clientId) {
      (window as any).VITE_CLIENT_ID = data.clientId;
    }
  })
  .catch(err => console.warn('Could not fetch client-id from server:', err));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Register Service Worker for PWA Offline and Push Notification support
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then((reg) => {
        console.log('KCFC FCM & PWA Service Worker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.error('Service Worker registration failed:', err);
      });
  });
}

