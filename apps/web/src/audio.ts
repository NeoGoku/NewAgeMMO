/* Rein synthetisches WebAudio – keine Dateien. Läuft ohne Fehler, wenn kein AudioContext existiert. */
type Wave = OscillatorType;
const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface Group { root: number; scale: number[]; bpm: number; wave: Wave; arp: Wave; chords: number[][]; pulse?: boolean; pad: number; arpP: number }
const GROUPS: Record<string, Group> = {
  city: { root: 57, scale: [0, 3, 5, 7, 10, 12], bpm: 84, wave: 'sawtooth', arp: 'triangle', chords: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [10, 14, 17]], pad: .05, arpP: .6 },
  wild: { root: 50, scale: [0, 2, 3, 5, 7, 9, 10, 12], bpm: 68, wave: 'sine', arp: 'sine', chords: [[0, 7, 10], [5, 9, 12], [3, 7, 10], [7, 10, 14]], pad: .07, arpP: .4 },
  dark: { root: 41, scale: [0, 1, 3, 5, 7, 8, 12], bpm: 52, wave: 'sawtooth', arp: 'sine', chords: [[0, 7, 12], [1, 8, 13], [0, 7, 12], [-2, 5, 10]], pad: .045, arpP: .25 },
  arena: { root: 52, scale: [0, 3, 5, 7, 10, 12], bpm: 108, wave: 'sawtooth', arp: 'square', chords: [[0, 7, 12], [-4, 3, 8], [-2, 5, 10], [-5, 2, 7]], pulse: true, pad: .04, arpP: .8 },
  harbor: { root: 55, scale: [0, 2, 4, 5, 7, 9, 10, 12], bpm: 76, wave: 'triangle', arp: 'triangle', chords: [[0, 4, 7], [10, 14, 17], [5, 9, 12], [0, 4, 7]], pad: .06, arpP: .5 },
};
const THEME_GROUP: Record<string, string> = { city: 'city', market: 'city', industrial: 'city', residential: 'city', guild: 'city', park: 'city', forest: 'wild', mountain: 'wild', moor: 'wild', sky: 'wild', junkyard: 'wild', dungeon: 'dark', void: 'dark', crystal: 'dark', ruins: 'dark', crater: 'dark', arena: 'arena', harbor: 'harbor' };

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null; private musicBus: GainNode | null = null; private sfxBus: GainNode | null = null; private ambBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private vol = { master: .7, music: .5, sfx: .8 };
  private _muted = false;
  private cur: { group: string; bus: GainNode; timer: ReturnType<typeof setInterval>; stop: () => void } | null = null;
  private wantTheme: string | null = null;
  private amb: { gain: GainNode; src: AudioBufferSourceNode; weather: string } | null = null;
  private wantWeather = 'clear'; private thunder: ReturnType<typeof setTimeout> | null = null;
  private lastSfx: Record<string, number> = {};
  private live = 0;

  private get ok() { return !!this.ctx && this.ctx.state !== 'closed'; }
  unlock() {
    try {
      if (!this.ctx) {
        const AC = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }); const C = AC.AudioContext || AC.webkitAudioContext; if (!C) return;
        const ctx = new C(); this.ctx = ctx;
        this.master = ctx.createGain(); this.musicBus = ctx.createGain(); this.sfxBus = ctx.createGain(); this.ambBus = ctx.createGain();
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
        this.musicBus.connect(this.master); this.sfxBus.connect(this.master); this.ambBus.connect(this.master); this.master.connect(comp); comp.connect(ctx.destination);
        const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; l = (l + .02 * w) / 1.02; d[i] = w * .5 + l * 3 * 0; } this.noiseBuf = b;
        this.applyVol();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.wantTheme && !this.cur) this.startMusic(this.wantTheme);
      if (!this.amb) this.setAmbient(this.wantWeather);
    } catch { /* kein Audio */ }
  }
  private applyVol() {
    if (!this.ctx || !this.master) return; const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this._muted ? 0 : this.vol.master, t, .05); this.musicBus!.gain.setTargetAtTime(this.vol.music * .6, t, .05); this.sfxBus!.gain.setTargetAtTime(this.vol.sfx, t, .05); this.ambBus!.gain.setTargetAtTime(this.vol.sfx * .5, t, .05);
  }
  setVolumes(v: { master?: number; music?: number; sfx?: number }) { const cl = (x: number) => Math.max(0, Math.min(1, x)); if (v.master !== undefined) this.vol.master = cl(v.master); if (v.music !== undefined) this.vol.music = cl(v.music); if (v.sfx !== undefined) this.vol.sfx = cl(v.sfx); this.applyVol(); }
  get muted() { return this._muted; }
  set muted(m: boolean) { this._muted = !!m; this.applyVol(); }

  /* ---- Bausteine ---- */
  private tone(f: number, dur: number, type: Wave, vol: number, when = 0, slide = 0, dest?: AudioNode, atk = .005) {
    if (!this.ok || this.live > 90) return; const c = this.ctx!, t0 = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(Math.max(20, f), t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + atk); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); g.connect(dest || this.sfxBus!); o.start(t0); o.stop(t0 + dur + .05); this.live++;
    o.onended = () => { this.live--; try { o.disconnect(); g.disconnect(); } catch { /* */ } };
  }
  private noise(dur: number, type: BiquadFilterType, f0: number, f1: number, vol: number, when = 0, q = 1, dest?: AudioNode) {
    if (!this.ok || !this.noiseBuf || this.live > 90) return; const c = this.ctx!, t0 = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + Math.min(.02, dur / 3)); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxBus!); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + .05); this.live++;
    s.onended = () => { this.live--; try { s.disconnect(); f.disconnect(); g.disconnect(); } catch { /* */ } };
  }
  private seq(notes: number[], step: number, type: Wave, vol: number, len = .18, slide = 0) { notes.forEach((n, i) => this.tone(NOTE(n), len, type, vol, i * step, slide)); }

  /* ---- Soundeffekte ---- */
  sfx(name: string) {
    if (!this.ok || this._muted) return;
    const now = this.ctx!.currentTime, last = this.lastSfx[name] || 0, minGap = name === 'hover' || name === 'step' ? .06 : name === 'hit' || name === 'miss' ? .03 : .015; if (now - last < minGap) return; this.lastSfx[name] = now;
    const T = (f: number, d: number, ty: Wave, v: number, w = 0, s = 0) => this.tone(f, d, ty, v, w, s);
    switch (name) {
      case 'click': T(900, .06, 'square', .06); T(1400, .05, 'sine', .05, .02); break;
      case 'hover': T(1800, .03, 'sine', .025); break;
      case 'hit': this.noise(.12, 'lowpass', 2600, 300, .3); T(160, .12, 'sine', .35, 0, -90); break;
      case 'crit': this.noise(.2, 'bandpass', 3200, 500, .38, 0, 2); T(120, .22, 'sawtooth', .22, 0, -70); this.seq([84, 91], .05, 'square', .06, .12); break;
      case 'miss': this.noise(.16, 'bandpass', 600, 2400, .12, 0, 1.5); break;
      case 'block': T(520, .1, 'square', .12, 0, -200); this.noise(.1, 'highpass', 2000, 4000, .2); T(900, .2, 'triangle', .07, .02); break;
      case 'heal': this.seq([72, 76, 79, 84], .07, 'sine', .11, .35); break;
      case 'levelup': this.seq([60, 64, 67, 72, 76, 79, 84], .09, 'triangle', .14, .5); this.seq([72, 76, 79, 84], .09, 'sine', .08, .9); break;
      case 'coin': T(1319, .09, 'square', .07); T(1760, .22, 'square', .07, .07); break;
      case 'loot': this.seq([76, 81, 88], .06, 'triangle', .1, .22); this.noise(.1, 'highpass', 4000, 6000, .06, .05); break;
      case 'die': T(330, .6, 'sawtooth', .16, 0, -250); T(220, .8, 'sine', .14, .1, -150); this.noise(.5, 'lowpass', 800, 100, .15); break;
      case 'quest': this.seq([67, 71, 74, 79], .1, 'triangle', .12, .4); break;
      case 'equip': this.noise(.08, 'highpass', 3000, 5000, .18); T(300, .1, 'square', .08, .03, -80); break;
      case 'craft': for (let i = 0; i < 3; i++) { this.noise(.07, 'bandpass', 2400, 1800, .22, i * .13, 3); T(1100 + i * 90, .12, 'triangle', .05, i * .13); } break;
      case 'gather': this.noise(.14, 'bandpass', 900, 500, .22, 0, 1.2); T(240, .1, 'triangle', .1, 0, -60); break;
      case 'error': T(200, .16, 'square', .1); T(150, .24, 'square', .1, .13); break;
      case 'travel': this.noise(.6, 'bandpass', 300, 2400, .2, 0, 1.2); T(220, .6, 'sine', .12, 0, 440); break;
      case 'notify': T(880, .12, 'sine', .1); T(1175, .22, 'sine', .1, .1); break;
      case 'step': this.noise(.05, 'lowpass', 900 + Math.random() * 400, 300, .1); break;
      case 'whoosh': this.noise(.28, 'bandpass', 400, 3000, .16, 0, 1.2); break;
      case 'buff': this.seq([67, 72, 76], .06, 'sine', .1, .35); T(1568, .4, 'sine', .04, .1); break;
      case 'summon': T(110, .8, 'sawtooth', .12, 0, 220); this.noise(.7, 'bandpass', 200, 2000, .16, 0, 2); this.seq([60, 67, 72], .12, 'triangle', .08, .5); break;
      case 'cast_shadow': T(150, .5, 'sawtooth', .12, 0, -60); this.noise(.45, 'lowpass', 1200, 150, .16); T(75, .6, 'sine', .12); break;
      case 'cast_light': this.seq([79, 84, 88], .05, 'sine', .1, .4); T(1760, .5, 'triangle', .05, .05); break;
      case 'cast_fire': this.noise(.5, 'bandpass', 500, 1800, .26, 0, .8); T(110, .4, 'sawtooth', .1, 0, 90); break;
      case 'cast_ice': this.seq([88, 91, 95], .04, 'triangle', .07, .3); this.noise(.3, 'highpass', 5000, 8000, .12); break;
      case 'cast_nature': this.noise(.35, 'bandpass', 1200, 700, .1, 0, 3); T(330, .3, 'sine', .08, 0, 150); T(494, .3, 'sine', .06, .08, 110); break;
      case 'cast_arcane': T(440, .4, 'sine', .08, 0, 440); T(660, .4, 'triangle', .06, .05, -200); this.seq([84, 87, 91], .04, 'sine', .05, .25); break;
      case 'cast_phys': this.noise(.14, 'bandpass', 800, 2600, .22, 0, 1.2); T(200, .1, 'square', .06, 0, -100); break;
      case 'cast_holy': this.seq([72, 76, 79, 84], .06, 'sine', .09, .5); T(1046, .7, 'triangle', .04, .1); break;
      case 'boss': T(55, 1.4, 'sawtooth', .22, 0, -10); T(82, 1.2, 'square', .08, .1); this.noise(1, 'lowpass', 600, 80, .25); this.seq([45, 44, 43], .35, 'sawtooth', .1, .5); break;
      case 'chat': T(1568, .05, 'sine', .05); T(2093, .07, 'sine', .04, .04); break;
      default: T(700, .05, 'sine', .04);
    }
  }

  /* ---- Musik ---- */
  startMusic(theme: string) {
    this.wantTheme = theme; if (!this.ok) return;
    const gname = THEME_GROUP[theme] || 'city'; if (this.cur && this.cur.group === gname) return;
    const c = this.ctx!, G = GROUPS[gname], old = this.cur;
    if (old) { clearInterval(old.timer); old.stop(); }
    const bus = c.createGain(); bus.gain.setValueAtTime(.0001, c.currentTime); bus.gain.linearRampToValueAtTime(1, c.currentTime + 3); bus.connect(this.musicBus!);
    const beat = 60 / G.bpm; let nextT = c.currentTime + .2, bar = 0, step = 0; const rnd = () => Math.random();
    const delay = c.createDelay(1); delay.delayTime.value = beat * .75; const fb = c.createGain(); fb.gain.value = .3; const wet = c.createGain(); wet.gain.value = .35; delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(bus);
    const nodes: AudioNode[] = [bus, delay, fb, wet]; let alive = true;
    const voice = (f: number, t0: number, dur: number, type: Wave, vol: number, lp: number, send = false, atk = .01) => {
      const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter(); o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = lp;
      g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + atk); g.gain.setTargetAtTime(.0001, t0 + dur * .7, dur * .2 + .01); o.connect(fl); fl.connect(g); g.connect(bus); if (send) g.connect(delay);
      o.start(t0); o.stop(t0 + dur + .5); o.onended = () => { try { o.disconnect(); fl.disconnect(); g.disconnect(); } catch { /* */ } };
    };
    const schedule = () => {
      if (!alive) return; while (nextT < c.currentTime + 1.5) {
        const chord = G.chords[bar % G.chords.length], q = step % 8;
        if (q === 0) { const dur = beat * 4; for (const iv of chord) { for (const det of [-6, 6]) { const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter(); o.type = G.wave; o.frequency.value = NOTE(G.root + iv); o.detune.value = det; fl.type = 'lowpass'; fl.frequency.value = 700; g.gain.setValueAtTime(.0001, nextT); g.gain.linearRampToValueAtTime(G.pad, nextT + dur * .35); g.gain.linearRampToValueAtTime(.0001, nextT + dur + .4); o.connect(fl); fl.connect(g); g.connect(bus); o.start(nextT); o.stop(nextT + dur + .5); o.onended = () => { try { o.disconnect(); fl.disconnect(); g.disconnect(); } catch { /* */ } }; } }
          voice(NOTE(G.root + chord[0] - 12), nextT, dur, 'sine', .11, 400, false, .1); }
        if (G.pulse && q % 2 === 0) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, nextT); o.frequency.exponentialRampToValueAtTime(40, nextT + .15); g.gain.setValueAtTime(.18, nextT); g.gain.exponentialRampToValueAtTime(.0001, nextT + .18); o.connect(g); g.connect(bus); o.start(nextT); o.stop(nextT + .25); o.onended = () => { try { o.disconnect(); g.disconnect(); } catch { /* */ } }; }
        if (rnd() < G.arpP) { const sc = G.scale, n = G.root + 12 + chord[Math.floor(rnd() * chord.length)] + (rnd() < .3 ? 12 : 0); const nn = rnd() < .35 ? G.root + 12 + sc[Math.floor(rnd() * sc.length)] : n; voice(NOTE(nn), nextT, beat * 1.2, G.arp, G.arp === 'square' ? .03 : .06, 2400, true, .005); }
        nextT += beat / 2; step++; if (step % 8 === 0) bar++;
      }
    };
    schedule(); const timer = setInterval(schedule, 400);
    const stop = () => { alive = false; clearInterval(timer); const t = c.currentTime; try { bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(.0001, t + 2.5); } catch { /* */ } setTimeout(() => { for (const n of nodes) try { n.disconnect(); } catch { /* */ } }, 3200 + 1500); };
    this.cur = { group: gname, bus, timer, stop };
  }
  stopMusic() { this.wantTheme = null; if (this.cur) { clearInterval(this.cur.timer); this.cur.stop(); this.cur = null; } }

  /* ---- Ambiente ---- */
  setAmbient(weather: string) {
    this.wantWeather = weather || 'clear'; if (!this.ok || !this.noiseBuf) return; if (this.amb && this.amb.weather === this.wantWeather) return;
    const c = this.ctx!;
    if (this.amb) { const a = this.amb, ls = this.lfoStop; this.lfoStop = null; a.gain.gain.setTargetAtTime(0, c.currentTime, .6); setTimeout(() => { if (ls) ls(); try { a.src.stop(); a.src.disconnect(); a.gain.disconnect(); } catch { /* */ } }, 2500); this.amb = null; }
    if (this.thunder) { clearTimeout(this.thunder); this.thunder = null; }
    const w = this.wantWeather, src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true; const f = c.createBiquadFilter(), g = c.createGain();
    if (w === 'rain' || w === 'storm') { f.type = 'highpass'; f.frequency.value = w === 'storm' ? 1200 : 1800; g.gain.value = 0; g.gain.setTargetAtTime(w === 'storm' ? .22 : .13, c.currentTime, 1); }
    else { f.type = 'bandpass'; f.frequency.value = w === 'snow' ? 380 : 260; f.Q.value = .6; g.gain.value = 0; g.gain.setTargetAtTime(w === 'fog' ? .09 : .06, c.currentTime, 1.5); const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .12; lg.gain.value = 90; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); src.addEventListener('ended', () => { try { lfo.stop(); lfo.disconnect(); lg.disconnect(); } catch { /* */ } }); this.lfoStop = () => { try { lfo.stop(); lfo.disconnect(); lg.disconnect(); } catch { /* */ } }; }
    src.connect(f); f.connect(g); g.connect(this.ambBus!); src.start(); this.amb = { gain: g, src, weather: w };
    if (w === 'storm') { const boom = () => { if (!this.amb || this.amb.weather !== 'storm') return; this.noise(2.2, 'lowpass', 500, 60, .5, 0, 1); this.tone(55, 1.6, 'sawtooth', .12, .05, -20); this.thunder = setTimeout(boom, 7000 + Math.random() * 9000); }; this.thunder = setTimeout(boom, 4000 + Math.random() * 5000); }
  }
  private lfoStop: (() => void) | null = null;
}
export const audio = new AudioEngine();
