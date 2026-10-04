# DESIGN.md: Visual identity

> This file is the source of truth for all UI. Copilot must read it before touching any UI.
> Edit the choices below to make them yours. The more specific, the less generic the result.

## 1. Concept

**"Field notebook"**: warm ink on dark paper, ink stamps for statuses, hand-drawn SVG underlines that draw themselves in. Rows are ruled lines, not cards.

(Rejected: "Dispatch board" flip-board, "Mission control" pipeline view.)

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

- Display / stamp lettering: a condensed mono or slab (e.g. "IBM Plex Mono", "Space Mono", or "JetBrains Mono")
- Body: a humanist sans (e.g. "IBM Plex Sans")
- Scale: 12 / 14 / 16 / 20 / 28 / 44 px. Uppercase + letter-spacing 0.08em for column labels.

## 4. Layout and shape

- Dense, table-like rows, not floating cards. 1px borders, radius 2px max.
- 8px spacing grid. Wide left column for company/role; fixed-width status column.
- Signature element: the ink-stamp status cell (bordered, uppercase mono, tilted -2deg, colored by status).

## 5. Motion personality (anime.js)

- Weighted and mechanical, like a rubber stamp. Durations 120-350ms. Easing: `outExpo`.
- Status change ("stamp thunk"): the stamp scales from 1.5 to 1 while fading in, 220ms, `outExpo`. Only `scale` and `opacity`; the tilt is the CSS `rotate` property so it is never overwritten.
- Page load: rows slide in 8px and fade (250ms, `outExpo`) with a stagger of at most 40ms per row, and each hand-drawn underline draws in (300ms, `outExpo`, starting 120ms after its row). The whole sequence plays once and stays within 600ms.
- Reduced motion: no anime.js animation runs. A status change swaps instantly and the row gets a brief background highlight (350ms, stepped). Load-in is skipped.

## 6. Voice

Short, plain, a bit wry. "No replies yet." not "You haven't received any responses!"

## 7. Never

Purple/blue gradients, stock rounded-card grids, emoji icons, drop shadows for depth, centered hero sections.
