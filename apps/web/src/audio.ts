// Original procedural sounds. The game remains playable without Web Audio.
type Wave = 'sine' | 'triangle';
type Volumes = { master: number; music: number; ambience: number; sfx: number };
const note = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const defaults: Volumes = { master: .8, music: .5, ambience: .25, sfx: .8 };
const fadeFloor = .0001;

interface Theme {
  bpm: number;
  chords: number[][];
  melody: (number | null)[];
}

const themes: Record<string, Theme> = {
  city: { bpm: 74, chords: [[48, 55, 64], [45, 55, 60], [41, 53, 60], [43, 55, 62]], melody: [67, 69, 72, 67, 65, null, 69, 67] },
  wild: { bpm: 63, chords: [[50, 57, 60], [46, 53, 62], [48, 55, 64], [53, 57, 60]], melody: [62, null, 65, 69, 67, null, 65, 62] },
  dark: { bpm: 59, chords: [[45, 52, 60], [41, 53, 60], [48, 55, 64], [43, 55, 62]], melody: [64, null, 60, 65, 67, null, 62, null] },
  arena: { bpm: 98, chords: [[48, 55, 63], [44, 51, 60], [46, 53, 62], [43, 55, 62]], melody: [67, 72, 68, 72, 70, 74, 67, 62] },
  harbor: { bpm: 70, chords: [[43, 55, 59], [48, 55, 64], [45, 52, 60], [50, 57, 66]], melody: [67, 71, 72, null, 69, 72, 69, 66] },
};
const themeGroup: Record<string, string> = {
  city: 'city', market: 'city', industrial: 'city', residential: 'city', guild: 'city', park: 'city',
  forest: 'wild', mountain: 'wild', moor: 'wild', sky: 'wild', junkyard: 'wild',
  dungeon: 'dark', void: 'dark', crystal: 'dark', ruins: 'dark', crater: 'dark',
  arena: 'arena', harbor: 'harbor',
};

class AudioEngine {
  private ctx?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private sfxBus?: GainNode;
  private ambBus?: GainNode;
  private noiseBuffer?: AudioBuffer;
  private vol = { ...defaults };
  private _muted = false;
  private theme?: string;
  private music?: { group: string; bus: GainNode; timer: ReturnType<typeof setInterval> };
  private weather = 'clear';
  private ambienceTimer?: ReturnType<typeof setTimeout>;
  private lastSfx: Record<string, number> = {};

  unlock() {
    try {
      if (!this.ctx) {
        const env = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
        const Context = env.AudioContext || env.webkitAudioContext;
        if (!Context) return;
        const ctx = this.ctx = new Context();
        this.master = ctx.createGain();
        this.musicBus = ctx.createGain();
        this.sfxBus = ctx.createGain();
        this.ambBus = ctx.createGain();
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        this.ambBus.connect(this.master);
        this.master.connect(ctx.destination);
        this.applyVol(true);

        const buffer = this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const samples = buffer.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < samples.length; i++) {
          const white = Math.random() * 2 - 1;
          previous = .86 * previous + .14 * white;
          samples[i] = previous;
        }
        if (this.theme) this.startMusic(this.theme);
        this.updateAmbience();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    } catch { /* keep audio optional */ }
  }

  private applyVol(immediate = false) {
    if (!this.ctx || !this.master || !this.musicBus || !this.ambBus || !this.sfxBus) return;
    const at = this.ctx.currentTime;
    const adjust = (bus: GainNode, level: number) => {
      bus.gain.cancelScheduledValues(at);
      if (immediate) bus.gain.setValueAtTime(level, at);
      else bus.gain.setTargetAtTime(level, at, .035);
    };
    adjust(this.master, this._muted ? 0 : this.vol.master);
    adjust(this.musicBus, this.vol.music * .65);
    adjust(this.ambBus, this.vol.ambience * .55);
    adjust(this.sfxBus, this.vol.sfx * .9);
  }

  setVolumes(values: Partial<Volumes>) {
    for (const key of Object.keys(defaults) as (keyof Volumes)[]) {
      const level = values[key];
      if (typeof level === 'number' && Number.isFinite(level)) this.vol[key] = Math.max(0, Math.min(1, level));
    }
    this.applyVol();
    this.updateAmbience();
  }

  get muted() { return this._muted; }
  set muted(muted: boolean) {
    this._muted = muted;
    this.applyVol();
    this.updateAmbience();
  }

  private tone(bus: AudioNode, f: number, length: number, level: number, offset = 0, wave: Wave = 'sine', end = f, attack = .012) {
    const ctx = this.ctx!;
    const at = ctx.currentTime + offset;
    const voice = ctx.createOscillator();
    const gain = ctx.createGain();
    voice.type = wave;
    voice.frequency.setValueAtTime(f, at);
    if (end !== f) voice.frequency.exponentialRampToValueAtTime(end, at + length);
    gain.gain.setValueAtTime(fadeFloor, at);
    gain.gain.linearRampToValueAtTime(level, at + attack);
    gain.gain.exponentialRampToValueAtTime(fadeFloor, at + length);
    voice.connect(gain).connect(bus);
    voice.onended = () => { voice.disconnect(); gain.disconnect(); };
    voice.start(at);
    voice.stop(at + length + .01);
  }

  private texture(bus: AudioNode, frequency: number, length: number, level: number, offset = 0, attack = .022) {
    const ctx = this.ctx!;
    const at = ctx.currentTime + offset;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer!;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = .65;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(fadeFloor, at);
    gain.gain.linearRampToValueAtTime(level, at + attack);
    gain.gain.exponentialRampToValueAtTime(fadeFloor, at + length);
    source.connect(filter).connect(gain).connect(bus);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(at, Math.random() * .35);
    source.stop(at + length + .01);
  }

  sfx(name: string) {
    if (!this.ctx || !this.sfxBus || this._muted || !this.vol.master || !this.vol.sfx || document.hidden) return;
    const now = this.ctx.currentTime;
    const minGap = name === 'step' ? .25 : name === 'hit' || name === 'crit' ? .13 : .08;
    if (now - (this.lastSfx[name] ?? -Infinity) < minGap) return;
    this.lastSfx[name] = now;

    const bus = this.sfxBus;
    const t = (f: number, length: number, level: number, offset = 0, wave: Wave = 'sine', end = f) =>
      this.tone(bus, f, length, level, offset, wave, end);
    const texture = (f: number, length: number, level: number) => this.texture(bus, f, length, level);
    const phrase = (notes: number[], step: number, level: number, length = .25) =>
      notes.forEach((n, i) => t(note(n), length, level, i * step, 'triangle'));

    switch (name) {
      case 'click': t(670, .075, .075, 0, 'sine', 430); break;
      case 'hover': t(830, .045, .025); break;
      case 'hit': t(155, .125, .18, 0, 'sine', 72); texture(620, .085, .09); break;
      case 'crit': t(165, .17, .18, 0, 'triangle', 78); t(590, .16, .055, .015, 'sine', 350); texture(840, .1, .10); break;
      case 'miss': texture(730, .18, .09); break;
      case 'block': t(440, .13, .095, 0, 'triangle', 322); texture(980, .1, .075); break;
      case 'heal': phrase([64, 67, 72], .07, .065, .34); break;
      case 'levelup': phrase([60, 64, 67, 72, 76], .085, .09, .38); break;
      case 'coin': phrase([76, 83], .055, .075, .21); break;
      case 'loot': phrase([72, 76, 79], .065, .075); break;
      case 'die': phrase([53, 50, 48], .14, .095, .37); break;
      case 'quest': phrase([67, 69, 72, 76], .09, .09, .32); break;
      case 'equip': t(390, .12, .075, 0, 'triangle', 300); texture(960, .1, .065); break;
      case 'craft': phrase([64, 64, 67], .1, .065, .13); texture(810, .12, .07); break;
      case 'gather': texture(640, .13, .085); t(255, .12, .075, .025, 'triangle', 155); break;
      case 'error': phrase([57, 53], .1, .075, .19); break;
      case 'travel': phrase([55, 62, 67], .08, .06, .32); break;
      case 'notify': phrase([69, 74], .09, .07); break;
      case 'step':
        texture(390 + Math.random() * 100, .10, .10);
        t(104, .085, .045, 0, 'sine', 74);
        break;
      case 'whoosh': texture(790, .23, .11); break;
      case 'buff': phrase([67, 72, 76], .06, .06, .31); break;
      case 'summon': phrase([50, 57, 62, 65], .095, .075, .31); break;
      case 'cast_shadow': t(190, .3, .09, 0, 'triangle', 113); t(285, .23, .045, .05, 'sine', 170); break;
      case 'cast_light': phrase([72, 76, 79], .055, .065, .29); break;
      case 'cast_fire': t(170, .23, .085, 0, 'triangle', 98); texture(780, .22, .095); break;
      case 'cast_ice': phrase([79, 84, 88], .045, .065, .31); break;
      case 'cast_nature': t(255, .25, .08, 0, 'sine', 405); texture(585, .18, .045); break;
      case 'cast_arcane': t(312, .26, .072, 0, 'sine', 625); phrase([74, 81], .07, .06); break;
      case 'cast_phys': t(210, .15, .11, 0, 'sine', 104); texture(670, .14, .075); break;
      case 'cast_holy': phrase([65, 69, 72, 77], .07, .065, .34); break;
      case 'boss': phrase([45, 48, 52], .17, .09, .4); break;
      case 'chat': phrase([76, 79], .045, .04, .10); break;
      default: t(620, .075, .04);
    }
  }

  startMusic(theme: string) {
    this.theme = theme;
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const group = themeGroup[theme] ?? 'city';
    if (this.music?.group === group) return;
    this.fadeMusic();

    const score = themes[group];
    const beat = 60 / score.bpm;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + .8);
    bus.connect(this.musicBus);

    let bar = 0;
    let next = ctx.currentTime + .08;
    const schedule = () => {
      if (ctx.state !== 'running' || document.hidden) return;
      const at = ctx.currentTime;
      if (next > at + .25) return;
      if (next < at) next = at + .05;
      const offset = next - at;
      // Leave a bar of rest after each four-bar phrase.
      if (this.vol.music && this.vol.master && !this._muted && bar % 5 !== 4) {
        const measure = bar - Math.floor(bar / 5);
        const chord = score.chords[measure % score.chords.length];
        chord.forEach((pitch, i) => this.tone(bus, note(pitch), beat * 3.5, .044, offset + i * .06, 'sine', note(pitch), beat * .55));
        for (let i = 0; i < 2; i++) {
          const n = score.melody[(measure * 2 + i) % score.melody.length];
          if (n !== null) this.tone(bus, note(n), beat * 1.45, .035, offset + beat * (1 + i * 1.5), 'triangle', note(n), .055);
        }
      }
      next += beat * 4;
      bar++;
    };
    schedule();
    this.music = { group, bus, timer: setInterval(schedule, 120) };
  }

  stopMusic() {
    this.theme = undefined;
    this.fadeMusic();
  }

  private fadeMusic() {
    if (!this.music || !this.ctx) return;
    const { bus, timer } = this.music;
    clearInterval(timer);
    bus.gain.cancelScheduledValues(this.ctx.currentTime);
    bus.gain.setTargetAtTime(0, this.ctx.currentTime, .13);
    setTimeout(() => bus.disconnect(), 650);
    this.music = undefined;
  }

  setAmbient(weather: string) {
    if (this.weather === weather) return;
    this.weather = weather;
    clearTimeout(this.ambienceTimer);
    this.ambienceTimer = undefined;
    this.updateAmbience();
  }

  private updateAmbience() {
    if (!this.ctx || !this.ambBus || this._muted || !this.vol.master || !this.vol.ambience) {
      clearTimeout(this.ambienceTimer);
      this.ambienceTimer = undefined;
      return;
    }
    if (this.ambienceTimer || !['rain', 'storm', 'snow'].includes(this.weather)) return;
    const bus = this.ambBus;
    const storm = this.weather === 'storm';
    const snow = this.weather === 'snow';
    // Weather is a soft, brief accent. Quiet weather leaves the ambience bus silent.
    this.ambienceTimer = setTimeout(() => {
      this.ambienceTimer = undefined;
      if (!document.hidden && this.ctx?.state === 'running') {
        this.texture(bus, snow ? 360 : 850, 1.55, storm ? .16 : .10, 0, .28);
        if (storm && Math.random() < .35) this.tone(bus, 64, 1.45, .075, 0, 'sine', 43, .18);
      }
      this.updateAmbience();
    }, (storm ? 4000 : 6500) + Math.random() * 5000);
  }
}

export const audio = new AudioEngine();
