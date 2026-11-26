import { BUILD, checkNow, useUpdate } from '../update';

const label: Record<string, string> = {
  idle: 'Noch nicht geprüft', checking: 'Prüfe …', current: 'Aktuell', preparing: 'Update wird bereitgestellt', pending: 'Update vorgemerkt',
  reloading: 'Lädt neu …', offline: 'Offline', error: 'Prüfung fehlgeschlagen'
};

export function UpdatePanel() {
  const u = useUpdate();
  const time = u.lastCheck ? new Date(u.lastCheck).toLocaleTimeString('de-DE') : '–';
  return <div className="col update-panel" aria-live="polite">
    <div className="row"><span className="grow">Spielversion</span><span className="dim">{BUILD.release || 'ohne Release'} · {BUILD.commit ? BUILD.commit.slice(0, 7) : BUILD.buildId}</span></div>
    <div className="row"><span className="grow">Letzte Prüfung</span><span className="dim">{time}</span></div>
    <div className="row"><span className="grow">Status</span><span className="dim">{label[u.status]}</span></div>
    {u.message && <small className="dim">{u.message}</small>}
    <button className="btn sm" disabled={u.status === 'checking' || u.status === 'reloading'} onClick={() => { void checkNow(true); }}>Auf Updates prüfen</button>
  </div>;
}

/** Sichtbarer Hinweis nur bei laufendem Update oder fehlender Verbindung. */
export function UpdateBanner() {
  const u = useUpdate();
  if (!['preparing', 'pending', 'reloading', 'offline', 'error'].includes(u.status)) return null;
  return <div className="update-banner" role="status">{u.status === 'offline' ? 'Offline-Modus' : u.message}</div>;
}
