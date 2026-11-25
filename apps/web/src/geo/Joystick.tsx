import { useEffect, useRef, useState } from 'react';
import { GEO_STEER_MODES, GEO_TRAVEL_MODES, type GeoSteerMode, type GeoTravelMode } from '@nam/shared';
import { net } from '../net';
import { bindMovementKeys } from './movement-keys';

export function Joystick({ bearing, onStart, available }: { bearing: () => number; onStart: () => void; available: readonly GeoTravelMode[] }) {
  const [preferredMode, setPreferredMode] = useState<GeoSteerMode>('walk');
  const mode = available.includes(preferredMode) ? preferredMode : 'walk';
  const currentMode = useRef(mode);
  currentMode.current = mode;
  const activeMode = useRef<GeoSteerMode>('walk');
  const button = useRef<HTMLButtonElement>(null);
  const pointer = useRef<number | null>(null);
  const input = useRef({ x: 0, y: 0 });
  const sendTimer = useRef<ReturnType<typeof setInterval>>();
  const [knob, setKnob] = useState(input.current);

  const setDirection = (x: number, y: number) => {
    input.current = { x, y };
    setKnob(input.current);
  };
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
    if (sendTimer.current === undefined) return;
    pointer.current = null;
    clearInterval(sendTimer.current);
    sendTimer.current = undefined;
    setDirection(0, 0);
    send();
  };
  const begin = () => {
    activeMode.current = currentMode.current;
    onStart();
    send();
    sendTimer.current = setInterval(send, 160);
  };
  function pointAt(clientX: number, clientY: number) {
    const bounds = button.current?.getBoundingClientRect();
    if (!bounds) return;
    const scale = Math.max(1, bounds.width * .33);
    const x = (clientX - bounds.left - bounds.width / 2) / scale;
    const y = (clientY - bounds.top - bounds.height / 2) / scale;
    const length = Math.hypot(x, y);
    const factor = length < .12 ? 0 : 1 / Math.max(1, length);
    setDirection(x * factor, y * factor);
  }

  useEffect(() => {
    const keys = bindMovementKeys(window, (x, y) => {
      if (pointer.current !== null) return;
      if (!x && !y) {
        stop();
        return;
      }
      setDirection(x, y);
      if (sendTimer.current === undefined) begin();
      else send();
    }, () => pointer.current === null);
    const visibilityChanged = () => {
      if (document.hidden) {
        keys.reset();
        stop();
      }
    };
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', visibilityChanged);
    const stick = button.current!;
    let unbindPointer: () => void;
    if (typeof window.PointerEvent === 'function') {
      const move = (e: PointerEvent) => {
        if (e.pointerId === pointer.current) pointAt(e.clientX, e.clientY);
      };
      const end = (e: PointerEvent) => {
        if (e.pointerId === pointer.current) stop();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      unbindPointer = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
      };
    } else {
      const start = (e: TouchEvent) => {
        if (sendTimer.current !== undefined) return;
        const finger = e.changedTouches[0];
        if (!finger) return;
        e.preventDefault();
        pointer.current = finger.identifier;
        pointAt(finger.clientX, finger.clientY);
        begin();
      };
      const move = (e: TouchEvent) => {
        const finger = Array.from(e.changedTouches).find(t => t.identifier === pointer.current);
        if (!finger) return;
        e.preventDefault();
        pointAt(finger.clientX, finger.clientY);
      };
      const end = (e: TouchEvent) => {
        if (Array.from(e.changedTouches).some(t => t.identifier === pointer.current)) stop();
      };
      stick.addEventListener('touchstart', start, { passive: false });
      stick.addEventListener('touchmove', move, { passive: false });
      stick.addEventListener('touchend', end);
      stick.addEventListener('touchcancel', end);
      unbindPointer = () => {
        stick.removeEventListener('touchstart', start);
        stick.removeEventListener('touchmove', move);
        stick.removeEventListener('touchend', end);
        stick.removeEventListener('touchcancel', end);
      };
    }
    return () => {
      unbindPointer();
      keys.dispose();
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', visibilityChanged);
      stop();
    };
  }, []);

  return <div className="geo-manual" onClick={e => e.stopPropagation()}>
    <select aria-label="Fortbewegung" value={mode} disabled={sendTimer.current !== undefined}
      onChange={e => setPreferredMode(e.target.value as GeoSteerMode)}>
      {GEO_STEER_MODES.filter(id => available.includes(id)).map(id =>
        <option key={id} value={id}>{GEO_TRAVEL_MODES[id].label}</option>)}
    </select>
    <button ref={button} type="button" className="geo-stick" aria-label="Virtueller Joystick"
      title="Auf dem PC auch mit W, A, S und D bewegen" onContextMenu={e => e.preventDefault()}
      onPointerDown={e => {
        if (sendTimer.current !== undefined || e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        pointer.current = e.pointerId;
        try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* Window handlers track the pointer. */ }
        pointAt(e.clientX, e.clientY);
        begin();
      }}
      onLostPointerCapture={e => { if (e.pointerId === pointer.current) stop(); }}>
      <span aria-hidden="true" style={{ transform: `translate(${knob.x * 26}px, ${knob.y * 26}px)` }} />
    </button>
  </div>;
}
