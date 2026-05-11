const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const lanes = [230, 480, 730];
const keys = ['KeyA', 'KeyS', 'KeyD'];
const laneLabels = ['A', 'S', 'D'];
const bpm = 108;
const beatSec = 60 / bpm;
const travelSec = 1.55;
const hitY = 450;
const spawnY = -40;

const design = {
  palette: {
    bgTop: '#120B2E',
    bgBottom: '#1D103D',
    lanePanel: '#2B1D59',
    laneLine: '#A796FF',
    hitLine: '#F27EB4',
    text: '#F8F4FF',
    noteA: '#07D98C',
    noteS: '#4227F2',
    noteD: '#F27EB4',
    noteInk: '#1A1233'
  }
};

const today = new Date().toISOString().slice(0, 10);
const streakKey = 'kitten_beat_streak';
const bestKey = `kitten_beat_best_${today}`;

const state = {
  running: false,
  over: false,
  started: false,
  score: 0,
  combo: 0,
  maxCombo: 0,
  health: 12,
  time: 0,
  notes: [],
  particles: [],
  beatPulse: 0,
  reduceMotion: false,
  kittensMood: 0,
  best: Number(localStorage.getItem(bestKey) || 0),
  streak: JSON.parse(localStorage.getItem(streakKey) || '{"last":"","days":0}'),
  runRecorded: false,
  feedback: '',
  feedbackTime: 0,
  stars: [],
  sprites: null,
  uiSprites: null,
  songStartTime: 0,
  graceWindow: 0
};

function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (1664525 * s + 1013904223) >>> 0) / 4294967296;
}
const random = rng(Number(today.replaceAll('-', '')));

function buildStars() {
  state.stars.length = 0;
  for (let i = 0; i < 80; i++) {
    state.stars.push({ x: random() * canvas.width, y: random() * canvas.height, r: 1 + random() * 2, tw: random() * Math.PI * 2 });
  }
}

function createChart() {
  const chart = [];
  let t = 2;
  for (let i = 0; i < 140; i++) {
    const lane = Math.floor(random() * 3);
    chart.push({ lane, hitTime: t, judged: false });
    if (i > 18 && random() < 0.13) chart.push({ lane: (lane + 1 + Math.floor(random() * 2)) % 3, hitTime: t + beatSec * 0.5, judged: false });
    const section = i < 32 ? 1.28 : (i < 90 ? 1.04 : 0.9);
    const burst = (i > 100 && random() < 0.18) ? 0.75 : 1;
    t += beatSec * (random() < 0.22 ? 0.5 : 1) * section * burst;
  }
  return chart.sort((a, b) => a.hitTime - b.hitTime);
}

function recordDailyRun() {
  if (state.runRecorded) return;
  state.runRecorded = true;
  if (state.streak.last !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    state.streak.days = state.streak.last === yesterday ? state.streak.days + 1 : 1;
    state.streak.last = today;
    localStorage.setItem(streakKey, JSON.stringify(state.streak));
  }
}

function drawRoundedRect(x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y); ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr); ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h); ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr); ctx.arcTo(x, y, x + rr, y, rr);
}


function buildSprites() {
  const sheet = document.createElement('canvas');
  sheet.width = 256; sheet.height = 128;
  const sctx = sheet.getContext('2d');

  const colors = [design.palette.noteA, design.palette.noteS, design.palette.noteD];
  colors.forEach((c, i) => {
    const x = 12 + i * 82;
    sctx.fillStyle = c;
    sctx.strokeStyle = '#ffffff55';
    sctx.lineWidth = 2;
    sctx.beginPath();
    sctx.roundRect(x, 14, 72, 38, 10);
    sctx.fill();
    sctx.stroke();
    sctx.fillStyle = design.palette.noteInk;
    sctx.font = 'bold 18px Trebuchet MS';
    sctx.fillText(laneLabels[i], x + 30, 39);
  });

  // kitten sticker sprite
  sctx.strokeStyle = '#ffffffcc';
  sctx.lineWidth = 4;
  sctx.fillStyle = '#ffd9ec';
  sctx.beginPath(); sctx.ellipse(62, 94, 38, 34, 0, 0, Math.PI * 2); sctx.fill(); sctx.stroke();
  sctx.beginPath(); sctx.moveTo(36, 73); sctx.lineTo(44, 46); sctx.lineTo(54, 72); sctx.fill();
  sctx.beginPath(); sctx.moveTo(88, 73); sctx.lineTo(80, 46); sctx.lineTo(70, 72); sctx.fill();
  sctx.fillStyle = '#40223f';
  sctx.fillStyle = '#ff8fc6'; sctx.beginPath(); sctx.ellipse(43, 101, 7, 4, 0, 0, 6.3); sctx.ellipse(81, 101, 7, 4, 0, 0, 6.3); sctx.fill();
  sctx.fillStyle = '#40223f';
  sctx.beginPath(); sctx.arc(50, 92, 4, 0, 7); sctx.arc(74, 92, 4, 0, 7); sctx.fill();
  sctx.lineWidth = 3; sctx.beginPath(); sctx.arc(62, 104, 9, 0, Math.PI); sctx.stroke();

  state.sprites = {
    sheet,
    noteRects: [
      { x: 12, y: 14, w: 72, h: 38 },
      { x: 94, y: 14, w: 72, h: 38 },
      { x: 176, y: 14, w: 72, h: 38 }
    ],
    kitten: { x: 24, y: 58, w: 76, h: 72 }
  };
}


function buildUiSprites() {
  const panel = document.createElement('canvas');
  panel.width = 420; panel.height = 180;
  const pctx = panel.getContext('2d');

  const makeBadge = (text, y, c1, c2) => {
    const g = pctx.createLinearGradient(40, y, 380, y + 58);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    pctx.fillStyle = g;
    pctx.beginPath(); pctx.roundRect(40, y, 340, 58, 18); pctx.fill();
    pctx.strokeStyle = '#ffffff88'; pctx.lineWidth = 3;
    pctx.stroke();
    pctx.fillStyle = '#fff'; pctx.font = 'bold 38px Trebuchet MS';
    pctx.fillText(text, 145, y + 40);
  };

  makeBadge('READY', 24, '#4227F2', '#F27EB4');
  makeBadge('GO!', 98, '#07D98C', '#4227F2');

  state.uiSprites = { panel };
}

function kittenSprite(x, y, hype, hueShift = 0) {
  const bob = Math.sin(state.time * 5 + hueShift) * (3 + 5 * hype);
  const blink = Math.sin(state.time * 2.2 + hueShift) > 0.96 ? 0.2 : 1;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(0.84 + hype * 0.06, 0.9 + hype * 0.05);

  // slim tail with depth
  const tailGrad = ctx.createLinearGradient(26, 14, 86, -32);
  tailGrad.addColorStop(0, '#d89abf');
  tailGrad.addColorStop(1, '#f8d6e8');
  ctx.strokeStyle = tailGrad;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(36, 34);
  ctx.quadraticCurveTo(88, 16 + Math.sin(state.time * 5) * 5, 74, -26);
  ctx.stroke();

  // body (less "fat", more elegant oval)
  const bodyGrad = ctx.createRadialGradient(-10, -20, 10, 0, 8, 78);
  bodyGrad.addColorStop(0, '#fff6fb');
  bodyGrad.addColorStop(0.45, '#ffd9ec');
  bodyGrad.addColorStop(1, '#d9a7c8');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath(); ctx.ellipse(0, 8, 52, 62, 0, 0, Math.PI * 2); ctx.fill();

  // ears with fur tint
  ctx.fillStyle = '#f8d2e6';
  ctx.beginPath(); ctx.moveTo(-32, -33); ctx.lineTo(-19, -78); ctx.lineTo(-4, -28); ctx.fill();
  ctx.beginPath(); ctx.moveTo(32, -33); ctx.lineTo(19, -78); ctx.lineTo(4, -28); ctx.fill();
  ctx.fillStyle = '#ff9bcf';
  ctx.beginPath(); ctx.moveTo(-23, -41); ctx.lineTo(-18, -66); ctx.lineTo(-11, -37); ctx.fill();
  ctx.beginPath(); ctx.moveTo(23, -41); ctx.lineTo(18, -66); ctx.lineTo(11, -37); ctx.fill();

  // eyes with iris and shine
  ctx.fillStyle = '#1f1b32';
  ctx.save(); ctx.translate(-14, -6); ctx.scale(1, blink); ctx.beginPath(); ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(14, -6); ctx.scale(1, blink); ctx.beginPath(); ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#6de0ff';
  ctx.beginPath(); ctx.ellipse(-14, -6, 3.3, 5.2, 0, 0, Math.PI * 2); ctx.ellipse(14, -6, 3.3, 5.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-12, -11, 2.4, 0, Math.PI * 2); ctx.arc(16, -11, 2.4, 0, Math.PI * 2); ctx.fill();

  // muzzle + nose + mouth
  ctx.fillStyle = '#ffe8f4';
  ctx.beginPath(); ctx.ellipse(0, 16, 18, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f274b6';
  ctx.beginPath(); ctx.moveTo(0, 11); ctx.lineTo(-4, 16); ctx.lineTo(4, 16); ctx.fill();
  ctx.strokeStyle = '#5f3f67'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(-4, 20, 6, 0.2, 2.8); ctx.stroke();
  ctx.beginPath(); ctx.arc(4, 20, 6, 0.35, 2.95); ctx.stroke();

  // whiskers
  ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 1.4;
  for (const side of [-1, 1]) {
    const bx = side * 11;
    ctx.beginPath(); ctx.moveTo(bx, 16); ctx.lineTo(bx + side * 19, 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, 19); ctx.lineTo(bx + side * 20, 21); ctx.stroke();
  }

  // soft blush + paws
  ctx.fillStyle = '#ff8fbf66';
  ctx.beginPath(); ctx.ellipse(-28, 14, 8, 5, 0, 0, Math.PI * 2); ctx.ellipse(28, 14, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
  const pawY = 58 + Math.sin(state.time * 12 + hueShift) * (2 + 8 * hype);
  ctx.fillStyle = '#f8c5df';
  ctx.beginPath(); ctx.ellipse(-27, pawY, 11, 8, 0, 0, Math.PI * 2); ctx.ellipse(27, pawY, 11, 8, 0, 0, Math.PI * 2); ctx.fill();

  // rim light for depth
  ctx.strokeStyle = '#ffffff66';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(-8, -16, 34, 3.3, 4.9); ctx.stroke();

  ctx.restore();
}

function spawnBurst(x, y, color) {
  for (let i = 0; i < 20; i++) state.particles.push({ x, y, vx: (Math.random() - 0.5) * 280, vy: (Math.random() - 0.5) * 260, life: 0.6, color });
}

function judgeLane(laneIdx) {
  const windowPerfect = 0.085;
  const windowGood = 0.165;
  let candidate = null;
  for (const n of state.notes) {
    if (n.judged || n.lane !== laneIdx) continue;
    const dt = Math.abs(n.hitTime - state.time);
    if (dt < windowGood && (!candidate || dt < candidate.dt)) candidate = { n, dt };
  }
  if (!candidate) return;

  candidate.n.judged = true;
  if (candidate.dt < windowPerfect) {
    state.score += 130 + state.combo * 2;
    state.combo++;
    state.maxCombo = Math.max(state.combo, state.maxCombo);
    state.kittensMood = Math.min(1, state.kittensMood + 0.08);
    state.feedback = 'PURR-FECT!';
    spawnBurst(lanes[laneIdx], hitY, '#9dffb0');
  } else {
    state.score += 75;
    state.combo++;
    state.feedback = 'Nice!';
    spawnBurst(lanes[laneIdx], hitY, '#ffe28a');
  }
  state.feedbackTime = 0.45;
}

window.addEventListener('keydown', (e) => {
  if (!state.started && e.code === 'Space') { state.started = true; state.running = true; state.songStartTime = state.time + 3; state.graceWindow = 3; return; }
  if (e.code === 'KeyP' && state.started) state.running = !state.running;
  if (e.code === 'KeyM') state.reduceMotion = !state.reduceMotion;
  if (e.code === 'KeyR' && state.over) window.location.reload();
  const idx = keys.indexOf(e.code);
  if (idx >= 0 && state.running && !state.over) judgeLane(idx);
});

function update(dt) {
  state.time += dt;
  if (!state.running || state.over) return;

  state.beatPulse = Math.max(0, state.beatPulse - dt * 3.0);
  state.graceWindow = Math.max(0, state.songStartTime - state.time);
  if ((state.time / beatSec | 0) !== ((state.time - dt) / beatSec | 0)) state.beatPulse = 1;
  state.feedbackTime = Math.max(0, state.feedbackTime - dt);

  for (const n of state.notes) {
    if (state.time >= state.songStartTime && !n.judged && state.time - n.hitTime > 0.18) {
      n.judged = true;
      state.combo = 0;
      state.health -= 1;
      state.feedback = 'Miss';
      state.feedbackTime = 0.3;
      state.kittensMood = Math.max(0, state.kittensMood - 0.1);
    }
  }

  state.particles = state.particles.filter((p) => (p.life -= dt) > 0);
  for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }

  if (state.health <= 0 || state.notes.every((n) => n.judged)) {
    state.over = true;
    recordDailyRun();
    if (state.score > state.best) { state.best = state.score; localStorage.setItem(bestKey, String(state.best)); }
  }
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, design.palette.bgTop); grad.addColorStop(1, design.palette.bgBottom);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const s of state.stars) {
    const a = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(state.time * 1.2 + s.tw));
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
}

function draw() {
  drawBackground();
  const pulse = 1 + state.beatPulse * (state.reduceMotion ? 0.015 : 0.04);
  ctx.save();
  ctx.scale(pulse, pulse);
  ctx.translate((1 - pulse) * canvas.width / 2 / pulse, (1 - pulse) * canvas.height / 2 / pulse);

  ctx.fillStyle = design.palette.lanePanel; ctx.fillRect(200, 40, 620, 460);
  ctx.strokeStyle = design.palette.laneLine; ctx.lineWidth = 2;
  lanes.forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x, 500); ctx.stroke(); });
  ctx.fillStyle = design.palette.hitLine; ctx.fillRect(200, hitY, 620, 6);

  ctx.font = '20px Trebuchet MS';
  for (const n of state.notes) {
    if (n.judged && n.hitTime < state.time - 0.2) continue;
    const progress = 1 - ((n.hitTime - state.time) / travelSec);
    const y = spawnY + (hitY - spawnY) * progress;
    if (y < -60 || y > 560) continue;
    const r = state.sprites.noteRects[n.lane];
    ctx.shadowColor = ['#07D98C', '#6670ff', '#ff7dbd'][n.lane];
    ctx.shadowBlur = 12;
    ctx.drawImage(state.sprites.sheet, r.x, r.y, r.w, r.h, lanes[n.lane] - 42, y - 18, 84, 36);
    ctx.shadowBlur = 0;
  }

  kittenSprite(120, 340, state.kittensMood, 0);
  kittenSprite(840, 340, state.kittensMood * 0.8, 22);
  const ks = state.sprites.kitten;
  ctx.globalAlpha = 0.85;
  ctx.drawImage(state.sprites.sheet, ks.x, ks.y, ks.w, ks.h, 430, 72, 52, 50);
  ctx.drawImage(state.sprites.sheet, ks.x, ks.y, ks.w, ks.h, 500, 72, 52, 50);
  ctx.globalAlpha = 1;

  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life * 2);
    if (state.reduceMotion && Math.random() < 0.45) continue;
    ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 5, 5);
  }
  ctx.globalAlpha = 1;

  if (state.feedbackTime > 0) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 36px Trebuchet MS';
    ctx.fillText(state.feedback, 430, 190);
  }

  ctx.restore();
  ctx.fillStyle = design.palette.text; ctx.font = '20px Trebuchet MS';
  ctx.fillText(`Score: ${state.score}`, 20, 32);
  ctx.fillText(`Combo: ${state.combo}`, 20, 58);
  ctx.fillText(`Max Combo: ${state.maxCombo}`, 20, 84);
  ctx.fillText(`Best today (${today}): ${state.best}`, 20, 110);
  ctx.fillText(`Streak days: ${state.streak.days}`, 20, 136);
  ctx.fillText(`Health: ${'❤'.repeat(Math.max(0, state.health))}`, 20, 162);
  if (state.reduceMotion) ctx.fillText('Reduce Motion: ON', 20, 188);

  if (!state.started) {
    ctx.fillStyle = '#000a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 42px Trebuchet MS'; ctx.fillText('Kitten Dance Beat Dash', 280, 210);
    ctx.font = '24px Trebuchet MS'; ctx.fillText('Press SPACE to start the party!', 330, 250);
    ctx.fillText('A / S / D to hit notes', 360, 285);
    ctx.fillText('Press M any time for gentle motion mode', 285, 320);
  }

  if (state.started && !state.over && state.graceWindow > 0) {
    ctx.fillStyle = '#0008'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const t = Math.ceil(state.graceWindow);
    const sy = t > 1 ? 0 : 74;
    ctx.drawImage(state.uiSprites.panel, 0, sy, 420, 74, 270, 170, 420, 74);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 56px Trebuchet MS';
    ctx.fillText(String(t), 468, 278);
    ctx.font = '22px Trebuchet MS'; ctx.fillText('No HP loss during countdown', 350, 318);
  } else if (!state.running && !state.over) {
    ctx.fillStyle = '#0009'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; ctx.font = '42px Trebuchet MS'; ctx.fillText('Paused', 420, 250);
  } else if (state.over) {
    ctx.fillStyle = '#000a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; ctx.font = '34px Trebuchet MS'; ctx.fillText('Show Over! Kittens need an encore!', 265, 230);
    ctx.font = '24px Trebuchet MS'; ctx.fillText('Press R to play again', 380, 270);
  }
}

state.notes = createChart();
buildStars();
buildSprites();
buildUiSprites();
let last = performance.now();
(function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}(last));
