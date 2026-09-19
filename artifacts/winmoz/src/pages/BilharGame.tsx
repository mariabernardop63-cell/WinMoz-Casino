import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, RotateCcw, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { serverBet, serverWin, serverForfeit } from "@/lib/gameApi";

// ─── Sound helpers ────────────────────────────────────────────────────────────
function playHitSound() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.08);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.12);
    setTimeout(() => ctx.close().catch(() => {}), 400);
  } catch {}
}
function playPocketSound() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.22);
    setTimeout(() => ctx.close().catch(() => {}), 400);
  } catch {}
}
function playCushionSound() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const t = ctx.currentTime;
    const bufLen = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass"; lpf.frequency.value = 600;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.4, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    src.connect(lpf); lpf.connect(ng); ng.connect(ctx.destination);
    src.start(t); src.stop(t + 0.09);
    setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch {}
}
function playWinSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t); osc.stop(t + 0.55);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {}
}

// ─── Physics Constants ────────────────────────────────────────────────────────
const BALL_RADIUS = 9;
const FRICTION = 0.985;
const WALL_DAMPING = 0.7;
const BALL_DAMPING = 0.96;
const MIN_SPEED = 0.08;
const TABLE_W = 360;
const TABLE_H = 640;
const RAIL = 18;
const POCKET_RADIUS = 16;
const CANVAS_W = TABLE_W + RAIL * 2;
const CANVAS_H = TABLE_H + RAIL * 2;

// Pocket positions (6 pockets)
const POCKETS: { x: number; y: number }[] = [
  { x: RAIL + 2, y: RAIL + 2 },
  { x: CANVAS_W / 2, y: RAIL - 2 },
  { x: CANVAS_W - RAIL - 2, y: RAIL + 2 },
  { x: RAIL + 2, y: CANVAS_H - RAIL - 2 },
  { x: CANVAS_W / 2, y: CANVAS_H - RAIL + 2 },
  { x: CANVAS_W - RAIL - 2, y: CANVAS_H - RAIL - 2 },
];

// ─── Ball Types ───────────────────────────────────────────────────────────────
interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pocketed: boolean;
  group: "solid" | "stripe" | "eight" | "cue" | null;
}

type PlayerGroup = "solid" | "stripe" | null;

// Standard ball colors
const BALL_COLORS: Record<number, string> = {
  0: "#FFFFFF",
  1: "#FFD700",
  2: "#0044CC",
  3: "#CC0000",
  4: "#6A0DAD",
  5: "#FF6600",
  6: "#006633",
  7: "#800020",
  8: "#000000",
  9: "#FFD700",
  10: "#0044CC",
  11: "#CC0000",
  12: "#6A0DAD",
  13: "#FF6600",
  14: "#006633",
  15: "#800020",
};

function getBallGroup(id: number): "solid" | "stripe" | "eight" | "cue" {
  if (id === 0) return "cue";
  if (id === 8) return "eight";
  if (id >= 1 && id <= 7) return "solid";
  return "stripe";
}

function isStripe(id: number): boolean {
  return id >= 9 && id <= 15;
}

// ─── Initial rack positions (triangle at top quarter of table) ────────────────
function makeInitialBalls(): Ball[] {
  const balls: Ball[] = [];
  const cueX = CANVAS_W / 2;
  const cueY = CANVAS_H * 0.72;
  balls.push({ id: 0, x: cueX, y: cueY, vx: 0, vy: 0, pocketed: false, group: "cue" });

  const headX = CANVAS_W / 2;
  const headY = CANVAS_H * 0.28;
  const d = BALL_RADIUS * 2.05;
  const rows = [
    [1],
    [9, 2],
    [10, 8, 3],
    [11, 4, 12, 5],
    [13, 6, 14, 15, 7],
  ];
  for (let r = 0; r < rows.length; r++) {
    const count = rows[r].length;
    for (let c = 0; c < count; c++) {
      const x = headX + (c - (count - 1) / 2) * d;
      const y = headY + r * d * 0.866;
      const id = rows[r][c];
      balls.push({ id, x, y, vx: 0, vy: 0, pocketed: false, group: getBallGroup(id) });
    }
  }
  return balls;
}

// ─── Physics Engine ───────────────────────────────────────────────────────────
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function isAnyBallMoving(balls: Ball[]): boolean {
  return balls.some(b => !b.pocketed && (Math.abs(b.vx) > MIN_SPEED || Math.abs(b.vy) > MIN_SPEED));
}

function stepPhysics(balls: Ball[]): { pocketed: number[]; hadHit: boolean; hadCushion: boolean } {
  const pocketed: number[] = [];
  let hadHit = false;
  let hadCushion = false;

  // Move balls
  for (const b of balls) {
    if (b.pocketed) continue;
    b.x += b.vx;
    b.y += b.vy;
    b.vx *= FRICTION;
    b.vy *= FRICTION;
    if (Math.abs(b.vx) < MIN_SPEED) b.vx = 0;
    if (Math.abs(b.vy) < MIN_SPEED) b.vy = 0;
  }

  // Wall bounces
  for (const b of balls) {
    if (b.pocketed) continue;
    const minX = RAIL + BALL_RADIUS;
    const maxX = CANVAS_W - RAIL - BALL_RADIUS;
    const minY = RAIL + BALL_RADIUS;
    const maxY = CANVAS_H - RAIL - BALL_RADIUS;

    // Check if near a pocket — skip wall bounce if close to pocket center
    let nearPocket = false;
    for (const p of POCKETS) {
      if (dist(b, p) < POCKET_RADIUS + BALL_RADIUS + 4) {
        nearPocket = true;
        break;
      }
    }
    if (nearPocket) continue;

    if (b.x < minX) { b.x = minX; b.vx = Math.abs(b.vx) * WALL_DAMPING; hadCushion = true; }
    if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx) * WALL_DAMPING; hadCushion = true; }
    if (b.y < minY) { b.y = minY; b.vy = Math.abs(b.vy) * WALL_DAMPING; hadCushion = true; }
    if (b.y > maxY) { b.y = maxY; b.vy = -Math.abs(b.vy) * WALL_DAMPING; hadCushion = true; }
  }

  // Ball-ball collisions
  for (let i = 0; i < balls.length; i++) {
    if (balls[i].pocketed) continue;
    for (let j = i + 1; j < balls.length; j++) {
      if (balls[j].pocketed) continue;
      const a = balls[i];
      const b = balls[j];
      const d = dist(a, b);
      const minDist = BALL_RADIUS * 2;
      if (d < minDist && d > 0.001) {
        // Elastic collision
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        const dvx = a.vx - b.vx;
        const dvy = a.vy - b.vy;
        const dvDotN = dvx * nx + dvy * ny;
        if (dvDotN > 0) {
          a.vx -= dvDotN * nx * BALL_DAMPING;
          a.vy -= dvDotN * ny * BALL_DAMPING;
          b.vx += dvDotN * nx * BALL_DAMPING;
          b.vy += dvDotN * ny * BALL_DAMPING;
          // Separate overlapping balls
          const overlap = minDist - d;
          a.x -= (overlap / 2) * nx;
          a.y -= (overlap / 2) * ny;
          b.x += (overlap / 2) * nx;
          b.y += (overlap / 2) * ny;
          hadHit = true;
        }
      }
    }
  }

  // Pocket detection
  for (const b of balls) {
    if (b.pocketed) continue;
    for (const p of POCKETS) {
      if (dist(b, p) < POCKET_RADIUS) {
        b.pocketed = true;
        b.vx = 0;
        b.vy = 0;
        pocketed.push(b.id);
        break;
      }
    }
  }

  return { pocketed, hadHit, hadCushion };
}

// ─── Bot AI ───────────────────────────────────────────────────────────────────
interface BotShot {
  angle: number;
  power: number;
  score: number;
}

function getTargetBalls(balls: Ball[], group: PlayerGroup): Ball[] {
  if (!group) return [];
  return balls.filter(b => !b.pocketed && b.group === group);
}

function getLineOfSight(
  cueBall: Ball,
  targetBall: Ball,
  allBalls: Ball[],
): { hit: boolean; angle: number } | null {
  // Simple line-of-sight check: is there a clear path from cueBall to targetBall?
  const dx = targetBall.x - cueBall.x;
  const dy = targetBall.y - cueBall.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1) return null;
  const nx = dx / d;
  const ny = dy / d;

  // Check for obstacles along the line
  for (const b of allBalls) {
    if (b.pocketed || b.id === cueBall.id || b.id === targetBall.id) continue;
    // Point-to-line distance
    const px = b.x - cueBall.x;
    const py = b.y - cueBall.y;
    const dot = px * nx + py * ny;
    if (dot < 0 || dot > d) continue;
    const perpX = px - dot * nx;
    const perpY = py - dot * ny;
    const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
    if (perpDist < BALL_RADIUS * 2.1) return null;
  }

  const angle = Math.atan2(dy, dx);
  return { hit: true, angle };
}

function scoreTargetBall(
  cueBall: Ball,
  target: Ball,
  allBalls: Ball[],
  pockets: { x: number; y: number }[],
): BotShot | null {
  const bestPocket = pockets.reduce((best, p) => {
    const dToTarget = dist(target, p);
    const dCueToTarget = dist(cueBall, target);
    const score = -(dCueToTarget * 0.3 + dToTarget * 0.7);
    return score > best.score ? { pocket: p, score } : best;
  }, { pocket: pockets[0], score: -Infinity });

  // Direction from target ball to best pocket
  const tpDx = bestPocket.pocket.x - target.x;
  const tpDy = bestPocket.pocket.y - target.y;
  const tpDist = Math.sqrt(tpDx * tpDx + tpDy * tpDy);
  if (tpDist < 1) return null;

  // Cue ball needs to hit target ball from opposite side of pocket direction
  const hitX = target.x - (tpDx / tpDist) * (BALL_RADIUS * 2);
  const hitY = target.y - (tpDy / tpDist) * (BALL_RADIUS * 2);

  // Direction from cue ball to hit point
  const dx = hitX - cueBall.x;
  const dy = hitY - cueBall.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1) return null;

  const angle = Math.atan2(dy, dx);
  const power = Math.min(1, d / 200) * 0.85 + 0.15;

  // Check if path is clear
  const los = getLineOfSight(cueBall, { ...target, x: hitX, y: hitY }, allBalls);
  if (!los) {
    // Try with a slight offset
    const perpX = -dy / d * BALL_RADIUS;
    const perpY = dx / d * BALL_RADIUS;
    const altLos = getLineOfSight(cueBall, { ...target, x: hitX + perpX, y: hitY + perpY }, allBalls);
    if (!altLos) return null;
  }

  // Score: prefer shots that pocket the ball and leave cue ball in good position
  const pocketDifficulty = tpDist / 100;
  const shotDistance = d / 100;
  const centerBonus = 1 - Math.sqrt((cueBall.x - CANVAS_W / 2) ** 2 + (cueBall.y - CANVAS_H / 2) ** 2) / (CANVAS_W / 2);
  const score = 10 - pocketDifficulty - shotDistance + centerBonus * 2;

  return { angle, power: Math.min(power, 0.9), score };
}

function botFindBestShot(balls: Ball[], group: PlayerGroup): BotShot | null {
  const cueBall = balls.find(b => b.id === 0 && !b.pocketed);
  if (!cueBall) return null;
  const targets = getTargetBalls(balls, group);
  if (targets.length === 0) return null;

  let best: BotShot | null = null;
  for (const t of targets) {
    const shot = scoreTargetBall(cueBall, t, balls, POCKETS);
    if (shot && (!best || shot.score > best.score)) {
      best = shot;
    }
  }
  return best;
}

// ─── Canvas Rendering ─────────────────────────────────────────────────────────
function renderTable(ctx: CanvasRenderingContext2D) {
  // Outer rail (rich dark wood)
  ctx.fillStyle = "#3E2010";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Wood grain texture on rail
  ctx.strokeStyle = "rgba(80,40,15,0.25)";
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 40; i++) {
    const gx = Math.random() * CANVAS_W;
    const gy = Math.random() * CANVAS_H;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + (Math.random() - 0.5) * 30, gy + Math.random() * 15);
    ctx.stroke();
  }

  // Inner rail bevel (lighter wood highlight)
  ctx.fillStyle = "#5C3520";
  roundRect(ctx, RAIL - 5, RAIL - 5, TABLE_W + 10, TABLE_H + 10, 8);
  ctx.fill();

  // Rail cushion edge (beveled groove)
  ctx.strokeStyle = "#8B6340";
  ctx.lineWidth = 1.5;
  roundRect(ctx, RAIL - 1, RAIL - 1, TABLE_W + 2, TABLE_H + 2, 5);
  ctx.stroke();

  // Felt base color
  ctx.fillStyle = "#1A6B3A";
  roundRect(ctx, RAIL + 1, RAIL + 1, TABLE_W - 2, TABLE_H - 2, 4);
  ctx.fill();

  // Felt gradient overlay (subtle depth)
  const feltGrad = ctx.createLinearGradient(RAIL, RAIL, RAIL, RAIL + TABLE_H);
  feltGrad.addColorStop(0, "rgba(255,255,255,0.04)");
  feltGrad.addColorStop(0.5, "rgba(0,0,0,0)");
  feltGrad.addColorStop(1, "rgba(0,0,0,0.06)");
  ctx.fillStyle = feltGrad;
  roundRect(ctx, RAIL + 1, RAIL + 1, TABLE_W - 2, TABLE_H - 2, 4);
  ctx.fill();

  // Felt texture (fine noise)
  ctx.fillStyle = "rgba(0,0,0,0.025)";
  for (let i = 0; i < 300; i++) {
    const x = RAIL + 2 + Math.random() * (TABLE_W - 4);
    const y = RAIL + 2 + Math.random() * (TABLE_H - 4);
    ctx.fillRect(x, y, 1, 1);
  }

  // Head string line
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 0.8;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(RAIL + 4, RAIL + TABLE_H * 0.72);
  ctx.lineTo(RAIL + TABLE_W - 4, RAIL + TABLE_H * 0.72);
  ctx.stroke();
  ctx.setLineDash([]);

  // Foot spot
  ctx.beginPath();
  ctx.arc(RAIL + TABLE_W / 2, RAIL + TABLE_H * 0.28, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fill();

  // Diamonds (sights) on rails
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  for (let i = 1; i <= 3; i++) {
    const y = RAIL + (TABLE_H / 4) * i;
    drawDiamond(ctx, RAIL - 9, y, 3.2);
    drawDiamond(ctx, RAIL + TABLE_W + 9, y, 3.2);
  }
  for (let i = 1; i <= 7; i++) {
    const x = RAIL + (TABLE_W / 8) * i;
    drawDiamond(ctx, x, RAIL - 9, 3.2);
    drawDiamond(ctx, x, RAIL + TABLE_H + 9, 3.2);
  }

  // Pocket openings (dark recessed holes)
  for (const p of POCKETS) {
    // Outer shadow ring
    const outerGrad = ctx.createRadialGradient(p.x, p.y, POCKET_RADIUS * 0.3, p.x, p.y, POCKET_RADIUS + 2);
    outerGrad.addColorStop(0, "#000");
    outerGrad.addColorStop(0.7, "#080808");
    outerGrad.addColorStop(1, "#111");
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = outerGrad;
    ctx.fill();

    // Inner dark hole
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_RADIUS - 4, 0, Math.PI * 2);
    ctx.fillStyle = "#050505";
    ctx.fill();

    // Pocket rim highlight
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(100,70,40,0.4)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fill();
}

function renderBall(ctx: CanvasRenderingContext2D, ball: Ball, _scale: number) {
  if (ball.pocketed) return;
  const r = BALL_RADIUS;
  const x = ball.x;
  const y = ball.y;
  const color = BALL_COLORS[ball.id] ?? "#FFFFFF";

  // Soft shadow
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + 1.5, y + 2.5, r + 1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.filter = "blur(2px)";
  ctx.fill();
  ctx.filter = "none";
  ctx.restore();

  // Ball body base
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  if (isStripe(ball.id)) {
    // Stripe: white ball with colored horizontal band
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    // White base
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // Colored band (center stripe)
    ctx.fillStyle = color;
    ctx.fillRect(x - r - 1, y - r * 0.42, r * 2 + 2, r * 0.84);
    ctx.restore();
  }

  // 3D sphere gradient overlay (glossy highlight)
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  // Main gradient (light from top-left)
  const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.05, x, y, r);
  grad.addColorStop(0, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.15)");
  grad.addColorStop(0.7, "rgba(0,0,0,0.0)");
  grad.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);

  // Sharp specular highlight (top-left)
  const spec = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x - r * 0.3, y - r * 0.35, r * 0.4);
  spec.addColorStop(0, "rgba(255,255,255,0.85)");
  spec.addColorStop(0.5, "rgba(255,255,255,0.2)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spec;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);

  // Bottom edge darkening
  const edge = ctx.createRadialGradient(x + r * 0.1, y + r * 0.5, r * 0.3, x, y, r);
  edge.addColorStop(0, "rgba(0,0,0,0)");
  edge.addColorStop(0.7, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = edge;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);

  ctx.restore();

  // Outline
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // Ball number (white circle background + number)
  if (ball.id > 0) {
    const numR = r * 0.42;
    ctx.beginPath();
    ctx.arc(x, y, numR, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 0.4;
    ctx.stroke();
    ctx.fillStyle = ball.id === 8 ? "#111" : "#222";
    ctx.font = `bold ${Math.round(r * 0.65)}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(ball.id), x, y + 0.5);
  }
}

function renderCueStick(
  ctx: CanvasRenderingContext2D,
  cueBall: Ball,
  angle: number,
  power: number,
  visible: boolean,
) {
  if (!visible || cueBall.pocketed) return;

  const stickLen = 220;
  const tipWidth = 2.5;
  const ferruleLen = 10;
  const shaftLen = stickLen * 0.48;
  const wrapLen = stickLen * 0.18;
  const buttLen = stickLen * 0.34;
  const buttWidth = 9;
  const pullBack = power * 35;

  // Tip position (pulled back based on power)
  const tipX = cueBall.x - Math.cos(angle) * (BALL_RADIUS + 5 + pullBack);
  const tipY = cueBall.y - Math.sin(angle) * (BALL_RADIUS + 5 + pullBack);

  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(angle);

  // Tapered shaft shape (thin tip → wider at wrap)
  // Tip (leather)
  const tipGrad = ctx.createLinearGradient(0, -tipWidth / 2, ferruleLen, tipWidth / 2);
  tipGrad.addColorStop(0, "#5BA3C9");
  tipGrad.addColorStop(1, "#4A8FB5");
  ctx.fillStyle = tipGrad;
  ctx.beginPath();
  ctx.moveTo(0, -tipWidth / 2);
  ctx.lineTo(ferruleLen, -tipWidth / 2 - 0.5);
  ctx.lineTo(ferruleLen, tipWidth / 2 + 0.5);
  ctx.lineTo(0, tipWidth / 2);
  ctx.closePath();
  ctx.fill();

  // Ferrule (white/cream section)
  const ferruleGrad = ctx.createLinearGradient(0, -tipWidth / 2, ferruleLen + 2, tipWidth / 2);
  ferruleGrad.addColorStop(0, "#F8F4E8");
  ferruleGrad.addColorStop(0.5, "#FFFDF5");
  ferruleGrad.addColorStop(1, "#EDE8D8");
  ctx.fillStyle = ferruleGrad;
  ctx.fillRect(ferruleLen, -(tipWidth + 0.5) / 2, ferruleLen, tipWidth + 0.5);

  // Shaft (maple wood)
  const shaftEnd = ferruleLen * 2 + shaftLen;
  const shaftGrad = ctx.createLinearGradient(0, -tipWidth / 2, 0, tipWidth / 2 + 1);
  shaftGrad.addColorStop(0, "#E8C87A");
  shaftGrad.addColorStop(0.3, "#F5DFA0");
  shaftGrad.addColorStop(0.5, "#F0D68C");
  shaftGrad.addColorStop(0.7, "#DABA64");
  shaftGrad.addColorStop(1, "#C8A854");
  ctx.fillStyle = shaftGrad;
  ctx.beginPath();
  ctx.moveTo(ferruleLen * 2, -(tipWidth + 0.5) / 2);
  ctx.lineTo(shaftEnd, -(tipWidth + 2) / 2 - 0.5);
  ctx.lineTo(shaftEnd, (tipWidth + 2) / 2 + 0.5);
  ctx.lineTo(ferruleLen * 2, (tipWidth + 0.5) / 2);
  ctx.closePath();
  ctx.fill();

  // Shaft wood grain lines
  ctx.strokeStyle = "rgba(180,140,60,0.2)";
  ctx.lineWidth = 0.3;
  for (let i = 0; i < 5; i++) {
    const gy = -tipWidth / 2 + (tipWidth / 5) * i + 0.5;
    ctx.beginPath();
    ctx.moveTo(ferruleLen * 2, gy);
    ctx.lineTo(shaftEnd, gy - 0.3);
    ctx.stroke();
  }

  // Joint ring (silver/metal)
  const jointX = shaftEnd;
  const jointGrad = ctx.createLinearGradient(0, -buttWidth / 2, 0, buttWidth / 2);
  jointGrad.addColorStop(0, "#AAA");
  jointGrad.addColorStop(0.3, "#DDD");
  jointGrad.addColorStop(0.5, "#FFF");
  jointGrad.addColorStop(0.7, "#CCC");
  jointGrad.addColorStop(1, "#888");
  ctx.fillStyle = jointGrad;
  ctx.fillRect(jointX, -buttWidth / 2 - 1, 4, buttWidth + 2);

  // Wrap ( Irish linen, dark textured)
  const wrapEnd = jointX + 4 + wrapLen;
  const wrapGrad = ctx.createLinearGradient(0, -buttWidth / 2, 0, buttWidth / 2);
  wrapGrad.addColorStop(0, "#1A1A1A");
  wrapGrad.addColorStop(0.3, "#2D2D2D");
  wrapGrad.addColorStop(0.5, "#1F1F1F");
  wrapGrad.addColorStop(0.7, "#2A2A2A");
  wrapGrad.addColorStop(1, "#151515");
  ctx.fillStyle = wrapGrad;
  ctx.beginPath();
  ctx.moveTo(jointX + 4, -(tipWidth + 2) / 2 - 0.5);
  ctx.lineTo(wrapEnd, -buttWidth / 2 - 0.5);
  ctx.lineTo(wrapEnd, buttWidth / 2 + 0.5);
  ctx.lineTo(jointX + 4, (tipWidth + 2) / 2 + 0.5);
  ctx.closePath();
  ctx.fill();

  // Wrap texture (cross-hatch)
  ctx.strokeStyle = "rgba(60,60,60,0.3)";
  ctx.lineWidth = 0.3;
  for (let i = 0; i < 8; i++) {
    const wx = jointX + 4 + (wrapLen / 8) * i;
    ctx.beginPath();
    ctx.moveTo(wx, -buttWidth / 2);
    ctx.lineTo(wx + 3, buttWidth / 2);
    ctx.stroke();
  }

  // Butt (dark wood, e.g. rosewood)
  const buttEnd = wrapEnd + buttLen;
  const buttGrad = ctx.createLinearGradient(0, -buttWidth / 2, 0, buttWidth / 2);
  buttGrad.addColorStop(0, "#2E1508");
  buttGrad.addColorStop(0.2, "#4A2010");
  buttGrad.addColorStop(0.5, "#3B1A0C");
  buttGrad.addColorStop(0.8, "#4E2212");
  buttGrad.addColorStop(1, "#251008");
  ctx.fillStyle = buttGrad;
  ctx.beginPath();
  ctx.moveTo(wrapEnd, -buttWidth / 2 - 0.5);
  ctx.lineTo(buttEnd, -buttWidth / 2 + 1);
  ctx.lineTo(buttEnd, buttWidth / 2 - 1);
  ctx.lineTo(wrapEnd, buttWidth / 2 + 0.5);
  ctx.closePath();
  ctx.fill();

  // Butt wood grain
  ctx.strokeStyle = "rgba(80,30,10,0.2)";
  ctx.lineWidth = 0.3;
  for (let i = 0; i < 3; i++) {
    const gy = -buttWidth / 2 + (buttWidth / 3) * i + 2;
    ctx.beginPath();
    ctx.moveTo(wrapEnd, gy);
    ctx.lineTo(buttEnd, gy + 0.5);
    ctx.stroke();
  }

  // Bumper (rubber end cap)
  const bumperGrad = ctx.createLinearGradient(0, -buttWidth / 2, 0, buttWidth / 2);
  bumperGrad.addColorStop(0, "#222");
  bumperGrad.addColorStop(0.5, "#333");
  bumperGrad.addColorStop(1, "#1A1A1A");
  ctx.fillStyle = bumperGrad;
  ctx.beginPath();
  ctx.moveTo(buttEnd, -buttWidth / 2 + 1);
  ctx.lineTo(buttEnd + 5, -buttWidth / 2 + 2);
  ctx.lineTo(buttEnd + 5, buttWidth / 2 - 2);
  ctx.lineTo(buttEnd, buttWidth / 2 - 1);
  ctx.closePath();
  ctx.fill();

  // Subtle outline
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, -tipWidth / 2);
  ctx.lineTo(buttEnd + 5, -buttWidth / 2 + 2);
  ctx.lineTo(buttEnd + 5, buttWidth / 2 - 2);
  ctx.lineTo(0, tipWidth / 2);
  ctx.stroke();

  ctx.restore();
}

function renderAimLine(
  ctx: CanvasRenderingContext2D,
  cueBall: Ball,
  angle: number,
  visible: boolean,
) {
  if (!visible || cueBall.pocketed) return;
  const len = 150;
  const endX = cueBall.x + Math.cos(angle) * len;
  const endY = cueBall.y + Math.sin(angle) * len;

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(
    cueBall.x + Math.cos(angle) * (BALL_RADIUS + 2),
    cueBall.y + Math.sin(angle) * (BALL_RADIUS + 2),
  );
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ─── Rematch Types ────────────────────────────────────────────────────────────
type RematchPhase = "idle" | "checking" | "no_balance" | "waiting" | "received" | "declined" | "opp_no_balance";

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BilharGame() {
  const [, setLocation] = useLocation();
  const { profile, refreshProfile } = useAuth();

  const sp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const gameId = sp.get("gameId") ?? "local";
  const BET = parseInt(sp.get("bet") ?? "0");
  const oppUrl = sp.get("opp") ?? "";
  const myNameUrl = sp.get("myname") ?? "";
  const playerName = myNameUrl ? decodeURIComponent(myNameUrl) : (profile?.full_name ?? "Jogador");
  const playerBal = profile?.balance ? `${Number(profile.balance).toLocaleString("pt-MZ")} MT` : "0 MT";
  const opponentName = oppUrl ? decodeURIComponent(oppUrl) : "Adversário";

  // Bot session
  const botSession = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(`wm_bot_session_${gameId}`) ?? "null") as
        { bot?: boolean; botBalance?: number } | null;
    } catch { return null; }
  })();
  const isBot = botSession?.bot === true;
  const botBal = Number(botSession?.botBalance ?? 0);

  // Game state
  const [balls, setBalls] = useState<Ball[]>(makeInitialBalls());
  const [turn, setTurn] = useState<1 | 2>(1);
  const [player1Group, setPlayer1Group] = useState<PlayerGroup>(null);
  const [player2Group, setPlayer2Group] = useState<PlayerGroup>(null);
  const [winner, setWinner] = useState<1 | 2 | null>(null);
  const [winReason, setWinReason] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [cueAngle, setCueAngle] = useState(0);
  const [power, setPower] = useState(0);
  const [showCue, setShowCue] = useState(true);
  const [lives, setLives] = useState<{ 1: number; 2: number }>({ 1: 5, 2: 5 });
  const [timer, setTimer] = useState(30);
  const [foulMessage, setFoulMessage] = useState<string | null>(null);
  const [rematchPhase, setRematchPhase] = useState<RematchPhase>("idle");
  const [rematchRequester, setRematchRequester] = useState("");
  const [scores, setScores] = useState<{ 1: number; 2: number }>({ 1: 0, 2: 0 });
  const [isDragAiming, setIsDragAiming] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [botThinking, setBotThinking] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef(balls);
  const turnRef = useRef(turn);
  const winnerRef = useRef(winner);
  const livesRef = useRef(lives);
  const p1GroupRef = useRef(player1Group);
  const p2GroupRef = useRef(player2Group);
  const foulTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number>(0);
  const simulatingRef = useRef(false);
  const betDeductedRef = useRef(
    gameId !== "local"
      ? sessionStorage.getItem(`wm_bet_deducted_bilhar_${gameId}`) === "1"
      : false,
  );
  const winCreditedRef = useRef(false);
  const timerRef = useRef(timer);
  const foulMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cueAngleRef = useRef(cueAngle);
  const powerRef = useRef(power);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const canvasScaleRef = useRef(1);

  useEffect(() => { ballsRef.current = balls; }, [balls]);
  useEffect(() => { turnRef.current = turn; }, [turn]);
  useEffect(() => { winnerRef.current = winner; }, [winner]);
  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { p1GroupRef.current = player1Group; }, [player1Group]);
  useEffect(() => { p2GroupRef.current = player2Group; }, [player2Group]);
  useEffect(() => { timerRef.current = timer; }, [timer]);
  useEffect(() => { cueAngleRef.current = cueAngle; }, [cueAngle]);
  useEffect(() => { powerRef.current = power; }, [power]);

  const myPlayer: 1 | 2 = 1;
  const oppPlayer: 1 | 2 = 2;
  const myTurn = turn === myPlayer && !winner;
  const myGroup = player1Group;
  const oppGroup = player2Group;
  const myBallsPocketed = balls.filter(b => !b.pocketed && myGroup && b.group === myGroup).length;
  const myGroupTotal = balls.filter(b => myGroup && b.group === myGroup).length;
  const oppBallsPocketed = balls.filter(b => !b.pocketed && oppGroup && b.group === oppGroup).length;
  const myGroupRemaining = myGroupTotal - myBallsPocketed;

  const isP1Turn = turn === 1;

  // ── Sound refs for frame-accurate playback
  const hadHitRef = useRef(false);
  const hadCushionRef = useRef(false);
  const justPocketedRef = useRef<number[]>([]);

  // ── Canvas sizing
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: CANVAS_W, h: CANVAS_H, scale: 1 });

  useEffect(() => {
    function resize() {
      if (!containerRef.current) return;
      const maxW = Math.min(containerRef.current.clientWidth - 16, 430);
      const scale = Math.min(maxW / CANVAS_W, 1);
      setCanvasSize({ w: CANVAS_W * scale, h: CANVAS_H * scale, scale });
      canvasScaleRef.current = scale;
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Physics simulation loop
  const simulationLoop = useCallback(() => {
    if (!simulatingRef.current) return;

    const b = ballsRef.current.map(ball => ({ ...ball }));
    const result = stepPhysics(b);

    // Track sounds
    if (result.hadHit) hadHitRef.current = true;
    if (result.hadCushion) hadCushionRef.current = true;
    if (result.pocketed.length > 0) {
      justPocketedRef.current = [...justPocketedRef.current, ...result.pocketed];
      playPocketSound();
    }

    ballsRef.current = b;
    setBalls([...b]);

    if (isAnyBallMoving(b)) {
      animFrameRef.current = requestAnimationFrame(simulationLoop);
    } else {
      // Simulation complete — process turn result
      simulatingRef.current = false;
      setIsSimulating(false);
      processTurnResult(justPocketedRef.current, hadHitRef.current);
      justPocketedRef.current = [];
      hadHitRef.current = false;
      hadCushionRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Process turn result after balls stop
  const processTurnResult = useCallback((pocketedIds: number[], hadContact: boolean) => {
    const currentTurn = turnRef.current;
    const currentBalls = ballsRef.current;
    const currentP1Group = p1GroupRef.current;
    const currentP2Group = p2GroupRef.current;
    const currentWinner = winnerRef.current;
    if (currentWinner) return;

    const cuePocketed = pocketedIds.includes(0);
    const eightPocketed = pocketedIds.includes(8);
    const currentGroup = currentTurn === 1 ? currentP1Group : currentP2Group;
    const nonCuePocketed = pocketedIds.filter(id => id !== 0);
    const legalPocketed = nonCuePocketed.filter(id => {
      if (id === 8) return false;
      if (!currentGroup) return true;
      return getBallGroup(id) === currentGroup;
    });
    const illegalPocketed = nonCuePocketed.filter(id => {
      if (id === 8) return false;
      if (!currentGroup) return false;
      return getBallGroup(id) !== currentGroup && getBallGroup(id) !== "eight";
    });

    let foul = false;
    let foulText = "";
    let switchTurn = true;
    let gameOver = false;
    let gameWinner: 1 | 2 | null = null;
    let reason = "";

    // ── Check for 8-ball pocketed
    if (eightPocketed) {
      const myGroupNow = currentTurn === 1 ? currentP1Group : currentP2Group;
      const myGroupBalls = currentBalls.filter(
        b => !b.pocketed && myGroupNow && b.group === myGroupNow,
      );
      // If player hasn't pocketed all their group balls, they lose
      if (myGroupBalls.length > 0 || !myGroupNow) {
        gameOver = true;
        gameWinner = currentTurn === 1 ? 2 : 1;
        reason = `${currentTurn === 1 ? playerName : opponentName} encaçapou a bola 8 prematuramente!`;
      } else {
        // Win!
        gameOver = true;
        gameWinner = currentTurn;
        reason = `${currentTurn === 1 ? playerName : opponentName} encaçapou a bola 8!`;
      }
    }

    // ── Check for cue ball pocketed (foul)
    if (cuePocketed && !gameOver) {
      foul = true;
      foulText = "Falta: bola branca encaçapada!";
      // Respawn cue ball
      const cueBall = currentBalls.find(b => b.id === 0);
      if (cueBall) {
        cueBall.pocketed = false;
        cueBall.x = CANVAS_W / 2;
        cueBall.y = CANVAS_H * 0.72;
        cueBall.vx = 0;
        cueBall.vy = 0;
      }
    }

    // ── Check for no ball contact
    if (!hadContact && !cuePocketed && !gameOver && currentGroup) {
      foul = true;
      foulText = "Falta: sem contacto com bola adversária!";
    }

    // ── Assign groups on first legal pocket (if not yet assigned)
    if (!gameOver && !currentP1Group && !currentP2Group && nonCuePocketed.length > 0 && !foul) {
      const firstPocketed = nonCuePocketed.find(id => id !== 8);
      if (firstPocketed !== undefined) {
        const group = getBallGroup(firstPocketed);
        if (group === "solid" || group === "stripe") {
          if (currentTurn === 1) {
            setPlayer1Group(group);
            setPlayer2Group(group === "solid" ? "stripe" : "solid");
            p1GroupRef.current = group;
            p2GroupRef.current = group === "solid" ? "stripe" : "solid";
          } else {
            setPlayer2Group(group);
            setPlayer1Group(group === "solid" ? "stripe" : "solid");
            p2GroupRef.current = group;
            p1GroupRef.current = group === "solid" ? "stripe" : "solid";
          }
        }
      }
    }

    // ── Determine if turn continues
    if (!foul && !gameOver && legalPocketed.length > 0) {
      switchTurn = false; // Player continues if they pocketed their ball legally
    }

    if (foul && !gameOver) {
      switchTurn = true;
    }

    // ── Apply turn result
    if (gameOver) {
      setWinner(gameWinner);
      winnerRef.current = gameWinner;
      setWinReason(reason);
      playWinSound();
      return;
    }

    // Show foul message
    if (foul) {
      setFoulMessage(foulText);
      if (foulMsgTimerRef.current) clearTimeout(foulMsgTimerRef.current);
      foulMsgTimerRef.current = setTimeout(() => setFoulMessage(null), 2500);
    }

    const nextTurn = switchTurn ? (currentTurn === 1 ? 2 as 1 | 2 : 1 as 1 | 2) : currentTurn;
    setTurn(nextTurn);
    setTimer(30);
    setShowCue(true);

    // Trigger bot turn if needed
    if (isBot && nextTurn === 2 && !winnerRef.current) {
      setTimeout(() => triggerBotShot(), 500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerName, opponentName]);

  // ── Shoot
  const shoot = useCallback((shootAngle: number, shootPower: number) => {
    if (simulatingRef.current || winnerRef.current) return;
    const cueBall = ballsRef.current.find(b => b.id === 0 && !b.pocketed);
    if (!cueBall) return;

    const speed = shootPower * 15;
    const vx = Math.cos(shootAngle) * speed;
    const vy = Math.sin(shootAngle) * speed;

    const updated = ballsRef.current.map(b =>
      b.id === 0 ? { ...b, vx, vy } : { ...b },
    );

    ballsRef.current = updated;
    setBalls(updated);
    setShowCue(false);
    setIsSimulating(true);
    simulatingRef.current = true;
    playHitSound();

    animFrameRef.current = requestAnimationFrame(simulationLoop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationLoop]);

  // ── Bot shot
  const triggerBotShot = useCallback(() => {
    if (winnerRef.current || simulatingRef.current) return;
    const currentBalls = ballsRef.current;
    const group = p2GroupRef.current;
    setBotThinking(true);

    const delay = 1200 + Math.random() * 1500;
    setTimeout(() => {
      setBotThinking(false);
      const shot = botFindBestShot(currentBalls, group);
      if (shot) {
        // Add slight randomness
        const randAngle = shot.angle + (Math.random() - 0.5) * 0.08;
        const randPower = shot.power + (Math.random() - 0.5) * 0.08;
        shoot(randAngle, Math.max(0.1, Math.min(0.95, randPower)));
      } else {
        // No good shot — random gentle tap
        const cueBall = currentBalls.find(b => b.id === 0 && !b.pocketed);
        if (cueBall) {
          const angle = Math.random() * Math.PI * 2;
          shoot(angle, 0.2 + Math.random() * 0.2);
        }
      }
    }, delay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shoot]);

  // ── Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;
    function draw() {
      if (!running || !ctx || !canvas) return;
      const scale = canvasScaleRef.current;
      canvas.width = CANVAS_W * scale;
      canvas.height = CANVAS_H * scale;
      ctx.scale(scale, scale);

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      renderTable(ctx);

      // Draw balls
      for (const ball of ballsRef.current) {
        renderBall(ctx, ball, scale);
      }

      // Draw aim line and cue stick
      const cueBall = ballsRef.current.find(b => b.id === 0 && !b.pocketed);
      if (cueBall && showCue && !isSimulating && !winnerRef.current) {
        renderAimLine(ctx, cueBall, cueAngleRef.current, true);
        renderCueStick(ctx, cueBall, cueAngleRef.current, powerRef.current, true);
      }

      requestAnimationFrame(draw);
    }
    draw();
    return () => { running = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize, showCue, isSimulating]);

  // ── Bot trigger on turn change
  useEffect(() => {
    if (isBot && turn === 2 && !winner && !isSimulating) {
      triggerBotShot();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, winner, isSimulating]);

  // ── Win processing
  useEffect(() => {
    if (!winner || winCreditedRef.current) return;
    winCreditedRef.current = true;

    if (gameId === "local" || BET <= 0) return;

    const isWinner = winner === myPlayer;
    if (isBot) {
      if (isWinner) {
      serverWin(gameId, "bilhar", BET).then(() => refreshProfile()).catch(() => {});
      }
    } else if (isWinner) {
      serverWin(gameId, "bilhar", BET).then(() => refreshProfile()).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner]);

  // ── Bet deduction
  useEffect(() => {
    if (!isBot || !profile?.id || BET <= 0 || betDeductedRef.current) return;
    if (sessionStorage.getItem(`wm_bet_deducted_bilhar_${gameId}`) === "1") {
      betDeductedRef.current = true;
      return;
    }
    betDeductedRef.current = true;
    (async () => {
      try {
        const result = await serverBet(BET, "bilhar", `Aposta (Bilhar) vs ${opponentName}`, gameId);
        if (!result.ok) { betDeductedRef.current = false; return; }
        try { sessionStorage.setItem(`wm_bet_deducted_bilhar_${gameId}`, "1"); } catch {}
        await refreshProfile();
      } catch { betDeductedRef.current = false; }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBot]);

  // ── Timer countdown per turn
  useEffect(() => {
    if (winner || isSimulating) return;
    const iv = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          const currentTurnVal = turnRef.current;
          setLives(pl => {
            const nl = { ...pl };
            nl[currentTurnVal] = Math.max(0, nl[currentTurnVal] - 1);
            livesRef.current = nl;
            if (nl[currentTurnVal] <= 0) {
              setWinner(currentTurnVal === 1 ? 2 : 1);
              winnerRef.current = currentTurnVal === 1 ? 2 : 1;
              setWinReason("Sem vidas restantes!");
            }
            return nl;
          });
          // Switch turn on timeout
          const nextTurn = currentTurnVal === 1 ? 2 as 1 | 2 : 1 as 1 | 2;
          setTurn(nextTurn);
          setShowCue(true);
          if (isBot && nextTurn === 2) {
            setTimeout(() => triggerBotShot(), 500);
          }
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, winner, isSimulating]);

  // ── Forfeit
  function handleForfeit() {
    if (winner) return;
    if (!window.confirm("Tens a certeza que queres desistir?")) return;
    if (gameId !== "local" && !isBot && BET > 0) void serverForfeit(gameId, "bilhar");
    setWinner(2);
    setWinReason("Desististe da partida");
  }

  function handleBack() {
    setLocation("/");
  }

  function resetGame() {
    const newBalls = makeInitialBalls();
    ballsRef.current = newBalls;
    setBalls(newBalls);
    setTurn(1);
    setPlayer1Group(null);
    setPlayer2Group(null);
    p1GroupRef.current = null;
    p2GroupRef.current = null;
    setWinner(null);
    winnerRef.current = null;
    setWinReason("");
    setIsSimulating(false);
    simulatingRef.current = false;
    setShowCue(true);
    setPower(0);
    setCueAngle(0);
    setTimer(30);
    setLives({ 1: 5, 2: 5 });
    livesRef.current = { 1: 5, 2: 5 };
    setFoulMessage(null);
    betDeductedRef.current = false;
    winCreditedRef.current = false;
    justPocketedRef.current = [];
    hadHitRef.current = false;
    hadCushionRef.current = false;
  }

  async function handleReplay() {
    if (gameId === "local" || BET === 0) { resetGame(); return; }
    if (isBot) {
      if (!profile?.id) return;
      let st = { count: 0, lastWon: null as boolean | null };
      try {
        const raw = sessionStorage.getItem("wm_bot_rematch_bilhar");
        if (raw) { const p = JSON.parse(raw); if (p && typeof p.count === "number") st = p; }
      } catch { /* noop */ }
      const botWon = winner === 2;
      if (st.lastWon !== botWon) { st.count = 0; st.lastWon = botWon; }
      const maxRematches = botWon ? 3 : 1;
      const willAccept = st.count < maxRematches;

      setRematchPhase("checking");
      setTimeout(() => {
        if (!willAccept) { setRematchPhase("declined"); return; }
        setRematchPhase("waiting");
        setTimeout(async () => {
          try {
            const { getSessionWithRefresh } = await import("@/lib/supabase");
            const session = await getSessionWithRefresh();
            const token = session?.access_token;
            if (!token) { setRematchPhase("no_balance"); return; }
            const res = await fetch("/api/games/bot-session", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ gameType: "bilhar", betAmount: BET }),
            });
            const json = await res.json() as { ok?: boolean; gameId?: string; botName?: string; botBalance?: number; error?: string };
            if (!res.ok || !json.ok || !json.gameId) {
              setRematchPhase("no_balance");
              return;
            }
            st.count += 1;
            try { sessionStorage.setItem("wm_bot_rematch_bilhar", JSON.stringify(st)); } catch {}
            try { sessionStorage.setItem(`wm_bet_deducted_bilhar_${json.gameId}`, "1"); } catch {}
            try { sessionStorage.setItem(`wm_bot_session_${json.gameId}`, JSON.stringify({ bot: true, botBalance: json.botBalance ?? 200 })); } catch {}
            await refreshProfile();
            setRematchPhase("idle");
            const myEnc = encodeURIComponent(playerName);
            const oppEnc = encodeURIComponent(json.botName ?? opponentName);
            setLocation(`/bilhar-jogo?gameId=${json.gameId}&bet=${BET}&opp=${oppEnc}&myname=${myEnc}`);
          } catch { setRematchPhase("no_balance"); }
        }, 900 + Math.random() * 700);
      }, 700 + Math.random() * 600);
      return;
    }
    if (!profile?.id) { setRematchPhase("no_balance"); return; }
    setRematchPhase("waiting");
  }

  // ── Canvas pointer handlers
  function getCanvasCoords(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (isSimulating || winner || !myTurn) return;
    const cueBall = ballsRef.current.find(b => b.id === 0 && !b.pocketed);
    if (!cueBall) return;
    const { x, y } = getCanvasCoords(e);
    setIsDragAiming(true);
    setDragStart({ x, y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDragAiming || isSimulating || winner) return;
    const cueBall = ballsRef.current.find(b => b.id === 0 && !b.pocketed);
    if (!cueBall) return;
    const { x, y } = getCanvasCoords(e);
    const dx = cueBall.x - x;
    const dy = cueBall.y - y;
    const angle = Math.atan2(dy, dx);
    setCueAngle(angle);
    // Power based on drag distance
    const dragDist = Math.sqrt((x - (dragStart?.x ?? x)) ** 2 + (y - (dragStart?.y ?? y)) ** 2);
    setPower(Math.min(1, dragDist / 120));
  }

  function handlePointerUp(_e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDragAiming || isSimulating || winner || !myTurn) {
      setIsDragAiming(false);
      return;
    }
    const currentPower = powerRef.current;
    if (currentPower > 0.05) {
      shoot(cueAngleRef.current, currentPower);
    }
    setIsDragAiming(false);
    setDragStart(null);
  }

  // ── Power slider
  function handlePowerChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (isSimulating || winner || !myTurn) return;
    setPower(parseFloat(e.target.value));
  }

  function handleShootButton() {
    if (isSimulating || winner || !myTurn) return;
    if (powerRef.current > 0.05) {
      shoot(cueAngleRef.current, powerRef.current);
    }
  }

  // ── Cleanup
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (foulTimerRef.current) clearTimeout(foulTimerRef.current);
      if (foulMsgTimerRef.current) clearTimeout(foulMsgTimerRef.current);
    };
  }, []);

  // ── Render
  const turnLabel = winner
    ? `Jogo terminado — ${winner === myPlayer ? "Venceste!" : "Perdeste"}`
    : isSimulating
      ? "Bolas em movimento..."
      : myTurn
        ? `${playerName.split(" ")[0]} — faz a tua jogada`
        : isBot && turn === 2
          ? `${opponentName} está a pensar...`
          : `A aguardar ${opponentName}...`;

  return (
    <div className="responsive-game-viewport gz-game-viewport" style={{
      height: "100vh", width: "100%", overflow: "hidden",
      display: "flex", justifyContent: "center",
    }}>
      <div className="responsive-game-shell gz-game-shell" style={{
        width: "100%", maxWidth: 430, height: "100vh", overflow: "hidden",
        display: "flex", flexDirection: "column", position: "relative",
      }}>

        {/* Header */}
        <div className="gz-game-header">
          <button onClick={handleBack} className="gz-game-iconbtn" aria-label="Voltar">
            <ArrowLeft style={{ width: 17, height: 17 }} />
          </button>
          <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
            <p className="gz-game-title">BILHAR</p>
            <p className="gz-game-subtitle">1 VS 1 · 8-BALL</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {!winner && gameId !== "local" && (
              <button onClick={handleForfeit} className="gz-game-iconbtn danger" aria-label="Desistir">
                <LogOut style={{ width: 16, height: 16 }} />
              </button>
            )}
            <div className="gz-game-chip">
              {BET > 0 ? `${BET} MT` : "Demo"}
            </div>
          </div>
        </div>

        {/* Opponent panel */}
        <div className="gz-game-panelcol" style={{ padding: "6px 10px 2px", flexShrink: 0 }}>
          <div className={`gz-playerpanel ${turn === 2 && !winner ? "active" : ""}`}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: oppGroup === "solid"
                ? "linear-gradient(135deg, #FFD700, #CC0000)"
                : oppGroup === "stripe"
                  ? "linear-gradient(135deg, #fff 30%, #FFD700 30%, #FFD700 70%, #fff 70%)"
                  : "linear-gradient(135deg, #555, #333)",
              border: `2px solid ${turn === 2 && !winner ? "rgba(212,160,23,.6)" : "rgba(255,255,255,.1)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 900, color: "#fff",
            }}>
              {opponentName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                <span className={`gz-player-name ${turn === 2 && !winner ? "" : "idle"}`}
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>
                  {opponentName}
                </span>
                <span className="gz-playerbadge rival">Rival</span>
              </div>
              <div style={{ fontSize: 10, color: turn === 2 && !winner ? "#f2d38a" : "rgba(244,236,217,.4)", fontWeight: 700 }}>
                {oppGroup ? `${oppGroup === "solid" ? "Sólidas" : "Listradas"} · ` : ""}
                {balls.filter(b => !b.pocketed && oppGroup && b.group === oppGroup).length} restantes
              </div>
            </div>
            <div style={{ display: "flex", gap: 3, padding: "0 8px 0 4px" }}>
              {Array.from({ length: 5 }).map((_, i) => {
                const alive = i < (lives[2] ?? 5);
                return (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: alive ? "#EF4444" : "rgba(255,255,255,.12)",
                    border: alive ? "none" : "1px solid rgba(255,255,255,.12)",
                    boxShadow: alive ? "0 0 5px rgba(239,68,68,.7)" : "none",
                    transition: "all 0.3s ease",
                  }} />
                );
              })}
            </div>
          </div>
        </div>

        {/* Turn indicator */}
        <div className="gz-game-panelcol" style={{ padding: "4px 10px 2px", flexShrink: 0, display: "flex", justifyContent: "center" }}>
          <div className={`gz-turn ${myTurn && !winner ? "mine" : ""}`}>
            <span className="gz-turndot" style={{
              background: myTurn && !winner ? "#f2d38a" : "rgba(244,236,217,.4)",
              color: myTurn && !winner ? "#f2d38a" : "transparent",
            }} />
            {turnLabel}
          </div>
        </div>

        {/* Foul message */}
        <AnimatePresence>
          {foulMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                position: "absolute", top: 120, left: "50%", transform: "translateX(-50%)",
                background: "rgba(220,38,38,0.9)", color: "#fff", padding: "6px 16px",
                borderRadius: 10, fontSize: 12, fontWeight: 700, zIndex: 50,
                boxShadow: "0 4px 15px rgba(220,38,38,0.4)",
              }}
            >
              {foulMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas */}
        <div ref={containerRef} className="gz-game-body" style={{
          padding: "4px 10px", flex: 1, display: "flex",
          alignItems: "center", justifyContent: "center", overflow: "hidden",
        }}>
          <canvas
            ref={canvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            style={{
              width: canvasSize.w,
              height: canvasSize.h,
              borderRadius: 12,
              cursor: myTurn && !isSimulating && !winner ? "crosshair" : "default",
              touchAction: "none",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>

        {/* Power control */}
        {myTurn && !isSimulating && !winner && (
          <div style={{
            padding: "4px 16px 6px", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 10, color: "rgba(244,236,217,.5)", fontWeight: 700, width: 42 }}>
              POTÊNCIA
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={power}
              onChange={handlePowerChange}
              style={{
                flex: 1, height: 6, borderRadius: 3, appearance: "none",
                background: `linear-gradient(90deg, #4ade80 ${power * 100}%, rgba(255,255,255,.12) ${power * 100}%)`,
                cursor: "pointer",
              }}
            />
            <button
              onClick={handleShootButton}
              disabled={power < 0.05}
              style={{
                padding: "8px 18px", borderRadius: 10, border: "none", cursor: power >= 0.05 ? "pointer" : "not-allowed",
                background: power >= 0.05
                  ? "linear-gradient(135deg, #D4A35A, #B8862E)"
                  : "rgba(255,255,255,.1)",
                color: "#fff", fontWeight: 800, fontSize: 12,
                fontFamily: "'Syne',sans-serif",
                opacity: power >= 0.05 ? 1 : 0.5,
              }}
            >
              DISPARAR
            </button>
          </div>
        )}

        {/* My panel */}
        <div className="gz-game-panelcol" style={{ padding: "4px 10px 6px", flexShrink: 0 }}>
          <div className={`gz-playerpanel ${turn === 1 && !winner ? "active" : ""}`}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: myGroup === "solid"
                ? "linear-gradient(135deg, #FFD700, #CC0000)"
                : myGroup === "stripe"
                  ? "linear-gradient(135deg, #fff 30%, #FFD700 30%, #FFD700 70%, #fff 70%)"
                  : "linear-gradient(135deg, #f5f0e0, #d8d0b8)",
              border: `2px solid ${turn === 1 && !winner ? "rgba(212,160,23,.6)" : "rgba(255,255,255,.2)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 900,
              color: myGroup === "solid" || myGroup === "stripe" ? "#fff" : "#333",
            }}>
              {playerName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                <span className={`gz-player-name ${turn === 1 && !winner ? "" : "idle"}`}
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>
                  {playerName}
                </span>
                <span className="gz-playerbadge me">Tu</span>
              </div>
              <div style={{ fontSize: 10, color: turn === 1 && !winner ? "#f2d38a" : "rgba(244,236,217,.4)", fontWeight: 700 }}>
                {myGroup ? `${myGroup === "solid" ? "Sólidas" : "Listradas"} · ` : ""}
                {balls.filter(b => !b.pocketed && myGroup && b.group === myGroup).length} restantes
              </div>
            </div>
            <div style={{ padding: "0 8px 0 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{
                fontSize: 14, fontWeight: 800,
                color: timer > 10 ? "#4ade80" : timer > 5 ? "#fbbf24" : "#ef4444",
              }}>
                {timer}s
              </span>
              <div style={{ display: "flex", gap: 3 }}>
                {Array.from({ length: 5 }).map((_, i) => {
                  const alive = i < (lives[1] ?? 5);
                  return (
                    <div key={i} style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: alive ? "#EF4444" : "rgba(255,255,255,.12)",
                      border: alive ? "none" : "1px solid rgba(255,255,255,.12)",
                      boxShadow: alive ? "0 0 5px rgba(239,68,68,.7)" : "none",
                      transition: "all 0.3s ease",
                    }} />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bot thinking overlay */}
        <AnimatePresence>
          {botThinking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "absolute", bottom: 140, left: "50%", transform: "translateX(-50%)",
                background: "rgba(0,0,0,0.7)", color: "#f2d38a", padding: "6px 16px",
                borderRadius: 10, fontSize: 11, fontWeight: 700, zIndex: 40,
              }}
            >
              🎱 A pensar...
            </motion.div>
          )}
        </AnimatePresence>

        {/* Win overlay */}
        <AnimatePresence>
          {winner && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="gz-modal-backdrop">
              <motion.div initial={{ scale: 0.6, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 22 }}
                className="gz-modal-card">
                <div className="gz-modal-head">
                  {winner === myPlayer ? (
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="gz-modal-icon-badge">
                      <svg width={40} height={40} viewBox="0 0 100 100" fill="none">
                        <defs>
                          <linearGradient id="bwtg" x1="25%" y1="0%" x2="75%" y2="100%">
                            <stop offset="0%" stopColor="#FFE566" />
                            <stop offset="50%" stopColor="#FFD700" />
                            <stop offset="100%" stopColor="#B8860B" />
                          </linearGradient>
                        </defs>
                        <circle cx="50" cy="45" r="28" fill="url(#bwtg)" />
                        <circle cx="50" cy="45" r="14" fill="#1a1a1a" />
                        <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
                          fill="#fff" fontSize="14" fontWeight="bold">8</text>
                      </svg>
                    </motion.div>
                  ) : (
                    <div className="gz-modal-icon-badge">
                      <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
                        <path d="M8 8 L24 24 M24 8 L8 24" stroke="#f87171" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                  <p className="gz-modal-label" style={{ marginBottom: 6 }}>
                    {winner === myPlayer ? "VENCEDOR" : "DERROTA"}
                  </p>
                  <p className="gz-modal-title">
                    {winner === myPlayer ? playerName : opponentName}
                  </p>
                </div>
                <div className="gz-modal-body">
                  {BET > 0 && winner === myPlayer && (
                    <div className="gz-stake-box win">
                      <div>
                        <p className="gz-stake-label">GANHOS</p>
                        <p className="gz-stake-value win">
                          +{Math.floor(BET * 2 * 0.90).toLocaleString("pt-MZ")}<span style={{ fontSize: 12 }}> MT</span>
                        </p>
                      </div>
                    </div>
                  )}
                  {BET > 0 && winner !== myPlayer && (
                    <div className="gz-stake-box loss">
                      <div>
                        <p className="gz-stake-label">PERDIDO</p>
                        <p className="gz-stake-value loss">
                          -{BET.toLocaleString("pt-MZ")}<span style={{ fontSize: 12 }}> MT</span>
                        </p>
                      </div>
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: "rgba(246,230,191,.6)", marginBottom: 12, lineHeight: 1.4 }}>
                    {winReason}
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={handleReplay} className="gz-btn-primary">
                      <RotateCcw style={{ width: 13, height: 13 }} />Jogar Novamente
                    </button>
                    <button onClick={handleBack} className="gz-btn-ghost">
                      <LogOut style={{ width: 13, height: 13 }} />Sair
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rematch overlay */}
        <AnimatePresence>
          {rematchPhase !== "idle" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                position: "fixed", inset: 0, zIndex: 200,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              className="gz-modal-backdrop">
              <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                style={{
                  width: "82%", maxWidth: 300, borderRadius: 24, padding: "28px 22px 22px",
                  textAlign: "center", background: "linear-gradient(180deg,#221c15,#14100b)",
                  border: "1px solid rgba(212,160,23,.22)",
                  boxShadow: "0 30px 80px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06)",
                }}>
                <p style={{
                  fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 18,
                  color: "#f6e6bf", marginBottom: 8,
                }}>
                  {rematchPhase === "checking" && "A verificar saldo…"}
                  {rematchPhase === "no_balance" && "Saldo insuficiente"}
                  {rematchPhase === "waiting" && "Desafio enviado!"}
                  {rematchPhase === "declined" && "Desafio recusado"}
                </p>
                <p style={{ fontSize: 12, color: "rgba(246,230,191,.5)", marginBottom: 20, lineHeight: 1.5 }}>
                  {rematchPhase === "checking" && "Por favor aguarda."}
                  {rematchPhase === "no_balance" && `Precisas de pelo menos ${BET} MT para rever o desafio.`}
                  {rematchPhase === "waiting" && `Aguardando resposta de ${opponentName}…`}
                  {rematchPhase === "declined" && `${opponentName} recusou a revanche.`}
                </p>
                <button onClick={() => setRematchPhase("idle")} className="gz-btn-ghost" style={{ width: "100%" }}>
                  Fechar
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
