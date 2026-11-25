import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { GEO_STEER_MODES, GEO_TRAVEL_MODES, type GeoSteerMode, type GeoTravelMode } from '@nam/shared';
import { net } from '../net';

export function Joystick({ bearing, onStart, available }: { bearing: () => number; onStart: () => void; available: readonly GeoTravelMode[] }) {
  const [preferredMode, setPreferredMode] = useState<GeoSteerMode>('walk');
  const mode = available.includes(preferredMode) ? preferredMode : 'walk';
  const activeMode = useRef<GeoSteerMode>('walk');
  const pointer = useRef<number | null>(null);
  const input = useRef({ x: 0, y: 0 });
  const sendTimer = useRef<ReturnType<typeof setInterval>>();
  const [knob, setKnob] = useState(input.current);

  const send = () => {
    const { x, y } = input.current;
    const angle = bearing() * Math.PI / 180;
    net.send('geoSteer', {
      mode: activeMode.current,
      east: Math.max(-1, Math.min(1, x * Math.cos(angle) - y * Math.sin(angle))),
      north: Math.max(-1, Math.min(1, -x * Math.sin(angle) - y * Math.cos(angle)))
    });
  };
  const stop = () => {
    if (pointer.current === null) return;
    pointer.current = null;
    clearInterval(sendTimer.current);
    input.current = { x: 0, y: 0 };
    send();
    setKnob(input.current);
  };
  useEffect(() => {
    window.addEventListener('blur', stop);
    return () => { window.removeEventListener('blur', stop); stop(); };
  }, []);

  function update(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerId !== pointer.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = Math.max(1, bounds.width * 0.33);
    const x = (event.clientX - bounds.left - bounds.width / 2) / scale;
    const y = (event.clientY - bounds.top - bounds.height / 2) / scale;
    const length = Math.hypot(x, y);
    const factor = length < 0.12 ? 0 : 1 / Math.max(1, length);
    input.current = { x: x * factor, y: y * factor };
    setKnob(input.current);
  }

  return <div className="geo-manual" onClick={e => e.stopPropagation()}>
    <select aria-label="Fortbewegung mit Joystick" value={mode} disabled={pointer.current !== null}
      onChange={e => setPreferredMode(e.target.value as GeoSteerMode)}>
      {GEO_STEER_MODES.filter(id => available.includes(id)).map(id =>
        <option key={id} value={id}>{GEO_TRAVEL_MODES[id].label}</option>)}
    </select>
    <button type="button" className="geo-stick" aria-label="Virtueller Joystick" onClick={e => e.stopPropagation()}
    onPointerDown={e => {
      if (pointer.current !== null || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      pointer.current = e.pointerId;
      activeMode.current = mode;
      e.currentTarget.setPointerCapture(e.pointerId);
      onStart();
      update(e);
      send();
      sendTimer.current = setInterval(send, 160);
    }}
    onPointerMove={update} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
    <span aria-hidden="true" style={{ transform: `translate(${knob.x * 26}px, ${knob.y * 26}px)` }} />
    </button>
  </div>;
}
