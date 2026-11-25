import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { useS } from './store';
import './styles.css';

function Client() {
  const screen = useS(s => s.screen);
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null);
  useEffect(() => {
    try {
      const activate = registerSW({ immediate: true, onNeedRefresh: () => setUpdate(() => () => activate(true)) });
    } catch { /* The game also works without a service worker. */ }
  }, []);
  return <>
    <App />
    {screen === 'title' && update && <button type="button" className="btn sm client-update" onClick={() => { void update(); }}>
      Spielversion aktualisieren
    </button>}
  </>;
}

createRoot(document.getElementById('root')!).render(<Client />);
