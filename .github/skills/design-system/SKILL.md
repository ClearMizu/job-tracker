---
name: design-system
description: Build or change any React UI, component, page, layout, styling, or animation. Use for anything visual so it follows the project's identity in docs/DESIGN.md instead of generic AI styling.
---

# Design system workflow

1. Read `docs/DESIGN.md` fully before writing any UI code.
2. Put all colors, fonts, spacing, radii, and durations in `apps/web/src/styles/tokens.css` as CSS variables, taken from DESIGN.md. Components use only these variables. Never hardcode a new color.
3. Avoid generic AI patterns: purple/blue gradients, uniform rounded cards with soft shadows, centered hero with two buttons, emoji icons, glassmorphism by default.
4. Layout should follow the concept in DESIGN.md (its grid, density, and signature element), not a default dashboard template.
5. Animation uses anime.js. Check the installed version's docs first (v4 uses named imports such as `animate`, `stagger`, `createTimeline`).
   - Start animations in `useLayoutEffect`/`useEffect`; always clean up (pause/revert) on unmount.
   - Animate `transform` and `opacity`, not layout properties.
   - Honor `prefers-reduced-motion`: skip or drastically shorten motion.
   - Motion must communicate something (status change, new item, focus). No decorative loops.
6. Accessibility: visible focus states, keyboard operable, contrast at WCAG AA or better, semantic HTML, labels on inputs.
7. Responsive: works at 360px wide and on desktop.
8. Add or update a Testing Library test for every interactive component.
