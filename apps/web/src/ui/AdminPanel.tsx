import React, { useEffect, useRef, useState } from 'react';
import { ACC_RE, type AdminAuditEntry, type AdminDashboard } from '@nam/shared';
import { net } from '../net';
import { set, toast, useS } from '../store';
import { fmtT, Win } from './kit';

const ACTION_LABEL: Record<AdminAuditEntry['action'], string> = {
  announce: 'Ankündigung', kick: 'Verbindung trennen', gold: 'Gold ändern', give: 'Gegenstand vergeben', respawn: 'Gegner zurücksetzen',
  mute: 'Chat sperren', unmute: 'Chat freigeben', ban: 'Account sperren', unban: 'Account entsperren',
};
type ModerationCommand = 'kick' | 'mute' | 'unmute' | 'ban' | 'unban';
interface Confirmation { cmd: ModerationCommand; label: string; payload: Record<string, string> }

export function AdminPanel() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [target, setTarget] = useState('');
  const [account, setAccount] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const current = useRef(false);
  const conn = useS(s => s.conn);

  async function request(cmd: string, payload: Record<string, string> = {}) {
    const reply = await net.req('admin', { cmd, ...payload });
    if (reply.t === 'err') {
      if (current.current && reply.err === 'Keine Berechtigung') {
        set({ admin: false, panel: null, navPanel: '' });
        toast('Keine Berechtigung für die Administration.', 'err');
      }
      throw new Error(reply.err);
    }
    return reply;
  }

  async function refresh() {
    const reply = await request('dashboard');
    if (current.current) setDashboard(reply as typeof reply & AdminDashboard);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setStatus('');
    try { await action(); } catch (err) {
      if (current.current) setError(err instanceof Error ? err.message : 'Die Anfrage ist fehlgeschlagen.');
    } finally { if (current.current) setBusy(false); }
  }

  useEffect(() => {
    current.current = true;
    if (conn === 'ok') void run(refresh);
    return () => { current.current = false; };
  }, [conn]);

  const player = dashboard?.players.find(p => p.id === target);
  const accountName = account.trim();
  const moderationTarget: Record<string, string> | null = ACC_RE.test(accountName) ? { account: accountName } : player ? { target: player.id } : null;
  const moderationLabel = accountName || player?.name || '';
  const disabled = busy || conn !== 'ok';
  const close = () => set({ panel: null, navPanel: '' });

  return <Win title="Serververwaltung" w={500} onClose={close}>
    <div className="col">
      <div className="row wrap">
        <button type="button" className="btn sm" disabled={disabled} onClick={() => void run(refresh)}>Aktualisieren</button>
        {busy && <span className="dim sm" role="status">Serveranfrage läuft …</span>}
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      {status && <div className="dim sm" role="status">{status}</div>}
      {dashboard && <>
        <div className="row wrap">
          <span className="pill">{dashboard.online} online</span>
          <span className="pill">Tick {dashboard.tickMs.toFixed(1)} ms</span>
          <span className="pill">Laufzeit {fmtT(dashboard.uptime * 1000)}</span>
        </div>
        <div className="dim sm">{dashboard.msgs} Nachrichten · {dashboard.saves} Charakter-Speicherungen · {dashboard.store}</div>
        <form className="card col" onSubmit={e => {
          e.preventDefault();
          void run(async () => {
            await request('announce', { text: announcement });
            if (current.current) { setAnnouncement(''); setStatus('Ankündigung gesendet.'); }
            await refresh();
          });
        }}>
          <label className="col">
            <strong>Serverankündigung</strong>
            <textarea rows={2} maxLength={200} value={announcement} onChange={e => setAnnouncement(e.target.value)} />
          </label>
          <button type="submit" className="btn sm" disabled={disabled || !announcement.trim()}>An alle senden</button>
        </form>
        <section className="card col" aria-label="Spieler moderieren">
          <label className="col">
            <strong>Online-Charakter</strong>
            <select value={player ? player.id : ''} onChange={e => { setTarget(e.target.value); setAccount(''); setConfirmation(null); }}>
              <option value="">Charakter auswählen</option>
              {dashboard.players.map(p => <option key={p.id} value={p.id}>{p.name} · Lv {p.level}</option>)}
            </select>
          </label>
          <label className="col">
            <strong>Accountname (auch offline)</strong>
            <input value={account} maxLength={20} onChange={e => { setAccount(e.target.value); setTarget(''); setConfirmation(null); }} />
          </label>
          {confirmation ? <>
            <span>{ACTION_LABEL[confirmation.cmd]} · {confirmation.label}?</span>
            <div className="row wrap">
              <button className="btn sm dng" disabled={disabled} onClick={() => void run(async () => {
                await request(confirmation.cmd, confirmation.payload);
                if (current.current) {
                  setConfirmation(null);
                  setStatus(`Aktion für ${confirmation.label} ausgeführt.`);
                  if (confirmation.cmd === 'kick' || confirmation.cmd === 'ban') setTarget('');
                }
                await refresh();
              })}>Bestätigen</button>
              <button className="btn sm" disabled={busy} onClick={() => setConfirmation(null)}>Abbrechen</button>
            </div>
          </> : <div className="row wrap">
            <button className="btn sm" disabled={disabled || !player} onClick={() => player && setConfirmation({ cmd: 'kick', label: player.name, payload: { target: player.id } })}>{ACTION_LABEL.kick}</button>
            <button className="btn sm" disabled={disabled || !moderationTarget} onClick={() => moderationTarget && setConfirmation({ cmd: 'mute', label: moderationLabel, payload: moderationTarget })}>{ACTION_LABEL.mute}</button>
            <button className="btn sm" disabled={disabled || !moderationTarget} onClick={() => moderationTarget && setConfirmation({ cmd: 'ban', label: moderationLabel, payload: moderationTarget })}>{ACTION_LABEL.ban}</button>
          </div>}
          {!!dashboard.restrictions?.length && <>
            <strong>Aktive Sperren</strong>
            {dashboard.restrictions.map(restriction => <div className="row wrap" key={restriction.account}>
              <span>{restriction.account}</span>
              {restriction.muted && <button className="btn sm" disabled={disabled || !!confirmation}
                onClick={() => setConfirmation({ cmd: 'unmute', label: restriction.account, payload: { account: restriction.account } })}>{ACTION_LABEL.unmute}</button>}
              {restriction.banned && <button className="btn sm" disabled={disabled || !!confirmation}
                onClick={() => setConfirmation({ cmd: 'unban', label: restriction.account, payload: { account: restriction.account } })}>{ACTION_LABEL.unban}</button>}
            </div>)}
          </>}
        </section>
        <section className="card col" aria-label="Aktionsprotokoll">
          <strong>Aktionsprotokoll</strong>
          {!dashboard.audit.length && <span className="dim sm">Keine Einträge.</span>}
          {dashboard.audit.map(entry => <div key={entry.id} className="sm" style={{ overflowWrap: 'anywhere' }}>
            <b>{ACTION_LABEL[entry.action]}{entry.target ? ' · ' + entry.target : ''}</b>
            <div className="dim xs">{new Date(entry.at).toLocaleString('de-DE')} · {entry.actor}</div>
            {entry.detail && <div>{entry.detail}</div>}
          </div>)}
        </section>
      </>}
    </div>
  </Win>;
}
