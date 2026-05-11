const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const lanes = [230, 480, 730];
const keys = ['KeyA', 'KeyS', 'KeyD'];
const bpm = 128;
const beatSec = 60 / bpm;
const travelSec = 1.55;
const hitY = 450;
const spawnY = -40;

const today = new Date().toISOString().slice(0, 10);
const streakKey = 'kitten_beat_streak';
const bestKey = `kitten_beat_best_${today}`;

const state = {
  running: true,
  over: false,
  score: 0,
  combo: 0,
  maxCombo: 0,
  health: 10,
  time: 0,
  notes: [],
  particles: [],
  beatPulse: 0,
  kittensMood: 0,
  best: Number(localStorage.getItem(bestKey) || 0),
  streak: JSON.parse(localStorage.getItem(streakKey) || '{"last":"","days":0}')
};

function rng(seed) { let s = seed>>>0; return ()=> (s = (1664525*s + 1013904223)>>>0) / 4294967296; }
const seedNum = Number(today.replaceAll('-', ''));
const random = rng(seedNum);

function createChart() {
  const chart = [];
  let t = 2;
  for (let i = 0; i < 160; i++) {
    const lane = Math.floor(random() * 3);
    chart.push({ lane, hitTime: t, judged: false });
    if (random() < 0.17) chart.push({ lane: (lane + 1 + Math.floor(random()*2))%3, hitTime: t + beatSec*0.5, judged: false });
    t += beatSec * (random() < 0.3 ? 0.5 : 1);
  }
  return chart.sort((a,b)=>a.hitTime-b.hitTime);
}
state.notes = createChart();

function kittenSprite(hype) {
  ctx.save();
  ctx.translate(130, 330 + Math.sin(state.time*9)*6*hype);
  ctx.scale(1 + 0.06*hype, 1 + 0.03*hype);
  ctx.fillStyle = '#ffd9ec';
  ctx.beginPath(); ctx.ellipse(0,0,60,55,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-42,-32); ctx.lineTo(-26,-76); ctx.lineTo(-8,-30); ctx.fill();
  ctx.beginPath(); ctx.moveTo(42,-32); ctx.lineTo(26,-76); ctx.lineTo(8,-30); ctx.fill();
  ctx.fillStyle = '#40223f';
  ctx.beginPath(); ctx.arc(-17,-5,6,0,7); ctx.arc(17,-5,6,0,7); ctx.fill();
  ctx.strokeStyle = '#40223f'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0,16,14,0,Math.PI); ctx.stroke();
  const pawY = 50 + Math.sin(state.time*18)*12*hype;
  ctx.fillStyle = '#ffb8d8';
  ctx.beginPath(); ctx.ellipse(-36,pawY,14,10,0,0,7); ctx.ellipse(36,pawY,14,10,0,0,7); ctx.fill();
  ctx.restore();
}

function spawnBurst(x, y, color) {
  for (let i=0;i<16;i++) state.particles.push({x,y,vx:(Math.random()-0.5)*240,vy:(Math.random()-0.5)*240,life:0.5,color});
}

function judgeLane(laneIdx) {
  const windowPerfect = 0.09;
  const windowGood = 0.16;
  let candidate = null;
  for (const n of state.notes) {
    if (n.judged || n.lane !== laneIdx) continue;
    const dt = Math.abs(n.hitTime - state.time);
    if (dt < windowGood && (!candidate || dt < candidate.dt)) candidate = { n, dt };
  }
  if (!candidate) return;
  candidate.n.judged = true;
  if (candidate.dt < windowPerfect) {
    state.score += 120 + state.combo * 2;
    state.combo++; state.maxCombo = Math.max(state.combo, state.maxCombo);
    state.kittensMood = Math.min(1, state.kittensMood + 0.08);
    spawnBurst(lanes[laneIdx], hitY, '#9dffb0');
  } else {
    state.score += 70;
    state.combo++;
    spawnBurst(lanes[laneIdx], hitY, '#ffe28a');
  }
}

window.addEventListener('keydown', e => {
  if (e.code === 'KeyP') state.running = !state.running;
  if (e.code === 'KeyR' && state.over) window.location.reload();
  const idx = keys.indexOf(e.code);
  if (idx >= 0 && state.running && !state.over) judgeLane(idx);
});

function update(dt) {
  if (!state.running || state.over) return;
  state.time += dt;
  state.beatPulse = Math.max(0, state.beatPulse - dt*2.4);
  if ((state.time / beatSec | 0) !== ((state.time-dt) / beatSec | 0)) state.beatPulse = 1;

  for (const n of state.notes) {
    if (!n.judged && state.time - n.hitTime > 0.18) {
      n.judged = true;
      state.combo = 0;
      state.health -= 1;
      state.kittensMood = Math.max(0, state.kittensMood - 0.12);
    }
  }

  state.particles = state.particles.filter(p => (p.life -= dt) > 0);
  for (const p of state.particles) { p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 300*dt; }

  if (state.health <= 0 || state.notes.every(n => n.judged)) {
    state.over = true;
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem(bestKey, String(state.best));
      if (state.streak.last !== today) {
        const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
        state.streak.days = state.streak.last === yesterday ? state.streak.days + 1 : 1;
        state.streak.last = today;
      }
      localStorage.setItem(streakKey, JSON.stringify(state.streak));
    }
  }
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const pulse = 1 + state.beatPulse * 0.12;
  ctx.save(); ctx.scale(pulse,pulse); ctx.translate((1-pulse)*canvas.width/2/pulse,(1-pulse)*canvas.height/2/pulse);

  ctx.fillStyle = '#261b49'; ctx.fillRect(200,40,620,460);
  ctx.strokeStyle = '#8f78ff'; ctx.lineWidth = 2;
  lanes.forEach(x=>{ctx.beginPath(); ctx.moveTo(x,50); ctx.lineTo(x,500); ctx.stroke();});
  ctx.fillStyle = '#ff8ad6'; ctx.fillRect(200, hitY, 620, 6);

  for (const n of state.notes) {
    if (n.judged && n.hitTime < state.time - 0.2) continue;
    const t = (n.hitTime - state.time + travelSec) / travelSec;
    const y = spawnY + (hitY - spawnY) * (1 - t);
    if (y < -30 || y > 520) continue;
    ctx.fillStyle = '#6ce2ff';
    ctx.beginPath(); ctx.roundRect(lanes[n.lane]-42, y-18, 84, 36, 9); ctx.fill();
    ctx.fillStyle = '#10263f'; ctx.fillText(['A','S','D'][n.lane], lanes[n.lane]-4, y+5);
  }

  kittenSprite(state.kittensMood);
  for (const p of state.particles) { ctx.globalAlpha = Math.max(0,p.life*2); ctx.fillStyle = p.color; ctx.fillRect(p.x,p.y,5,5); }
  ctx.globalAlpha = 1;

  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = '20px Trebuchet MS';
  ctx.fillText(`Score: ${state.score}`, 20, 32);
  ctx.fillText(`Combo: ${state.combo}`, 20, 58);
  ctx.fillText(`Best today (${today}): ${state.best}`, 20, 84);
  ctx.fillText(`Streak days: ${state.streak.days}`, 20, 110);
  ctx.fillText(`Health: ${'❤'.repeat(Math.max(0,state.health))}`, 20, 136);

  if (!state.running && !state.over) {
    ctx.fillStyle = '#0009'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#fff'; ctx.font = '42px Trebuchet MS'; ctx.fillText('Paused', 420, 250);
  }
  if (state.over) {
    ctx.fillStyle = '#000a'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#fff'; ctx.font = '34px Trebuchet MS'; ctx.fillText('Show Over! Kittens need encore!', 265, 230);
    ctx.font = '24px Trebuchet MS'; ctx.fillText('Press R to play again', 380, 270);
  }
}

let last = performance.now();
(function loop(now){
  const dt = Math.min(0.033, (now-last)/1000); last = now;
  update(dt); draw();
  requestAnimationFrame(loop);
})(last);
