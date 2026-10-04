import { animate, stagger, svg } from "animejs";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

type Cancel = () => void;

const LOAD_IN_BUDGET_MS = 600;
const LOAD_IN_DURATION_MS = 250;

// Rows slide in 8px and fade, underlines draw; total stays within the 600ms budget.
export function playLoadIn(
  rows: HTMLElement[],
  underlines: SVGPathElement[],
): Cancel {
  if (rows.length === 0 || prefersReducedMotion()) return () => {};

  const step = Math.min(
    40,
    (LOAD_IN_BUDGET_MS - LOAD_IN_DURATION_MS) / Math.max(rows.length - 1, 1),
  );
  const drawables = underlines.flatMap((path) => svg.createDrawable(path));
  for (const row of rows) row.style.opacity = "0";
  for (const drawable of drawables) drawable.draw = "0 0";

  const rowsAnim = animate(rows, {
    opacity: [0, 1],
    y: [8, 0],
    duration: LOAD_IN_DURATION_MS,
    ease: "outExpo",
    delay: stagger(step),
  });
  const linesAnim = animate(drawables, {
    draw: ["0 0", "0 1"],
    duration: 300,
    ease: "outExpo",
    delay: stagger(step, { start: 120 }),
  });

  return () => {
    rowsAnim.revert();
    linesAnim.revert();
  };
}

// Stamp thunks down onto the page when the status changes.
export function playStatusChange(stamp: HTMLElement, row: HTMLElement): Cancel {
  if (prefersReducedMotion()) {
    row.classList.remove("is-flash");
    // Restart the CSS highlight: a brief color change instead of motion.
    void row.offsetWidth;
    row.classList.add("is-flash");
    const clear = () => row.classList.remove("is-flash");
    row.addEventListener("animationend", clear, { once: true });
    return () => {
      row.removeEventListener("animationend", clear);
      clear();
    };
  }

  const anim = animate(stamp, {
    scale: [1.5, 1],
    opacity: [0, 1],
    duration: 220,
    ease: "outExpo",
  });
  return () => anim.revert();
}
