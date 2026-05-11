const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const lanes = [230, 480, 730];
const keys = ['KeyA', 'KeyS', 'KeyD'];
const laneLabels = ['A', 'S', 'D'];
const bpm = 128;
const beatSec = 60 / bpm;
const travelSec = 1.55;
const hitY = 450;
const spawnY = -40;

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
  kittensMood: 0,
  best: Number(localStorage.getItem(bestKey) || 0),
  streak: JSON.parse(localStorage.getItem(streakKey) || '{"last":"","days":0}'),
  runRecorded: false,
  feedback: '',
  feedbackTime: 0,
  stars: []
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
  for (let i = 0; i < 180; i++) {
    const lane = Math.floor(random() * 3);
    chart.push({ lane, hitTime: t, judged: false });
    if (random() < 0.2) chart.push({ lane: (lane + 1 + Math.floor(random() * 2)) % 3, hitTime: t + beatSec * 0.5, judged: false });
    const ramp = Math.max(0.38, 1 - i * 0.0022); // dynamic intensity
    t += beatSec * (random() < 0.32 ? 0.5 : 1) * ramp;
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

function kittenSprite(x, y, hype, hueShift = 0) {
  ctx.save();
  ctx.translate(x, y + Math.sin(state.time * 7 + hueShift) * (5 + 8 * hype));
  ctx.scale(0.82 + hype * 0.06, 0.82 + hype * 0.04);
  ctx.fillStyle = `hsl(${330 + hueShift}, 100%, 90%)`;
  ctx.beginPath(); ctx.ellipse(0, 0, 60, 55, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-42, -32); ctx.lineTo(-26, -76); ctx.lineTo(-8, -30); ctx.fill();
  ctx.beginPath(); ctx.moveTo(42, -32); ctx.lineTo(26, -76); ctx.lineTo(8, -30); ctx.fill();
  ctx.fillStyle = '#40223f';
  ctx.beginPath(); ctx.arc(-17, -5, 6, 0, 7); ctx.arc(17, -5, 6, 0, 7); ctx.fill();
  ctx.strokeStyle = '#40223f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 16, 14, 0, Math.PI); ctx.stroke();
  const pawY = 52 + Math.sin(state.time * 16 + hueShift) * (4 + 12 * hype);
  ctx.fillStyle = '#ffb8d8';
  ctx.beginPath(); ctx.ellipse(-36, pawY, 14, 10, 0, 0, 7); ctx.ellipse(36, pawY, 14, 10, 0, 0, 7); ctx.fill();
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
  if (!state.started && e.code === 'Space') { state.started = true; state.running = true; return; }
  if (e.code === 'KeyP' && state.started) state.running = !state.running;
  if (e.code === 'KeyR' && state.over) window.location.reload();
  const idx = keys.indexOf(e.code);
  if (idx >= 0 && state.running && !state.over) judgeLane(idx);
});

function update(dt) {
  state.time += dt;
  if (!state.running || state.over) return;

  state.beatPulse = Math.max(0, state.beatPulse - dt * 2.2);
  if ((state.time / beatSec | 0) !== ((state.time - dt) / beatSec | 0)) state.beatPulse = 1;
  state.feedbackTime = Math.max(0, state.feedbackTime - dt);

  for (const n of state.notes) {
    if (!n.judged && state.time - n.hitTime > 0.18) {
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
  grad.addColorStop(0, '#160d30'); grad.addColorStop(1, '#0d0a1e');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const s of state.stars) {
    const a = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(state.time * 1.2 + s.tw));
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
}

function draw() {
  drawBackground();
  const pulse = 1 + state.beatPulse * 0.1;
  ctx.save();
  ctx.scale(pulse, pulse);
  ctx.translate((1 - pulse) * canvas.width / 2 / pulse, (1 - pulse) * canvas.height / 2 / pulse);

  ctx.fillStyle = '#261b49'; ctx.fillRect(200, 40, 620, 460);
  ctx.strokeStyle = '#8f78ff'; ctx.lineWidth = 2;
  lanes.forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x, 500); ctx.stroke(); });
  ctx.fillStyle = '#ff8ad6'; ctx.fillRect(200, hitY, 620, 6);

  ctx.font = '20px Trebuchet MS';
  for (const n of state.notes) {
    if (n.judged && n.hitTime < state.time - 0.2) continue;
    const progress = 1 - ((n.hitTime - state.time) / travelSec);
    const y = spawnY + (hitY - spawnY) * progress;
    if (y < -60 || y > 560) continue;
    ctx.fillStyle = ['#6ce2ff', '#ffbf6c', '#b5ff7c'][n.lane];
    drawRoundedRect(lanes[n.lane] - 42, y - 18, 84, 36, 9); ctx.fill();
    ctx.fillStyle = '#10263f'; ctx.fillText(laneLabels[n.lane], lanes[n.lane] - 4, y + 5);
  }

  kittenSprite(120, 340, state.kittensMood, 0);
  kittenSprite(840, 340, state.kittensMood * 0.8, 22);

  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 5, 5);
  }
  ctx.globalAlpha = 1;

  if (state.feedbackTime > 0) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 36px Trebuchet MS';
    ctx.fillText(state.feedback, 430, 190);
  }

  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = '20px Trebuchet MS';
  ctx.fillText(`Score: ${state.score}`, 20, 32);
  ctx.fillText(`Combo: ${state.combo}`, 20, 58);
  ctx.fillText(`Max Combo: ${state.maxCombo}`, 20, 84);
  ctx.fillText(`Best today (${today}): ${state.best}`, 20, 110);
  ctx.fillText(`Streak days: ${state.streak.days}`, 20, 136);
  ctx.fillText(`Health: ${'❤'.repeat(Math.max(0, state.health))}`, 20, 162);

  if (!state.started) {
    ctx.fillStyle = '#000a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 42px Trebuchet MS'; ctx.fillText('Kitten Dance Beat Dash', 280, 210);
    ctx.font = '24px Trebuchet MS'; ctx.fillText('Press SPACE to start the party!', 330, 250);
    ctx.fillText('A / S / D to hit notes', 360, 285);
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
let last = performance.now();
(function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}(last));
