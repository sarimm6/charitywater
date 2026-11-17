// Water Way — rendering, input and UI. Physics and levels live in game-core.js.
const { PHYS, levels, createWorld, stepWorld, inPourZone, supplyLeft, isFailed, randomLevel,
  canAt, sliderSeg, swingSeg, trapdoorState } = window.WaterWay;

const $ = s => document.querySelector(s);
const canvas = $('#gameCanvas'), ctx = canvas.getContext('2d');
const scoreEl = $('#score'), targetEl = $('#target'), supplyEl = $('#supply');
const pointsEl = $('#points'), accuracyEl = $('#accuracy'), lostEl = $('#lost');
const progressFill = $('#progress-fill'), milestoneEl = $('#milestone'), endScreen = $('#win-screen');
const levelNameEl = $('#level-name'), levelKickerEl = $('#level-kicker'), soundBtn = $('#sound-btn');
const branding = new Image(); branding.src = 'input_file_0.png';

const ORDER = ['easy', 'medium', 'hard'];
const RANDOM_TIER = { easy: 1, medium: 2, hard: 3 };
let difficulty = 'easy', levelIndex = 0, level, world;
let randomTier = 1, randomStreak = 0;
let milestones, finished, wonAt = 0, holding = false, pointerX = -100, pointerY = -100, pointerIn = false;
let touchSlop = 0, confetti = [], soundOn = true, audioCtx, lastTime = 0, accumulator = 0, milestoneTimer;

// ---------------------------------------------------------------- sound
function tone(freq, duration = 0.08, type = 'sine', volume = 0.04) {
  if (!soundOn) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, audioCtx.currentTime);
    g.gain.setValueAtTime(volume, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + duration);
  } catch (e) { /* audio unavailable */ }
}
const splash = () => tone(310 + Math.random() * 90, 0.055, 'sine', 0.018);
const celebrate = () => [440, 554, 659].forEach((n, i) => setTimeout(() => tone(n, 0.17, 'triangle', 0.065), i * 110));
const sadTrombone = () => [330, 294, 262].forEach((n, i) => setTimeout(() => tone(n, 0.2, 'triangle', 0.05), i * 150));

// ---------------------------------------------------------------- level flow
// randomLevel test-pours each course and sizes its water supply so it is always fair.
const generateRandom = () => randomLevel(Math.random, randomTier);

function setLevel(nextDifficulty, nextIndex = 0) {
  difficulty = nextDifficulty; levelIndex = nextIndex;
  level = difficulty === 'procedural' ? generateRandom() : levels[difficulty][levelIndex];
  document.querySelectorAll('.difficulty').forEach(b => b.classList.toggle('active', b.dataset.difficulty === difficulty));
  if (difficulty === 'procedural') {
    levelNameEl.textContent = `Random · ${['', 'Gentle', 'Tricky', 'Wild'][randomTier]} Course`;
    levelKickerEl.textContent = randomStreak ? `STREAK ${randomStreak}` : 'A NEW COURSE EACH TIME';
  } else {
    levelNameEl.textContent = `${difficulty[0].toUpperCase() + difficulty.slice(1)} · ${level.name}`;
    levelKickerEl.textContent = `LEVEL ${levelIndex + 1} OF ${levels[difficulty].length}`;
  }
  if (location.hash !== '#' + levelId()) history.replaceState(null, '', '#' + levelId());
  resetGame();
}
const levelId = () => difficulty === 'procedural' ? 'random' : `${difficulty}-${levelIndex + 1}`;

function resetGame() {
  world = createWorld(level);
  confetti = []; milestones = [false, false, false]; finished = false; holding = false;
  endScreen.style.display = 'none';
  updateHud();
  showMilestone(level.hint, 3200);
}

function nextLevel() {
  if (difficulty === 'procedural') { setLevel('procedural'); return; }
  if (levelIndex + 1 < levels[difficulty].length) { setLevel(difficulty, levelIndex + 1); return; }
  const di = ORDER.indexOf(difficulty);
  if (di < ORDER.length - 1) setLevel(ORDER[di + 1]);
  else { randomTier = 3; setLevel('procedural'); }
}

// ---------------------------------------------------------------- HUD
function stats() {
  const attempts = world.collected + world.lost;
  return {
    accuracy: attempts ? Math.round(world.collected / attempts * 100) : 100,
    points: Math.max(0, world.collected * 10 - world.lost * 3 + (finished === 'won' || finished === 'shown' ? supplyLeft(world) * 5 : 0))
  };
}

function updateHud() {
  const s = stats();
  scoreEl.textContent = world.collected; targetEl.textContent = level.target;
  supplyEl.textContent = supplyLeft(world);
  supplyEl.parentElement.classList.toggle('low', supplyLeft(world) + world.particles.length < (level.target - world.collected) * 1.1);
  pointsEl.textContent = s.points; accuracyEl.textContent = s.accuracy; lostEl.textContent = world.lost;
  progressFill.style.width = `${Math.min(world.collected / level.target, 1) * 100}%`;
  document.querySelectorAll('.milestone-dot').forEach((dot, i) => dot.classList.toggle('reached', milestones[i]));
}

function showMilestone(text, ms = 1500) {
  milestoneEl.textContent = text; milestoneEl.classList.add('show');
  clearTimeout(milestoneTimer); milestoneTimer = setTimeout(() => milestoneEl.classList.remove('show'), ms);
}

function onCollect(n) {
  const ratio = world.collected / level.target;
  [0.25, 0.5, 0.75].forEach((mark, i) => {
    if (!milestones[i] && ratio >= mark) { milestones[i] = true; showMilestone(['Great start!', 'Halfway there!', 'Almost full!'][i]); tone(520 + i * 100, 0.14, 'triangle', 0.06); }
  });
  if (world.collected % 4 < n) splash();
  if (world.collected >= level.target && !finished) win();
}

function showEnd({ eyebrow, title, message, primary, secondary, won }) {
  $('#end-eyebrow').textContent = eyebrow;
  $('#end-title').innerHTML = title;
  $('#win-message').textContent = message;
  $('#next-btn').textContent = primary;
  $('#replay-btn').textContent = secondary;
  $('#end-badge').textContent = won ? '✦' : '◌';
  endScreen.classList.toggle('lost', !won);
  endScreen.style.display = 'flex';
}

// Reaching the target stops the pour; the card appears once the last drops have landed.
function win() {
  finished = 'won'; holding = false; wonAt = world.step;
  showMilestone('Jerrycan full!');
  celebrate();
  for (let i = 0; i < 110; i++) confetti.push({ x: 400, y: 210, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 12 - 3, size: 3 + Math.random() * 5, color: ['#ffc907', '#2ea3dd', '#fff', '#ed6b5a'][i % 4] });
}

function showWin() {
  finished = 'shown';
  const s = stats(), efficiency = world.collected / Math.max(world.poured, 1);
  const stars = efficiency >= 0.9 ? 3 : efficiency >= 0.75 ? 2 : 1;
  if (difficulty === 'procedural') { randomStreak++; if (randomStreak % 2 === 0) randomTier = Math.min(3, randomTier + 1); }
  showEnd({
    eyebrow: 'JERRYCAN FILLED', title: 'Every drop<br>counts.', won: true,
    message: `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}  ${s.points} points · ${s.accuracy}% of your water made it home, ${supplyLeft(world)} drops to spare.`,
    primary: 'Next level', secondary: 'Play again'
  });
  updateHud();
}

function fail() {
  finished = 'lost'; holding = false;
  if (difficulty === 'procedural') { randomStreak = 0; randomTier = Math.max(1, randomTier - 1); }
  const short = level.target - world.collected - supplyLeft(world) - world.particles.length;
  showEnd({
    eyebrow: 'OUT OF WATER', title: short <= 10 ? 'So close.' : 'Not this time.', won: false,
    message: `Too much water soaked into the sand — even if every remaining drop lands, the can ends up ${short} short. ${level.rhythm ? 'Watch the rhythm and pour in short bursts.' : 'Try pouring from a different spot.'}`,
    primary: 'Try again', secondary: difficulty === 'procedural' ? 'New course' : 'Skip level'
  });
  sadTrombone();
}

// ---------------------------------------------------------------- simulation
function tick() {
  const z = level.pour, clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pouring = holding && pointerIn && !finished && inPourZone(level, pointerX, pointerY, touchSlop)
    ? { x: clamp(pointerX, z.x, z.x + z.w), y: clamp(pointerY, z.y, z.y + z.h) } : null;
  const { got, missed } = stepWorld(world, pouring);
  if (got && finished !== 'lost') onCollect(got);
  if (finished === 'won' && (world.particles.length === 0 || world.step - wonAt > PHYS.HZ * 2.5)) showWin();
  if (missed && world.lost % 5 < missed) tone(150, 0.08, 'sine', 0.025);
  if ((got || missed || pouring) && finished !== 'lost') updateHud();
  if (!finished && isFailed(world)) fail();
}

function loop(now) {
  const elapsed = Math.min((now - (lastTime || now)) / 1000, 0.1);
  lastTime = now; accumulator += elapsed;
  const dt = 1 / PHYS.HZ;
  while (accumulator >= dt) { tick(); accumulator -= dt; }
  for (const c of confetti) { c.x += c.vx * elapsed * 60; c.y += c.vy * elapsed * 60; c.vy += 0.28 * elapsed * 60; }
  confetti = confetti.filter(c => c.y < 630);
  for (const s of world.soaks) s.life -= elapsed * 0.6;
  world.soaks = world.soaks.filter(s => s.life > 0).slice(-60);
  draw();
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- drawing
function segmentPath(s) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
function strokeCourse(build, outer = '#34434a', inner = '#73858c') {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); build(); ctx.strokeStyle = outer; ctx.lineWidth = PHYS.WALL * 2 + 1; ctx.stroke();
  ctx.strokeStyle = inner; ctx.lineWidth = 3; ctx.stroke();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, 600);
  sky.addColorStop(0, '#dff3fa'); sky.addColorStop(1, '#f8f3e6');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 800, 600);
  ctx.fillStyle = '#fff8';
  ctx.beginPath(); ctx.arc(130, 100, 48, 0, 7); ctx.arc(175, 105, 34, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(650, 95, 44, 0, 7); ctx.arc(697, 100, 28, 0, 7); ctx.fill();
  // sand
  ctx.fillStyle = '#ead9b0'; ctx.fillRect(0, PHYS.GROUND_Y - 6, 800, 80);
  ctx.fillStyle = '#dcc690'; ctx.fillRect(0, PHYS.GROUND_Y - 6, 800, 3);
  ctx.fillStyle = '#c9b07a';
  for (let x = 13; x < 800; x += 37) ctx.fillRect(x, PHYS.GROUND_Y + 12 + (x * 7) % 23, 3, 2);
  for (const s of world.soaks) { ctx.fillStyle = `rgba(150,118,60,${0.35 * s.life})`; ctx.beginPath(); ctx.ellipse(s.x, PHYS.GROUND_Y + 2, 9, 3, 0, 0, 7); ctx.fill(); }
}

function drawPourZone() {
  const z = level.pour, active = holding && pointerIn && inPourZone(level, pointerX, pointerY, touchSlop) && !finished;
  ctx.save();
  ctx.fillStyle = active ? '#2ea3dd33' : '#2ea3dd1c';
  ctx.strokeStyle = '#2ea3dd'; ctx.lineWidth = 2; ctx.setLineDash([7, 6]);
  ctx.beginPath(); ctx.roundRect(z.x, z.y, z.w, z.h, 10); ctx.fill(); ctx.stroke();
  ctx.setLineDash([]); ctx.fillStyle = '#1f84b8'; ctx.font = '800 9px "Nunito Sans", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(supplyLeft(world) ? 'POUR HERE' : 'EMPTY', z.x + z.w / 2, z.y - 6);
  ctx.restore();
}

function drawTrapdoors(t) {
  for (const d of level.trapdoors || []) {
    const [x1, y1, x2, y2] = d.seg;
    const st = trapdoorState(d, t), blink = st.warn > 0 && Math.floor(st.warn * 7) % 2 === 0;
    const len = Math.hypot(x2 - x1, y2 - y1) / 2, base = Math.atan2(y2 - y1, x2 - x1);
    if (st.open) {
      // Flaps hang from the hinges, then swing back up as the door gets ready to close.
      const drop = (Math.PI / 2 - 0.15) * (1 - st.warn * 0.85);
      const fx1 = x1 + Math.cos(base + drop) * len * 0.85, fy1 = y1 + Math.sin(base + drop) * len * 0.85;
      const fx2 = x2 - Math.cos(base - drop) * len * 0.85, fy2 = y2 - Math.sin(base - drop) * len * 0.85;
      strokeCourse(() => { ctx.moveTo(x1, y1); ctx.lineTo(fx1, fy1); ctx.moveTo(x2, y2); ctx.lineTo(fx2, fy2); },
        blink ? '#2f8f57' : '#b4502f', blink ? '#8fe0ae' : '#e88a5c');
    } else {
      strokeCourse(() => segmentPath(d.seg), blink ? '#f2b33d' : '#c2562f', blink ? '#ffe39a' : '#f08a5d');
    }
  }
}

function drawMovers(t) {
  for (const s of level.sliders || []) {
    const seg = sliderSeg(s, t);
    ctx.save(); ctx.strokeStyle = '#2ea3dd55'; ctx.lineWidth = 2; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(s.seg[0], s.seg[1] + 12); ctx.lineTo(s.seg[0] + s.slide.dx, s.seg[1] + s.slide.dy + 12); ctx.stroke(); ctx.restore();
    strokeCourse(() => segmentPath(seg), '#1f6f99', '#69c3ec');
  }
  for (const s of level.swings || []) {
    strokeCourse(() => segmentPath(swingSeg(s, t)), '#1f6f99', '#69c3ec');
    ctx.fillStyle = '#ffc907'; ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#1d242d'; ctx.lineWidth = 2; ctx.stroke();
  }
}

function drawCan(c) {
  const { x, y, w, h } = c;
  ctx.save();
  if (level.can.move) {
    ctx.strokeStyle = '#c9b07a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(level.can.x + w / 2, PHYS.GROUND_Y - 3); ctx.lineTo(level.can.x + level.can.move.dx + w / 2, PHYS.GROUND_Y - 3); ctx.stroke();
  }
  ctx.fillStyle = '#1d242d22'; ctx.beginPath(); ctx.roundRect(x + 8, y + h - 2, w, h * 0.06, 10); ctx.fill();
  if (branding.complete && branding.naturalWidth) ctx.drawImage(branding, 280, 0, 180, 205, x - 9, y - 9, w + 18, h + 18);
  else { ctx.fillStyle = '#ffc907'; ctx.beginPath(); ctx.roundRect(x, y + 12, w, h - 12, 13); ctx.fill(); }
  // fill level
  const ratio = Math.min(world.collected / level.target, 1);
  if (ratio > 0) {
    const sx = (w + 18) / 180, sy = (h + 18) / 205;
    const left = x - 9 + 30 * sx, right = x - 9 + 143 * sx, bottom = y - 9 + 178 * sy, top = y - 9 + 40 * sy;
    const fy = bottom - (bottom - top) * ratio;
    ctx.globalAlpha = 0.8; ctx.fillStyle = '#2ea3dd';
    ctx.beginPath(); ctx.roundRect(left, fy, right - left, bottom - fy, 6); ctx.fill();
  }
  ctx.restore();
}

function draw() {
  const t = world.step / PHYS.HZ;
  ctx.clearRect(0, 0, 800, 600);
  drawBackground();
  drawPourZone();
  strokeCourse(() => level.paths.forEach(p => { ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); }));
  drawTrapdoors(t);
  drawMovers(t);
  ctx.fillStyle = '#219ed9cc';
  for (const p of world.particles) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  drawCan(canAt(level, t));
  if (pointerIn && !finished) {
    const ok = inPourZone(level, pointerX, pointerY, touchSlop) && supplyLeft(world) > 0;
    ctx.strokeStyle = ok ? '#fff' : '#f07754'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pointerX, pointerY, 12, 0, 7); ctx.stroke();
    if (!ok) { ctx.beginPath(); ctx.moveTo(pointerX - 8, pointerY - 8); ctx.lineTo(pointerX + 8, pointerY + 8); ctx.stroke(); }
  }
  for (const c of confetti) { ctx.fillStyle = c.color; ctx.fillRect(c.x, c.y, c.size, c.size); }
}

// ---------------------------------------------------------------- input
function updatePointer(e) {
  const r = canvas.getBoundingClientRect();
  pointerX = (e.clientX - r.left) * 800 / r.width; pointerY = (e.clientY - r.top) * 600 / r.height;
  touchSlop = e.pointerType === 'mouse' ? 0 : 14;
  pointerIn = true;
}
canvas.addEventListener('pointerdown', e => {
  e.preventDefault(); updatePointer(e);
  if (finished) return;
  holding = true; canvas.setPointerCapture?.(e.pointerId);
  if (!inPourZone(level, pointerX, pointerY, touchSlop)) showMilestone('Pour inside the blue zone');
  else if (!supplyLeft(world)) showMilestone('Out of water — restart to try again');
  else tone(240, 0.06, 'sine', 0.025);
});
canvas.addEventListener('pointermove', updatePointer);
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !holding) pointerIn = false; });
window.addEventListener('pointerup', e => { holding = false; if (e.pointerType !== 'mouse') pointerIn = false; });
canvas.addEventListener('pointercancel', () => { holding = false; pointerIn = false; });

document.querySelectorAll('.difficulty').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.difficulty === 'procedural') randomTier = RANDOM_TIER[difficulty] || randomTier;
  setLevel(b.dataset.difficulty);
}));
$('#reset-btn').addEventListener('click', resetGame);
$('#next-btn').addEventListener('click', () => finished === 'lost' ? resetGame() : nextLevel());
$('#replay-btn').addEventListener('click', () => {
  if (difficulty === 'procedural') setLevel('procedural');
  else if (finished === 'lost') nextLevel();
  else resetGame();
});
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn; soundBtn.classList.toggle('muted', !soundOn); soundBtn.textContent = soundOn ? '♬' : '♩';
  soundBtn.setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on');
  if (soundOn) tone(600, 0.06, 'triangle', 0.05);
});

// Deep links: #easy-1 … #hard-4, #random
function fromHash() {
  const m = location.hash.match(/^#(easy|medium|hard)-(\d+)$/);
  if (m && levels[m[1]][m[2] - 1]) return setLevel(m[1], m[2] - 1);
  if (location.hash === '#random') return setLevel('procedural');
  setLevel('easy');
}
window.addEventListener('hashchange', () => { if (location.hash !== '#' + levelId()) fromHash(); });
fromHash();
requestAnimationFrame(loop);
