import React from 'react'; import { createRoot } from 'react-dom/client'; import './styles.css'; import { App } from './App'; import { registerSW } from 'virtual:pwa-register';
createRoot(document.getElementById('root')!).render(<App />); try { registerSW({ immediate: true }); } catch { /* kein SW */ }
