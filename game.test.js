import { describe, expect, it } from "vitest";
import {
  MarbleCirGame,
  RING_CX,
  RING_CY,
  RING_R,
  TARGET_COUNT,
  SHOTS,
  isInsideRing,
  isTargetOut,
} from "./game.js";

describe("isInsideRing / isTargetOut", () => {
  it("center of ring is inside", () => {
    expect(isInsideRing(RING_CX, RING_CY)).toBe(true);
  });

  it("far outside is not inside", () => {
    expect(isInsideRing(RING_CX + RING_R + 50, RING_CY)).toBe(false);
  });

  it("target just beyond rim counts as out", () => {
    expect(isTargetOut(RING_CX + RING_R + 1, RING_CY)).toBe(true);
  });

  it("target inside ring is not out", () => {
    expect(isTargetOut(RING_CX, RING_CY)).toBe(false);
  });
});

describe("MarbleCirGame setup", () => {
  it("spawns TARGET_COUNT targets inside the ring", () => {
    const g = new MarbleCirGame();
    expect(g.getActiveTargets()).toHaveLength(TARGET_COUNT);
    for (const t of g.getActiveTargets()) {
      expect(isTargetOut(t.x, t.y, t.r)).toBe(false);
    }
  });

  it("starts with SHOTS shots and zero score", () => {
    const g = new MarbleCirGame();
    g.start();
    expect(g.shots).toBe(SHOTS);
    expect(g.score).toBe(0);
    expect(g.status).toBe("playing");
  });
});

describe("MarbleCirGame scoring", () => {
  it("settleShot removes out targets and awards points", () => {
    const g = new MarbleCirGame();
    g.status = "playing";
    // Knock three targets out
    for (let i = 0; i < 3; i++) {
      g.getActiveTargets()[i].x = RING_CX + RING_R + 20;
      g.getActiveTargets()[i].y = RING_CY;
    }
    g.player.x = RING_CX;
    g.player.y = RING_CY + RING_R + 30; // outside ring, no penalty
    const { events } = g.settleShot();
    expect(events).toContain("target");
    expect(g.score).toBe(3);
    expect(g.targetsCleared).toBe(3);
    expect(g.getActiveTargets()).toHaveLength(TARGET_COUNT - 3);
    expect(g.shots).toBe(SHOTS - 1);
  });

  it("player left inside ring is penalized", () => {
    const g = new MarbleCirGame();
    g.status = "playing";
    g.player.x = RING_CX;
    g.player.y = RING_CY; // inside ring
    const { events } = g.settleShot();
    expect(events).toContain("penalty");
    expect(g.penalties).toBe(1);
    expect(g.score).toBe(0); // no targets out, so 0 - 1 clamped to 0
  });

  it("clearing all targets wins", () => {
    const g = new MarbleCirGame();
    g.status = "playing";
    for (const t of g.getActiveTargets()) {
      t.x = RING_CX + RING_R + 20;
      t.y = RING_CY;
    }
    g.player.x = RING_CX;
    g.player.y = RING_CY + RING_R + 30;
    const { events } = g.settleShot();
    expect(events).toContain("win");
    expect(g.status).toBe("over");
    expect(g.targetsCleared).toBe(TARGET_COUNT);
  });

  it("running out of shots ends the game", () => {
    const g = new MarbleCirGame();
    g.status = "playing";
    g.shots = 1;
    g.player.x = RING_CX;
    g.player.y = RING_CY + RING_R + 30;
    const { events } = g.settleShot();
    expect(events).toContain("lose");
    expect(g.status).toBe("over");
  });
});

describe("MarbleCirGame physics", () => {
  it("collision separates overlapping marbles", () => {
    const g = new MarbleCirGame();
    const a = g.player;
    const b = g.getActiveTargets()[0];
    a.x = RING_CX;
    a.y = RING_CY;
    b.x = RING_CX + 2;
    b.y = RING_CY;
    const before = Math.hypot(a.x - b.x, a.y - b.y);
    g.resolveCollision(a, b);
    const after = Math.hypot(a.x - b.x, a.y - b.y);
    expect(after).toBeGreaterThan(before);
  });

  it("wall resolve keeps marble inside field", () => {
    const g = new MarbleCirGame();
    g.player.x = -5;
    g.player.y = 100;
    g.player.vx = -10;
    g.resolveWall(g.player);
    expect(g.player.x).toBeGreaterThanOrEqual(g.player.r);
  });

  it("flick requires minimum power", () => {
    const g = new MarbleCirGame();
    g.start();
    g.setAim(1, 0);
    g.aimPower = 0.01;
    const { events } = g.flickPlayer();
    expect(events).not.toContain("flick");
  });

  it("flick launches the player marble", () => {
    const g = new MarbleCirGame();
    g.start();
    g.setAim(0, 40); // pull down 40px
    const { events } = g.flickPlayer();
    expect(events).toContain("flick");
    expect(g.player.vy).toBeLessThan(0); // launched upward
    expect(Math.hypot(g.player.vx, g.player.vy)).toBeGreaterThan(100);
  });
});