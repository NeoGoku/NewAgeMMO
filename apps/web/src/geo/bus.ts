/** Ereignisse zwischen Spiel-HUD und Weltkarte (Modus, Stopp, Löschen, Zentrieren). */
export const geoBus = new EventTarget();
export const geoDo = (type: 'toggleMode' | 'stop' | 'wipe' | 'recenter' | 'walkTo', detail?: any) => geoBus.dispatchEvent(new CustomEvent(type, { detail }));
