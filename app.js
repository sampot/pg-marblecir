import { MarbleCirAudio } from "./audio.js";
import {
  MarbleCirGame,
  FIELD_W,
  FIELD_H,
  RING_CX,
  RING_CY,
  RING_R,
  PLAYER_R,
  TARGET_COUNT,
  SHOTS,
  isInsideRing,
} from "./game.js";

const BEST_KEY = "pg-marblecir-best";
const audio = new MarbleCirAudio();
const game = new MarbleCirGame();
globalThis.__marblecir = game;

const canvas = document.getElementById("game");
const ctx = /** @type {HTMLCanvasElement} */ (canvas).getContext("2d");
const scoreEl = document.getElementById("score");
const shotsEl = document.getElementById("shots");
const bestEl = document.getElementById("best");
const statusEl = document.getElementById("status");
const btnStart = document.getElementById("btn-start");
const btnMute = document.getElementById("btn-mute");

canvas.width = FIELD_W;
canvas.height = FIELD_H;

let lastTs = 0;
let running = true;
let pointerId = null;
let dragStart = null;
let didDrag = false;
let bestScore = 0;
let bestLoaded = false;

function loadBestLocal() {
  const v = Number(localStorage.getItem(BEST_KEY) || "0");
  return Number.isFinite(v) ? v : 0;
}

function saveBestLocal(n) {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* ignore */
  }
}

async function loadBestKv() {
  try {
    const res = await fetch(`/api/kv/${BEST_KEY}`);
    if (!res.ok) return;
    const t = (await res.text()).trim();
    if (/^\d+$/.test(t)) {
      const v = Number(t);
      if (v >= 0) bestScore = v;
    }
  } catch {
    /* 無 KV 環境照玩 */
  }
  bestLoaded = true;
  syncHud();
}

async function saveBestKv(n) {
  try {
    await fetch(`/api/kv/${BEST_KEY}`, { method: "PUT", body: String(n) });
  } catch {
    /* ignore */
  }
}

function setStatus(msg, tone = "") {
  statusEl.textContent = msg;
  statusEl.dataset.tone = tone;
}

function syncHud() {
  scoreEl.textContent = String(game.score);
  shotsEl.textContent = String(Math.max(0, game.shots));
  bestEl.textContent = String(bestScore);

  if (game.status === "ready") {
    btnStart.textContent = "開局";
    btnStart.disabled = false;
  } else if (game.status === "playing") {
    btnStart.textContent = "彈射中";
    btnStart.disabled = true;
  } else {
    btnStart.textContent = "再來一局";
    btnStart.disabled = false;
  }
}

function canvasXY(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * FIELD_W,
    y: ((clientY - rect.top) / rect.height) * FIELD_H,
  };
}

function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function drawGround() {
  const bg = ctx.createLinearGradient(0, 0, 0, FIELD_H);
  bg.addColorStop(0, "#3a2f1f");
  bg.addColorStop(1, "#241c12");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  // 地面小石紋
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let i = 0; i < 40; i++) {
    const x = (i * 37) % FIELD_W;
    const y = (i * 53) % FIELD_H;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRing() {
  // 外緣粉筆粗線
  ctx.beginPath();
  ctx.arc(RING_CX, RING_CY, RING_R + 6, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(RING_CX, RING_CY, RING_R, 0, Math.PI * 2);
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 7]);
  ctx.lineDashOffset = -performance.now() * 0.01;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(RING_CX, RING_CY, RING_R * 0.55, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(248,250,252,0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** @param {import('./game.js').Marble} m @param {boolean} [highlight] */
function drawMarble(m, highlight = false) {
  if (!m.active) return;
  const sp = Math.hypot(m.vx, m.vy);
  const spin = sp * 0.002 * performance.now();

  ctx.save();
  ctx.translate(m.x, m.y);

  ctx.beginPath();
  ctx.ellipse(2, 3, m.r * 0.9, m.r * 0.5, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();

  const body = ctx.createRadialGradient(-m.r * 0.35, -m.r * 0.35, 1, 0, 0, m.r);
  body.addColorStop(0, m.highlight);
  body.addColorStop(0.35, m.color);
  body.addColorStop(0.85, shade(m.color, -30));
  body.addColorStop(1, shade(m.color, -55));

  ctx.beginPath();
  ctx.arc(0, 0, m.r, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(-m.r * 0.25, -m.r * 0.3, m.r * 0.55, spin, spin + Math.PI * 0.9);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (highlight || m.kind === "player") {
    const on = game.status === "playing" && isInsideRing(m.x, m.y, m.r);
    ctx.strokeStyle = on ? "rgba(248,113,113,0.9)" : "rgba(253,224,71,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, m.r + 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAim() {
  if (!game.aiming || game.aimPower < 0.05) return;
  const ox = game.player.x;
  const oy = game.player.y;

  ctx.strokeStyle = "rgba(253,224,71,0.75)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox + game.aimDx, oy + game.aimDy);
  ctx.stroke();
  ctx.setLineDash([]);

  const power = game.aimPower;
  const len = Math.hypot(game.aimDx, game.aimDy) || 1;
  const ux = -game.aimDx / len;
  const uy = -game.aimDy / len;
  const preview = 40 + power * 70;

  ctx.strokeStyle = `rgba(96,165,250,${0.35 + power * 0.4})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox + ux * preview, oy + uy * preview);
  ctx.stroke();

  for (let i = 1; i <= 5; i++) {
    ctx.fillStyle = i / 5 <= power ? "#fbbf24" : "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.arc(ox - 28 + i * 10, oy + PLAYER_R + 14, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBanner(msg) {
  ctx.fillStyle = "rgba(15,23,42,0.78)";
  roundRect(ctx, 24, FIELD_H / 2 - 30, FIELD_W - 48, 60, 12);
  ctx.fill();
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "700 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(msg, FIELD_W / 2, FIELD_H / 2 - 6);
  ctx.font = "500 12px system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`剩 ${game.shots} 發 · 目標 ${TARGET_COUNT - game.targetsCleared}/${TARGET_COUNT}`, FIELD_W / 2, FIELD_H / 2 + 14);
}

function draw() {
  ctx.clearRect(0, 0, FIELD_W, FIELD_H);
  const shake = game.aiming ? 0 : 0;
  ctx.save();
  ctx.translate(shake, shake);

  drawGround();
  drawRing();

  for (const t of game.getActiveTargets()) drawMarble(t);
  drawMarble(game.player, game.status === "playing");

  drawAim();
  ctx.restore();

  if (game.status === "ready") {
    drawBanner("點開局 · 拖曳彈珠彈射");
  } else if (game.status === "over") {
    drawBanner(game.message);
  }
}

function handleEvents(events) {
  for (const e of events) {
    if (e === "flick") audio.flick();
    else if (e === "hit") audio.hit();
    else if (e === "wall") audio.wall();
    else if (e === "target") {
      audio.targetOut();
      maybeRecordBest();
      setStatus(game.message, "win");
    } else if (e === "penalty") {
      audio.penalty();
      setStatus("你的彈珠留在圈內，扣 1 分", "warn");
    } else if (e === "turn") {
      audio.turn();
    } else if (e === "win") {
      audio.win();
      maybeRecordBest();
      setStatus(game.message, "win");
    } else if (e === "lose") {
      audio.over();
      maybeRecordBest();
      setStatus(game.message, "warn");
    }
  }
}

function maybeRecordBest() {
  if (game.score > bestScore) {
    bestScore = game.score;
    saveBestLocal(bestScore);
    void saveBestKv(bestScore);
  }
}

function frame(ts) {
  if (!running) return;
  const dt = Math.min(0.05, (ts - lastTs) / 1000) || 0.016;
  lastTs = ts;

  const { events } = game.update(dt);
  if (events.length) handleEvents(events);

  if (game.status === "playing" && !game.allStopped(30)) {
    if (Math.random() < 0.08) audio.roll();
  }

  draw();
  syncHud();
  requestAnimationFrame(frame);
}

async function tryStart() {
  await audio.unlock();
  game.start();
  audio.startBeep();
  setStatus("輪到你：拖曳你的彈珠反向拉弓");
  syncHud();
}

btnStart.addEventListener("click", () => {
  void tryStart();
});

btnMute.addEventListener("click", async () => {
  await audio.unlock();
  audio.setEnabled(!audio.enabled);
  btnMute.textContent = audio.enabled ? "音效開" : "音效關";
  btnMute.setAttribute("aria-pressed", audio.enabled ? "true" : "false");
});

canvas.addEventListener("pointerdown", async (e) => {
  await audio.unlock();
  if (game.status !== "playing") {
    void tryStart();
    return;
  }
  if (!game.allStopped()) return;

  const { x, y } = canvasXY(e.clientX, e.clientY);
  const dist = Math.hypot(x - game.player.x, y - game.player.y);
  if (dist > game.player.r + 30) return;

  canvas.setPointerCapture(e.pointerId);
  pointerId = e.pointerId;
  dragStart = { x, y };
  didDrag = false;
  game.setAim(x - game.player.x, y - game.player.y);
});

canvas.addEventListener("pointermove", (e) => {
  if (pointerId !== e.pointerId || !dragStart) return;
  const { x, y } = canvasXY(e.clientX, e.clientY);
  const dx = x - game.player.x;
  const dy = y - game.player.y;
  if (Math.hypot(dx, dy) > 10) didDrag = true;
  game.setAim(dx, dy);
});

function endPointer(e, release) {
  if (pointerId !== e.pointerId) return;
  pointerId = null;
  dragStart = null;

  if (!release) {
    game.clearAim();
    didDrag = false;
    return;
  }

  if (didDrag && game.aimPower >= 0.08) {
    const { events } = game.flickPlayer();
    handleEvents(events);
  } else {
    game.clearAim();
  }
  didDrag = false;
}

canvas.addEventListener("pointerup", (e) => endPointer(e, true));
canvas.addEventListener("pointercancel", (e) => endPointer(e, false));

window.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    if (game.status !== "playing") void tryStart();
  }
});

document.body.addEventListener(
  "pointerdown",
  () => {
    void audio.unlock();
  },
  { once: true },
);

bestScore = loadBestLocal();
setStatus("點開局 · 把圈內彈珠打出圈外");
syncHud();
void loadBestKv();
requestAnimationFrame((ts) => {
  lastTs = ts;
  requestAnimationFrame(frame);
});