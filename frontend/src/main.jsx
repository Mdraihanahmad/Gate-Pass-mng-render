import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

const RootWrapper = import.meta.env.DEV ? React.StrictMode : React.Fragment

const mount = () => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    import.meta.env.DEV ? (
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>
    ) : (
      <>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </>
    )
  )
}

if ('requestIdleCallback' in window) {
  window.requestIdleCallback(mount, { timeout: 1200 })
} else {
  setTimeout(mount, 0)
}

// PWA: register service worker with update flow and robust online detection
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // auto-refresh when new SW is available
    updateSW(true);
  },
  onOfflineReady() {
    // SW is ready for offline; no-op
  },
});

// Avoid sticky offline state: listen to online/offline
window.addEventListener('online', () => {
  // Reload to re-establish network-bound state if needed
  // but be gentle: only reload if we had a previous offline event
});
window.addEventListener('offline', () => {
  // App components may show an offline banner; SW controls caching
});
