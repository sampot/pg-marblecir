/**
 * 彈珠圈 — 地上畫圈彈珠：圈內放目標彈珠，場外玩家彈射自己的彈珠
 * 把圈內目標彈珠打出圈外得點；若自己的彈珠留在圈內則扣分。
 * 純函式規則邏輯（不碰 DOM），可單元測試。
 */

export const FIELD_W = 360;
export const FIELD_H = 480;
export const RING_CX = FIELD_W / 2;
export const RING_CY = FIELD_H / 2;
export const RING_R = 128;
export const PLAYER_R = 12;
export const TARGET_R = 9;
export const TARGET_COUNT = 6;
export const SHOTS = 8;
export const PENALTY = 1;

export const FRICTION = 0.992;
export const ROLL_FRICTION = 0.988;
export const MIN_SPEED = 4;
export const RESTITUTION = 0.8;
export const WALL_RESTITUTION = 0.55;
export const MAX_SPEED = 1200;
export const FIXED_DT = 1 / 240;

/** @typedef {'player' | 'target'} MarbleKind */

/**
 * @typedef {object} Marble
 * @property {string} id
 * @property {MarbleKind} kind
 * @property {string} label
 * @property {string} color
 * @property {string} highlight
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} r
 * @property {boolean} active
 */

const TARGET_PALETTE = [
  { color: "#f87171", highlight: "#fecaca", label: "紅" },
  { color: "#fb923c", highlight: "#fed7aa", label: "橙" },
  { color: "#a3e635", highlight: "#ecfccb", label: "綠" },
  { color: "#38bdf8", highlight: "#bae6fd", label: "青" },
  { color: "#c084fc", highlight: "#e9d5ff", label: "紫" },
  { color: "#f472b6", highlight: "#fbcfe8", label: "粉" },
];

/** 判斷彈珠中心是否在圈內（含邊界）。 */
export function isInsideRing(x, y, r = PLAYER_R) {
  const dx = x - RING_CX;
  const dy = y - RING_CY;
  return Math.hypot(dx, dy) <= RING_R - r;
}

/** 判斷目標彈珠是否已被打出圈外（中心越過圈線）。 */
export function isTargetOut(x, y, r = TARGET_R) {
  const dx = x - RING_CX;
  const dy = y - RING_CY;
  return Math.hypot(dx, dy) > RING_R - r;
}

export class MarbleCirGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.shots = SHOTS;
    this.targetsCleared = 0;
    this.penalties = 0;
    this.status = /** @type {'ready' | 'playing' | 'over'} */ ("ready");
    this.message = "點開局，拖曳你的彈珠瞄準彈射";
    this.turn = "player";
    this.aiming = false;
    this.aimDx = 0;
    this.aimDy = 0;
    this.aimPower = 0;
    this.physAcc = 0;
    this.lastSettleShots = 0;
    this.lastShotFired = false;
    this.player = this.spawnPlayer();
    this.targets = this.buildTargets();
  }

  spawnPlayer() {
    return {
      id: "player",
      kind: /** @type {MarbleKind} */ ("player"),
      label: "你",
      color: "#60a5fa",
      highlight: "#dbeafe",
      x: FIELD_W / 2,
      y: FIELD_H - 44,
      vx: 0,
      vy: 0,
      r: PLAYER_R,
      active: true,
    };
  }

  buildTargets() {
    /** @type {Marble[]} */
    const targets = [];
    for (let i = 0; i < TARGET_COUNT; i++) {
      const pal = TARGET_PALETTE[i % TARGET_PALETTE.length];
      const ang = (i / TARGET_COUNT) * Math.PI * 2 + 0.35;
      const dist = RING_R * (0.18 + 0.16 * (i % 3));
      targets.push({
        id: `target-${i}`,
        kind: /** @type {MarbleKind} */ ("target"),
        label: pal.label,
        color: pal.color,
        highlight: pal.highlight,
        x: RING_CX + Math.cos(ang) * dist,
        y: RING_CY + Math.sin(ang) * dist * 0.9,
        vx: 0,
        vy: 0,
        r: TARGET_R,
        active: true,
      });
    }
    return targets;
  }

  start() {
    this.reset();
    this.status = "playing";
    this.message = "輪到你：拖曳彈珠反向拉弓，放開發射";
  }

  getActiveTargets() {
    return this.targets.filter((t) => t.active);
  }

  allStopped(threshold = MIN_SPEED) {
    const marbles = [this.player, ...this.targets];
    for (const m of marbles) {
      if (!m.active) continue;
      if (Math.hypot(m.vx, m.vy) > threshold) return false;
    }
    return true;
  }

  /** @param {number} dx @param {number} dy */
  setAim(dx, dy) {
    if (this.status !== "playing" || !this.allStopped()) return;
    this.aiming = true;
    const maxPull = 90;
    const len = Math.hypot(dx, dy) || 1;
    const scale = Math.min(maxPull, len) / len;
    this.aimDx = dx * scale;
    this.aimDy = dy * scale;
    this.aimPower = Math.min(1, len / maxPull);
  }

  clearAim() {
    this.aiming = false;
    this.aimDx = 0;
    this.aimDy = 0;
    this.aimPower = 0;
  }

  /** @returns {{ events: string[] }} */
  flickPlayer() {
    const events = [];
    if (this.status !== "playing" || !this.allStopped()) return { events };
    if (this.aimPower < 0.08) {
      this.clearAim();
      return { events };
    }
    const pullLen = Math.hypot(this.aimDx, this.aimDy) || 1;
    const ux = -this.aimDx / pullLen;
    const uy = -this.aimDy / pullLen;
    const speed = 180 + this.aimPower * 640;
    this.player.vx = ux * speed;
    this.player.vy = uy * speed;
    this.clearAim();
    this.lastShotFired = true;
    this.message = "彈珠滾動中…";
    events.push("flick");
    return { events };
  }

  /**
   * @param {Marble} a
   * @param {Marble} b
   * @returns {boolean}
   */
  resolveCollision(a, b) {
    if (!a.active || !b.active) return false;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const minDist = a.r + b.r;
    if (dist >= minDist || dist < 0.001) return false;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    a.x -= (nx * overlap) / 2;
    a.y -= (ny * overlap) / 2;
    b.x += (nx * overlap) / 2;
    b.y += (ny * overlap) / 2;

    const dvx = a.vx - b.vx;
    const dvy = a.vy - b.vy;
    const rel = dvx * nx + dvy * ny;
    if (rel > 0) return true;

    const impulse = (-(1 + RESTITUTION) * rel) / 2;
    a.vx += impulse * nx;
    a.vy += impulse * ny;
    b.vx -= impulse * nx;
    b.vy -= impulse * ny;

    const tx = -ny;
    const ty = nx;
    const slip = (a.vx - b.vx) * tx + (a.vy - b.vy) * ty;
    const fImp = -slip * 0.12;
    a.vx += fImp * tx;
    a.vy += fImp * ty;
    b.vx -= fImp * tx;
    b.vy -= fImp * ty;

    return true;
  }

  /** 場外牆（canvas 邊界）反彈。 */
  resolveWall(m) {
    let bounced = false;
    if (m.x - m.r < 0) {
      m.x = m.r;
      if (m.vx < 0) m.vx = -m.vx * WALL_RESTITUTION;
      bounced = true;
    } else if (m.x + m.r > FIELD_W) {
      m.x = FIELD_W - m.r;
      if (m.vx > 0) m.vx = -m.vx * WALL_RESTITUTION;
      bounced = true;
    }
    if (m.y - m.r < 0) {
      m.y = m.r;
      if (m.vy < 0) m.vy = -m.vy * WALL_RESTITUTION;
      bounced = true;
    } else if (m.y + m.r > FIELD_H) {
      m.y = FIELD_H - m.r;
      if (m.vy > 0) m.vy = -m.vy * WALL_RESTITUTION;
      bounced = true;
    }
    return bounced;
  }

  clampSpeed(m) {
    const sp = Math.hypot(m.vx, m.vy);
    if (sp > MAX_SPEED) {
      m.vx = (m.vx / sp) * MAX_SPEED;
      m.vy = (m.vy / sp) * MAX_SPEED;
    }
  }

  /** @param {number} dt @returns {{ events: string[] }} */
  stepPhysics(dt) {
    /** @type {string[]} */
    const events = [];
    const marbles = [this.player, ...this.getActiveTargets()];

    for (const m of marbles) {
      m.vx *= FRICTION;
      m.vy *= FRICTION;
      const sp = Math.hypot(m.vx, m.vy);
      if (sp > 30) {
        m.vx *= ROLL_FRICTION;
        m.vy *= ROLL_FRICTION;
      }
      if (sp < MIN_SPEED) {
        m.vx = 0;
        m.vy = 0;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      this.clampSpeed(m);
    }

    for (let i = 0; i < marbles.length; i++) {
      for (let j = i + 1; j < marbles.length; j++) {
        if (this.resolveCollision(marbles[i], marbles[j])) {
          events.push("hit");
        }
      }
    }

    for (const m of marbles) {
      if (this.resolveWall(m)) events.push("wall");
    }

    return { events };
  }

  /** 結算一發：計算出圈目標與自身圈內懲罰。 */
  settleShot() {
    /** @type {string[]} */
    const events = [];
    let knocked = 0;
    for (const t of this.getActiveTargets()) {
      if (isTargetOut(t.x, t.y, t.r)) {
        t.active = false;
        knocked++;
      }
    }

    this.score += knocked;
    this.targetsCleared += knocked;
    if (knocked > 0) events.push("target");

    const playerInside = isInsideRing(this.player.x, this.player.y, this.player.r);
    if (playerInside) {
      this.score = Math.max(0, this.score - PENALTY);
      this.penalties += 1;
      events.push("penalty");
    }

    this.shots -= 1;
    events.push("settle");

    if (this.targetsCleared >= TARGET_COUNT) {
      this.status = "over";
      this.message = `清圈！共打出 ${this.targetsCleared} 顆目標彈珠`;
      events.push("win");
    } else if (this.shots <= 0) {
      this.status = "over";
      this.message = `彈數用盡，剩 ${TARGET_COUNT - this.targetsCleared} 顆目標在圈內`;
      events.push("lose");
    } else {
      // 下一發：把玩家彈珠放回圈外起點，目標留在原處
      this.player = this.spawnPlayer();
      this.player.vx = 0;
      this.player.vy = 0;
      this.message = "新的彈珠就位，輪到你彈射";
      events.push("turn");
    }
    return { events };
  }

  /** @param {number} dt @returns {{ events: string[] }} */
  update(dt) {
    /** @type {string[]} */
    const events = [];
    if (this.status !== "playing") return { events };

    this.physAcc += dt;
    while (this.physAcc >= FIXED_DT) {
      events.push(...this.stepPhysics(FIXED_DT).events);
      this.physAcc -= FIXED_DT;
    }

    if (this.allStopped() && this.lastShotFired) {
      this.lastShotFired = false;
      events.push(...this.settleShot().events);
    }
    return { events };
  }
}