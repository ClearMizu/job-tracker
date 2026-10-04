# DESIGN.md: Visual identity

> This file is the source of truth for all UI. Copilot must read it before touching any UI.
> Edit the choices below to make them yours. The more specific, the less generic the result.

## 1. Concept (pick ONE and delete the others)

**A. "Dispatch board"**: a train-station departure board. Applications are rows; statuses flip like split-flap digits.
**B. "Field notebook"**: warm paper, ink stamps for statuses, hand-drawn SVG underlines that draw themselves in.
**C. "Mission control"**: dark, dense, monospace; the pipeline is a living SVG path with pulses along it.

Chosen concept: **A. Dispatch board**   <- change me

## 2. Palette (hex values; these become CSS variables)

| Token | Hex | Use |
|---|---|---|
| --bg | #14110F | page background (warm near-black) |
| --surface | #1E1A17 | rows/panels |
| --ink | #F2E8D5 | primary text |
| --ink-dim | #A89D8A | secondary text |
| --accent | #F2B134 | amber signal: focus, active, CTA |
| --ok | #6FBF73 | offer / success |
| --warn | #E8743B | interview / attention |
| --bad | #C8553D | rejected |
| --line | #3A332C | borders/dividers |

Rule: accent is used sparingly (<10% of screen). No gradients. No pure black or pure white.

## 3. Typography

- Display / board digits: a condensed mono or slab (e.g. "IBM Plex Mono", "Space Mono", or "JetBrains Mono")
- Body: a humanist sans (e.g. "IBM Plex Sans")
- Scale: 12 / 14 / 16 / 20 / 28 / 44 px. Uppercase + letter-spacing 0.08em for column labels.

## 4. Layout and shape

- Dense, table-like rows, not floating cards. 1px borders, radius 2px max.
- 8px spacing grid. Wide left column for company/role; fixed-width status column.
- Signature element: the flip-board status cell.

## 5. Motion personality (anime.js)

- Snappy, mechanical, weighted. Durations 120-350ms. Easing: stepped or `outExpo`.
- Status change: characters flip with a short stagger (20-30ms each).
- New row: slides in 8px and fades; others shift via transform.
- Page load: rows stagger in once, max 600ms total.
- Reduced motion: replace flips with an instant swap and a brief color highlight.

## 6. Voice

Short, plain, a bit wry. "No replies yet." not "You haven't received any responses!"

## 7. Never

Purple/blue gradients, stock rounded-card grids, emoji icons, drop shadows for depth, centered hero sections.
