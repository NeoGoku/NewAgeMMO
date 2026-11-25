const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
const editsText = (target: EventTarget | null) => (target as Element | null)?.closest?.(
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
);

export function bindMovementKeys(
  events: EventTarget,
  move: (x: number, y: number) => void,
  canMove: () => boolean,
) {
  const held = new Set<string>();
  const update = () => {
    const x = Number(held.has('KeyD')) - Number(held.has('KeyA'));
    const y = Number(held.has('KeyS')) - Number(held.has('KeyW'));
    const length = Math.hypot(x, y) || 1;
    move(x / length, y / length);
  };
  const reset = () => {
    if (!held.size) return;
    held.clear();
    update();
  };
  const down = (event: Event) => {
    const key = event as KeyboardEvent;
    if (!movementKeys.has(key.code) || key.defaultPrevented || key.isComposing || key.ctrlKey || key.metaKey ||
      key.altKey || editsText(key.target) || !canMove()) return;
    key.preventDefault();
    if (key.repeat || held.has(key.code)) return;
    held.add(key.code);
    update();
  };
  const up = (event: Event) => {
    if (held.delete((event as KeyboardEvent).code)) update();
  };
  const focus = (event: Event) => { if (editsText(event.target)) reset(); };

  events.addEventListener('keydown', down);
  events.addEventListener('keyup', up);
  events.addEventListener('blur', reset);
  events.addEventListener('focusin', focus);
  const dispose = () => {
    events.removeEventListener('keydown', down);
    events.removeEventListener('keyup', up);
    events.removeEventListener('blur', reset);
    events.removeEventListener('focusin', focus);
    reset();
  };
  return { reset, dispose };
}
