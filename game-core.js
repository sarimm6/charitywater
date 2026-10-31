// Water Way — level data and water physics.
// This file has no DOM dependencies so the same code runs in the browser and in
// tools/simulate.js, which checks that every level is winnable (and not trivial).
(function (root) {
  'use strict';

  const PHYS = {
    HZ: 120,              // fixed physics steps per second (independent of screen refresh rate)
    GRAVITY: 0.08,        // px / step²
    MAX_SPEED: 6,         // px / step
    FRICTION: 0.996,      // tangential speed kept per step while touching a surface
    RESTITUTION: 0.15,    // normal bounce
    WALL: 5,              // half thickness of a drawn course segment
    SPAWN_EVERY: 3,       // one drop every 3 steps while pouring (40 drops / second)
    STILL_SPEED: 0.06,
    STILL_STEPS: 240,     // drops that sit still for 2 s soak away and count as lost
    GROUND_Y: 548,
    WIDTH: 800
  };

  // ---------------------------------------------------------------------------
  // Levels
  //
  // pour      rectangle the player may pour inside
  // can       jerrycan; optional move:{dx,period,phase,rest} slides it back and forth (rest: pause at each end)
  // paths     polylines [x,y, x,y, ...] of solid course
  // trapdoors segments that vanish while open: {seg,period,open,phase}
  // sliders   segments that slide away and back: {seg,slide:{dx,dy},period,phase}
  // swings    blades rotating about their centre between two angles: {x,y,len,from,to,period,phase}
  // supply    total drops available; target / supply is the efficiency you need
  // rhythm    the level's shared hazard period in seconds (used by the solver)
  // ---------------------------------------------------------------------------
  const CAN = { w: 140, h: 165, y: 380 };
  const SMALL_CAN = { w: 108, h: 128, y: 417 };
  const can = (x, extra) => Object.assign({ x }, CAN, extra);
  const smallCan = (x, extra) => Object.assign({ x }, SMALL_CAN, extra);

  const levels = {
    easy: [
      {
        name: 'First Drop', hint: 'Press and hold inside the blue zone to pour.',
        target: 50, supply: 110,
        pour: { x: 70, y: 92, w: 190, h: 48 },
        can: can(380),
        paths: [[60, 190, 400, 330], [480, 290, 480, 385]]
      },
      {
        name: 'Switchback', hint: 'Water follows the course — let it wind its way down.',
        target: 60, supply: 125,
        pour: { x: 70, y: 92, w: 190, h: 48 },
        can: can(230),
        paths: [[55, 180, 520, 250], [640, 215, 640, 265, 330, 340], [255, 300, 255, 385]]
      },
      {
        name: 'Fork in the Road', hint: 'Not every slope leads home. Pick your side.',
        target: 65, supply: 130,
        pour: { x: 90, y: 92, w: 420, h: 48 },
        can: can(540),
        paths: [[60, 300, 290, 185, 560, 300], [640, 260, 640, 385]]
      },
      {
        name: 'Triple Bend', hint: 'Three turns. Keep the stream steady.',
        target: 70, supply: 140,
        pour: { x: 70, y: 92, w: 170, h: 48 },
        can: can(400),
        paths: [[55, 170, 470, 225], [600, 195, 600, 245, 260, 295], [130, 270, 130, 315, 440, 360], [510, 330, 510, 385]]
      }
    ],
    medium: [
      {
        name: 'Trapdoor', hint: 'The orange trapdoor opens on a beat — pour in bursts.',
        target: 80, supply: 145, rhythm: 3,
        pour: { x: 70, y: 92, w: 150, h: 48 },
        can: can(560),
        paths: [[55, 165, 330, 230], [370, 195, 370, 245], [420, 295, 600, 335], [670, 300, 670, 385]],
        trapdoors: [{ seg: [320, 275, 420, 295], period: 3, open: 0.4, phase: 0 }]
      },
      {
        name: 'Moving Target', hint: 'The can is on the move. Time the waterfall.',
        target: 85, supply: 165, rhythm: 5,
        pour: { x: 70, y: 92, w: 150, h: 48 },
        can: can(250, { move: { dx: 300, period: 5, phase: 0 } }),
        paths: [[55, 170, 420, 260], [500, 210, 500, 300]]
      },
      {
        name: 'Switch Track', hint: 'The switch flips back and forth. Catch it pointing home.',
        target: 90, supply: 150, rhythm: 3,
        pour: { x: 70, y: 92, w: 150, h: 48 },
        can: can(560),
        paths: [[55, 160, 360, 215], [405, 175, 405, 230], [435, 335, 435, 345, 590, 378], [670, 330, 670, 385]],
        swings: [{ x: 400, y: 290, len: 110, from: 25, to: 155, period: 3, phase: 0 }]
      },
      {
        name: 'Drawbridge', hint: 'The bridge slides away. Cross while it is in place.',
        target: 95, supply: 165, rhythm: 3,
        pour: { x: 610, y: 92, w: 150, h: 48 },
        can: can(140),
        paths: [[770, 170, 470, 250], [330, 287, 230, 314], [150, 270, 150, 350]],
        sliders: [{ seg: [470, 250, 330, 287], slide: { dx: 200, dy: 0 }, period: 3, phase: 0 }]
      }
    ],
    hard: [
      {
        name: 'Clockwork', hint: 'Two trapdoors, one rhythm. Find the window that clears both.',
        target: 100, supply: 140, rhythm: 2.4,
        pour: { x: 75, y: 92, w: 90, h: 48 },
        can: smallCan(320),
        paths: [[55, 150, 480, 215], [520, 180, 520, 230], [430, 280, 220, 320], [180, 285, 180, 335], [270, 383, 330, 395], [400, 370, 400, 418]],
        trapdoors: [
          { seg: [530, 262, 430, 280], period: 2.4, open: 0.4, phase: 0 },
          { seg: [170, 365, 270, 383], period: 2.4, open: 0.4, phase: 0.5 }
        ]
      },
      {
        name: 'Rush Hour', hint: 'A small can, a fast shuttle. Short, sharp bursts.',
        target: 100, supply: 140, rhythm: 3,
        pour: { x: 640, y: 92, w: 90, h: 48 },
        can: smallCan(160, { move: { dx: 240, period: 3, phase: 0, rest: true } }),
        paths: [[765, 150, 560, 195], [520, 160, 520, 210], [470, 258, 250, 300], [170, 255, 170, 418]],
        trapdoors: [{ seg: [570, 240, 470, 258], period: 3, open: 0.5, phase: 0.55 }]
      },
      {
        name: 'Double Switch', hint: 'Two switches swing out of step. Read both before you pour.',
        target: 105, supply: 185, rhythm: 6,
        pour: { x: 75, y: 92, w: 90, h: 48 },
        can: smallCan(410),
        paths: [[55, 150, 290, 185], [335, 145, 335, 200], [490, 360, 490, 418]],
        swings: [
          { x: 330, y: 270, len: 110, from: 25, to: 155, period: 3, phase: 0 },
          { x: 390, y: 345, len: 110, from: 25, to: 155, period: 2, phase: 0.5 }
        ]
      },
      {
        name: 'Final Flow', hint: 'Trapdoor, switch, bridge. Every drop counts.',
        target: 110, supply: 180, rhythm: 3,
        pour: { x: 640, y: 92, w: 90, h: 48 },
        can: smallCan(140),
        paths: [[765, 150, 600, 190], [510, 212, 450, 227], [405, 175, 405, 232], [380, 360, 290, 380], [150, 360, 150, 418]],
        trapdoors: [{ seg: [600, 190, 510, 212], period: 3, open: 0.35, phase: 0 }],
        swings: [{ x: 410, y: 302, len: 110, from: 25, to: 155, period: 3, phase: 0.3 }],
        sliders: [{ seg: [290, 380, 230, 393], slide: { dx: -80, dy: 0 }, period: 1.5, phase: 0 }]
      }
    ]
  };

  // ---------------------------------------------------------------------------
  // Geometry
  // ---------------------------------------------------------------------------
  const ease = u => 0.5 - 0.5 * Math.cos(2 * Math.PI * u);
  // like ease, but rests at each end for a while so players can read the state
  const dwell = u => Math.max(0, Math.min(1, (ease(u) - 0.3) / 0.4));
  const cycle = (t, period, phase) => (((t / period + (phase || 0)) % 1) + 1) % 1;

  function trapdoorOpen(door, t) { return cycle(t, door.period, door.phase) < door.open; }
  // 0 = about to close/closed, 1 = fully open; used for drawing and warnings
  function trapdoorWarning(door, t) { const u = cycle(t, door.period, door.phase); return u > 1 - 0.18 ? (u - (1 - 0.18)) / 0.18 : 0; }

  function sliderSeg(s, t) {
    const k = dwell(cycle(t, s.period, s.phase));
    const dx = s.slide.dx * k, dy = s.slide.dy * k;
    return [s.seg[0] + dx, s.seg[1] + dy, s.seg[2] + dx, s.seg[3] + dy];
  }
  function swingAngle(s, t) { return (s.from + (s.to - s.from) * dwell(cycle(t, s.period, s.phase))) * Math.PI / 180; }
  function swingSeg(s, t) {
    const a = swingAngle(s, t), hx = Math.cos(a) * s.len / 2, hy = Math.sin(a) * s.len / 2;
    return [s.x - hx, s.y - hy, s.x + hx, s.y + hy];
  }
  function canAt(level, t) {
    const c = level.can;
    if (!c.move) return c;
    const u = cycle(t, c.move.period, c.move.phase);
    return Object.assign({}, c, { x: c.x + c.move.dx * (c.move.rest ? dwell(u) : ease(u)) });
  }
  // The visible body of the jerrycan image (see drawCan in script.js).
  function canBody(c) {
    const sx = (c.w + 18) / 180, sy = (c.h + 18) / 205;
    return { left: c.x - 9 + 20 * sx, right: c.x - 9 + 153 * sx, top: c.y - 9 + 24 * sy, bottom: c.y - 9 + 187 * sy };
  }
  function canWalls(c) {
    const b = canBody(c);
    return [[b.left, b.top, b.left, b.bottom], [b.right, b.top, b.right, b.bottom]];
  }

  function staticSegments(level) {
    const segs = [];
    for (const path of level.paths) for (let i = 0; i + 3 < path.length; i += 2) segs.push([path[i], path[i + 1], path[i + 2], path[i + 3]]);
    return segs;
  }

  // All solid segments at time t, each with endpoint velocities (px / step) so moving parts carry water.
  function dynamicSegments(level, t) {
    const out = [], dt = 1 / PHYS.HZ;
    const add = (now, before) => out.push({ s: now, v: [now[0] - before[0], now[1] - before[1], now[2] - before[2], now[3] - before[3]] });
    for (const d of level.trapdoors || []) if (!trapdoorOpen(d, t)) out.push({ s: d.seg, v: null });
    for (const s of level.sliders || []) add(sliderSeg(s, t), sliderSeg(s, t - dt));
    for (const s of level.swings || []) add(swingSeg(s, t), swingSeg(s, t - dt));
    const nowWalls = canWalls(canAt(level, t)), prevWalls = canWalls(canAt(level, t - dt));
    nowWalls.forEach((w, i) => add(w, prevWalls[i]));
    return out;
  }

  // ---------------------------------------------------------------------------
  // World simulation
  // ---------------------------------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function createWorld(level, seed) {
    return {
      level, step: 0, particles: [], poured: 0, collected: 0, lost: 0,
      statics: staticSegments(level).map(s => ({ s, v: null })),
      rand: seed === undefined ? Math.random : mulberry32(seed),
      soaks: []
    };
  }

  // slop widens the zone a little for fingers on touch screens
  function inPourZone(level, x, y, slop = 0) {
    const z = level.pour;
    return x >= z.x - slop && x <= z.x + z.w + slop && y >= z.y - slop && y <= z.y + z.h + slop;
  }

  function collide(p, entry) {
    const [x1, y1, x2, y2] = entry.s;
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
    const u = len2 ? Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.y - y1) * dy) / len2)) : 0;
    const qx = x1 + u * dx, qy = y1 + u * dy;
    let nx = p.x - qx, ny = p.y - qy;
    const d = Math.hypot(nx, ny), reach = p.r + PHYS.WALL;
    if (d >= reach) return false;
    if (d < 1e-6) { nx = -dy; ny = dx; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; if (ny > 0) { nx = -nx; ny = -ny; } }
    else { nx /= d; ny /= d; }
    p.x += nx * (reach - d); p.y += ny * (reach - d);
    let svx = 0, svy = 0;
    if (entry.v) { svx = entry.v[0] + (entry.v[2] - entry.v[0]) * u; svy = entry.v[1] + (entry.v[3] - entry.v[1]) * u; }
    const rvx = p.vx - svx, rvy = p.vy - svy;
    const vn = rvx * nx + rvy * ny;
    let tx = rvx - vn * nx, ty = rvy - vn * ny;
    tx *= PHYS.FRICTION; ty *= PHYS.FRICTION;
    const outN = vn < 0 ? -vn * PHYS.RESTITUTION : vn;
    p.vx = svx + tx + outN * nx; p.vy = svy + ty + outN * ny;
    return true;
  }

  // Advance one fixed step. pour is {x,y} while the player is pouring inside the zone, else null.
  // Returns how many drops were collected / lost during this step.
  function stepWorld(world, pour) {
    const level = world.level, t = world.step / PHYS.HZ;
    let got = 0, missed = 0;
    if (pour && world.poured < level.supply && world.step % PHYS.SPAWN_EVERY === 0) {
      world.poured++;
      world.particles.push({ x: pour.x + (world.rand() - 0.5) * 8, y: pour.y + (world.rand() - 0.5) * 4, vx: (world.rand() - 0.5) * 0.5, vy: world.rand() * 0.6, r: 4 + world.rand() * 1.8, still: 0 });
    }
    const segs = world.statics.concat(dynamicSegments(level, t));
    const body = canBody(canAt(level, t));
    const ps = world.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.vy += PHYS.GRAVITY;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > PHYS.MAX_SPEED) { p.vx *= PHYS.MAX_SPEED / sp; p.vy *= PHYS.MAX_SPEED / sp; }
      p.x += p.vx; p.y += p.vy;
      for (const e of segs) collide(p, e);
      if (p.x > body.left + 3 && p.x < body.right - 3 && p.y > body.top + 2 && p.y < body.bottom) {
        ps.splice(i, 1); got++; continue;
      }
      p.still = Math.hypot(p.vx, p.vy) < PHYS.STILL_SPEED ? p.still + 1 : 0;
      if (p.y > PHYS.GROUND_Y || p.x < -20 || p.x > PHYS.WIDTH + 20 || p.still > PHYS.STILL_STEPS) {
        if (p.y > PHYS.GROUND_Y) world.soaks.push({ x: p.x, life: 1 });
        ps.splice(i, 1); missed++;
      }
    }
    world.collected += got; world.lost += missed; world.step++;
    return { got, missed };
  }

  function supplyLeft(world) { return world.level.supply - world.poured; }
  // Failed as soon as the target is out of reach even if every remaining and in-flight drop lands.
  function isFailed(world) { return world.collected + supplyLeft(world) + world.particles.length < world.level.target; }

  // ---------------------------------------------------------------------------
  // Random courses: a switchback of 2–3 ramps. Tier 2 adds a trapdoor on the last turn,
  // tier 3 also shrinks the can and sets it shuttling. Every course is test-run by
  // calibrate() and the water supply is sized from how well the test run did.
  // ---------------------------------------------------------------------------
  function randomLayout(rand, tier) {
    const n = 2 + Math.floor(rand() * 2);
    const size = tier >= 3 ? SMALL_CAN : CAN;
    const canTop = canBody(Object.assign({ x: 0 }, size)).top;
    const rhythm = 2.4 + Math.round(rand() * 8) / 10;
    const paths = [], trapdoors = [];
    const yStart = 150 + rand() * 8, yEnd = canTop - 40;
    const dropPer = (yEnd - yStart - 45 * (n - 1)) / n;
    let x = 55, y = yStart, dir = 1;
    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      const xb = last ? (dir > 0 ? 430 + rand() * 60 : 330 - rand() * 60) : (dir > 0 ? 540 + rand() * 40 : 260 - rand() * 40);
      const yb = last ? yEnd : y + dropPer * (0.85 + rand() * 0.15);
      const slope = (yb - y) / Math.abs(xb - x);
      const trapHere = tier >= 2 && i === n - 1 && i > 0;
      if (trapHere) {
        // the first 100px under the previous turn is a trapdoor
        const ty = y + slope * 100;
        trapdoors.push({ seg: [x, y, x + dir * 100, ty], period: rhythm, open: 0.35 + 0.05 * tier, phase: rand() });
        paths.push([x, y - 40, x, y], [x + dir * 100, ty, xb, yb]);
      } else {
        paths.push(i > 0 ? [x, y - 40, x, y, xb, yb] : [x, y, xb, yb]);
      }
      if (!last) {
        // turn: a wall stops the stream, which drops onto the next ramp heading back
        paths.push([xb + dir * 40, yb - 35, xb + dir * 40, yb + 15]);
        x = xb + dir * 60; y = yb + 45; dir = -dir;
      } else {
        const defl = xb + dir * 75;
        paths.push([defl, yb - 35, defl, canTop - 7]);
        const canX = dir > 0 ? xb - (tier >= 3 ? 10 : 20) : xb - (tier >= 3 ? 88 : 105);
        const can = Object.assign({ x: canX }, size);
        if (tier >= 3) {
          const room = dir > 0 ? PHYS.WIDTH - 10 - (canX + size.w) : canX - 10;
          can.move = { dx: dir * Math.min(150, room), period: rhythm, phase: rand(), rest: true };
        }
        return {
          name: 'Generated Course', target: 55 + tier * 15, supply: 120, rhythm: tier >= 2 ? rhythm : undefined,
          hint: tier >= 3 ? 'A fresh course — trapdoor and shuttle.' : tier >= 2 ? 'A fresh course. Watch the trapdoor’s beat.' : 'A fresh course every time.',
          pour: { x: 70, y: 92, w: tier >= 3 ? 90 : 150, h: 48 },
          can, paths, trapdoors
        };
      }
    }
  }

  // Test-pours a course and returns the best share of water that reached the can.
  function bestEfficiency(level) {
    const z = level.pour, point = { x: z.x + z.w / 2, y: z.y + z.h * 0.6 };
    const tryGate = gate => {
      const w = createWorld(level, 3);
      while (w.step < PHYS.HZ * 45 && (supplyLeft(w) > 0 || w.particles.length)) stepWorld(w, !gate || gate(w.step / PHYS.HZ) ? point : null);
      return w.collected / level.supply;
    };
    if (!level.rhythm) return tryGate(null);
    let best = 0;
    for (let k = 0; k < 8; k++) {
      const P = level.rhythm, phase = k / 8;
      best = Math.max(best, tryGate(t => ((t / P + phase) % 1) < 0.2));
    }
    return best;
  }

  function randomLevel(rand, tier) {
    rand = rand || Math.random; tier = tier || 1;
    for (let attempt = 0; attempt < 12; attempt++) {
      const fromLeft = rand() < 0.5;
      let level = randomLayout(rand, tier);
      if (!fromLeft) level = mirrorLevel(level, x => PHYS.WIDTH - x);
      const eff = bestEfficiency(level);
      if (eff < 0.5) continue;
      // a human won't match the test pour exactly, so leave more slack on easier tiers
      const slack = [0, 0.7, 0.8, 0.88][tier];
      level.supply = Math.ceil(level.target / (eff * slack));
      level.tested = eff;
      return level;
    }
    return Object.assign({}, levels.easy[0], { name: 'Generated Course' });
  }

  function mirrorLevel(level, m) {
    const mirrorSeg = s => [m(s[0]), s[1], m(s[2]), s[3]];
    const out = JSON.parse(JSON.stringify(level));
    out.paths = out.paths.map(p => p.map((v, i) => i % 2 ? v : m(v)));
    out.trapdoors = (out.trapdoors || []).map(d => Object.assign(d, { seg: mirrorSeg(d.seg) }));
    out.pour.x = m(out.pour.x + out.pour.w);
    out.can.x = m(out.can.x + out.can.w);
    if (out.can.move) out.can.move.dx = -out.can.move.dx;
    return out;
  }

  const api = {
    PHYS, levels, createWorld, stepWorld, inPourZone, supplyLeft, isFailed, randomLevel,
    canAt, canBody, staticSegments, sliderSeg, swingSeg, trapdoorOpen, trapdoorWarning, cycle, mulberry32
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WaterWay = api;
})(this);
