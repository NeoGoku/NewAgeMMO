import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { startUpdates } from './update';
import { UpdateBanner } from './ui/UpdatePanel';
import { App } from './App';
import './styles.css';

function Client() {
  useEffect(() => { startUpdates(); }, []);
  return <>
    <App />
    <UpdateBanner />
  </>;
}

createRoot(document.getElementById('root')!).render(<Client />);
