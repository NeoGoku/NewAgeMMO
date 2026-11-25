import { Ctx, TAU, pr } from './util';

export function drawWeather(ctx: Ctx, w: number, h: number, weather: string, t: number) {
  if (!weather || weather === 'clear') return;
  const sec = t / 1000;
  if (weather === 'rain' || weather === 'storm') {
    const n = weather === 'storm' ? 220 : 130, sp = weather === 'storm' ? 1.5 : 1, slant = weather === 'storm' ? .35 : .16;
    ctx.save(); ctx.strokeStyle = 'rgba(170,200,255,.45)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const lay = .6 + pr(i + 7) * .8, fall = (sec * (600 + 500 * lay) * sp + pr(i) * h * 2) % (h + 60), y = fall - 30, x = ((pr(i + 100) * (w + 200) - fall * slant) % (w + 200) + w + 200) % (w + 200) - 100, len = 9 + 9 * lay;
      ctx.moveTo(x, y); ctx.lineTo(x - len * slant, y + len);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190,215,255,.35)';
    for (let i = 0; i < 18; i++) { const ph = ((sec * 2.2 + pr(i + 300)) % 1), x = pr(i + 400) * w, y = h * .55 + pr(i + 500) * h * .4; ctx.globalAlpha = (1 - ph) * .7; ctx.beginPath(); ctx.ellipse(x, y, 2 + ph * 7, (2 + ph * 7) * .35, 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
    if (weather === 'storm') {
      const cyc = (sec % 6.5), fl = cyc < .12 ? 1 : cyc > .3 && cyc < .4 ? .6 : 0;
      if (fl > 0) {
        ctx.fillStyle = `rgba(230,235,255,${.35 * fl})`; ctx.fillRect(0, 0, w, h);
        const seed = Math.floor(sec / 6.5); let x = w * (.15 + pr(seed + 3) * .7), y = 0; ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${fl})`; ctx.shadowColor = '#9ab8ff'; ctx.shadowBlur = 16; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y);
        for (let i = 0; i < 9; i++) { x += (pr(seed * 13 + i) - .5) * 70; y += h * .5 / 9; ctx.lineTo(x, y); } ctx.stroke(); ctx.restore();
      }
    }
  } else if (weather === 'snow') {
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 120; i++) { const lay = .5 + pr(i) * 1; const y = (sec * 40 * lay + pr(i + 11) * h) % (h + 10) - 5, x = (pr(i + 33) * w + Math.sin(sec * .8 + i) * 22) % w; ctx.globalAlpha = .4 + lay * .4; ctx.beginPath(); ctx.arc(x < 0 ? x + w : x, y, .8 + lay * 1.4, 0, TAU); ctx.fill(); }
    ctx.restore(); ctx.fillStyle = 'rgba(220,235,255,.05)'; ctx.fillRect(0, 0, w, h);
  } else if (weather === 'fog') {
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const sp = 8 + i * 3, x = ((pr(i + 1) * w * 1.5 + sec * sp) % (w * 1.5)) - w * .25, y = h * (.38 + (i % 4) * .13) + Math.sin(sec * .3 + i) * 8, r = w * .35;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(200,210,225,.28)'); g.addColorStop(1, 'rgba(200,210,225,0)');
      ctx.save(); ctx.translate(x, y); ctx.scale(1, .28); ctx.translate(-x, -y); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
    }
    const g = ctx.createLinearGradient(0, h * .3, 0, h * .8); g.addColorStop(0, 'rgba(190,200,215,0)'); g.addColorStop(.5, 'rgba(190,200,215,.22)'); g.addColorStop(1, 'rgba(190,200,215,.1)'); ctx.fillStyle = g; ctx.fillRect(0, h * .3, w, h * .5);
    ctx.restore();
  }
}
