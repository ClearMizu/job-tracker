import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { animate, revert, createDrawable } = vi.hoisted(() => {
  const revert = vi.fn();
  return {
    revert,
    animate: vi.fn(() => ({ revert })),
    createDrawable: vi.fn((path: unknown) => [{ path, draw: "" }]),
  };
});

vi.mock("animejs", () => ({
  animate,
  stagger: vi.fn((step: number) => step),
  svg: { createDrawable },
}));

import { playLoadIn, playStatusChange } from "./motion";

function setReducedMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
}

const el = () => document.createElement("li");

beforeEach(() => {
  animate.mockClear();
  revert.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("playStatusChange", () => {
  test("stamps with a short transform animation and reverts on cleanup", () => {
    setReducedMotion(false);
    const stamp = el();
    const cancel = playStatusChange(stamp, el());

    expect(animate).toHaveBeenCalledTimes(1);
    const [target, params] = animate.mock.calls[0] as unknown as [
      HTMLElement,
      { duration: number; scale: number[] },
    ];
    expect(target).toBe(stamp);
    expect(params.duration).toBeLessThanOrEqual(350);
    expect(params.scale).toEqual([1.5, 1]);

    cancel();
    expect(revert).toHaveBeenCalled();
  });

  test("with reduced motion it swaps instantly and only highlights", () => {
    setReducedMotion(true);
    const row = el();
    const cancel = playStatusChange(el(), row);

    expect(animate).not.toHaveBeenCalled();
    expect(row.classList.contains("is-flash")).toBe(true);
    cancel();
    expect(row.classList.contains("is-flash")).toBe(false);
  });
});

describe("playLoadIn", () => {
  test("staggers rows within the 600ms budget", () => {
    setReducedMotion(false);
    const rows = Array.from({ length: 20 }, el);
    const lines = Array.from({ length: 20 }, () =>
      document.createElementNS("http://www.w3.org/2000/svg", "path"),
    );
    playLoadIn(rows, lines);

    const [, params] = animate.mock.calls[0] as unknown as [
      unknown,
      { duration: number; delay: number },
    ];
    expect(
      params.duration + params.delay * (rows.length - 1),
    ).toBeLessThanOrEqual(600);
    expect(rows.every((row) => row.style.opacity === "0")).toBe(true);
  });

  test("does nothing with reduced motion", () => {
    setReducedMotion(true);
    const rows = [el()];
    playLoadIn(rows, []);

    expect(animate).not.toHaveBeenCalled();
    expect(rows[0]?.style.opacity).toBe("");
  });
});
