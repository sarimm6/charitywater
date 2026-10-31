#!/usr/bin/env node
// Headless level checker: node tools/simulate.js [difficulty] [index]
// For each level it measures how much water reaches the can with
//   • steady  — holding the pour button the whole time (best spot in the zone)
//   • timed   — pouring in bursts locked to the level's rhythm (best phase / duty)
// and checks the result against the level's required efficiency (target / supply).
const W = require('../game-core.js');

function run(level, point, gate, seed = 1) {
  const w = W.createWorld(level, seed);
  const maxSteps = W.PHYS.HZ * 90;
  while (w.step < maxSteps) {
    const t = w.step / W.PHYS.HZ;
    const pouring = W.supplyLeft(w) > 0 && (!gate || gate(t));
    W.stepWorld(w, pouring ? point : null);
    if (W.supplyLeft(w) === 0 && w.particles.length === 0) break;
  }
  return w.collected / level.supply;
}

function points(level) {
  const z = level.pour, out = [];
  for (const fx of [0.15, 0.5, 0.85]) for (const fy of [0.3, 0.8]) out.push({ x: z.x + z.w * fx, y: z.y + z.h * fy });
  return out;
}

function analyse(level) {
  const need = level.target / level.supply;
  let steady = { eff: 0 };
  for (const p of points(level)) { const eff = run(level, p); if (eff > steady.eff) steady = { eff, p }; }
  const center = run(level, points(level)[3]);
  let timed = null;
  if (level.rhythm) {
    timed = { eff: 0 };
    const P = level.rhythm, N = 20;
    for (const duty of [0.15, 0.25, 0.35, 0.5]) {
      const effs = [];
      for (let k = 0; k < N; k++) effs.push(run(level, steady.p, t => ((t / P + k / N) % 1) < duty));
      effs.forEach((eff, k) => {
        // robustness: worst result when the player is a little early or late
        const sloppy = Math.min(eff, effs[(k + 1) % N], effs[(k + N - 1) % N]);
        if (eff > timed.eff) timed = { eff, sloppy, duty, phase: k / N };
      });
    }
  }
  return { need, steady, center, timed };
}

const pct = x => (x * 100).toFixed(0).padStart(3) + '%';
const [onlyDiff, onlyIdx] = process.argv.slice(2);
let problems = 0;
for (const [diff, list] of Object.entries(W.levels)) {
  if (onlyDiff && diff !== onlyDiff) continue;
  list.forEach((level, i) => {
    if (onlyIdx !== undefined && +onlyIdx !== i) return;
    const r = analyse(level);
    const best = Math.max(r.steady.eff, r.timed ? r.timed.eff : 0);
    const notes = [];
    if (best < r.need + 0.08) notes.push('TOO HARD');
    if (diff === 'easy' && r.center < r.need) notes.push('easy level needs precision');
    if (diff === 'hard' && r.steady.eff >= r.need) notes.push('hard level beatable without timing');
    if (r.timed && r.timed.sloppy < r.need) notes.push('timing window too tight');
    problems += notes.length;
    console.log(`${diff.padEnd(6)} ${i + 1} ${level.name.padEnd(17)} need ${pct(r.need)} | steady ${pct(r.steady.eff)} (center ${pct(r.center)})` +
      (r.timed ? ` | timed ${pct(r.timed.eff)} sloppy ${pct(r.timed.sloppy || 0)} duty ${r.timed.duty} phase ${(r.timed.phase || 0).toFixed(2)}` : '') +
      (notes.length ? '  <-- ' + notes.join(', ') : '  ok'));
  });
}
if (!onlyDiff) {
  // Random courses: each is generated, test-poured and given a supply. Re-check them with
  // a fresh seed to make sure the supply is fair and the fallback course is rarely needed.
  for (const tier of [1, 2, 3]) {
    let fallback = 0, unfair = 0, total = 0;
    for (let s = 0; s < 6; s++) {
      const lvl = W.randomLevel(W.mulberry32(1000 * tier + s), tier);
      total++;
      if (!lvl.tested) { fallback++; continue; }
      const r = analyse(lvl);
      const best = Math.max(r.steady.eff, r.timed ? r.timed.eff : 0);
      if (best < r.need + 0.05) unfair++;
    }
    const bad = fallback + unfair;
    if (bad > 1) problems++;
    console.log(`random tier ${tier}: ${total} courses, ${fallback} fell back to a preset, ${unfair} too stingy${bad > 1 ? '  <-- check generator' : '  ok'}`);
  }
}
process.exitCode = problems ? 1 : 0;
