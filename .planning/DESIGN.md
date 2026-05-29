# Prism Learning — Design System

## Brand Accent Colour

The primary brand accent is **Orchid** — a soft purple derived from `#aa75dd`.

| Token | Hex | Usage |
|-------|-----|-------|
| `--ember-400` / `--color-ember-400` | `#aa75dd` | Main accent (buttons, links, highlights) |
| `--ember-500` / `--color-ember-500` | `#8c43d0` | Deeper accent (gradients, hover states) |
| `--ember-600` / `--color-ember-600` | `#6d2bab` | Dark accent (pressed states, shadows) |
| `--ember-300` / `--color-ember-300` | `#c5a1e8` | Light accent (tints, glows) |
| `--ember-200` | `#decaf2` | Very light tint |
| `--ember-100` | `#f0eafd` | Barely-there background wash |

> **Note:** The CSS variable names retain the `--ember-*` prefix for backwards compatibility. Values map to the orchid/purple palette.

## Full Orchid Scale

Derived from `#aa75dd` (HSL 271°, 60%, 66%):

| Stop | Hex | Lightness |
|------|-----|-----------|
| 50   | `#f8f5fe` | 97% |
| 100  | `#f0eafd` | 94% |
| 200  | `#decaf2` | 87% |
| 300  | `#c5a1e8` | 77% |
| 400  | `#b689e1` | 71% |
| **500 (base)** | **`#aa75dd`** | **66%** |
| 600  | `#8c43d0` | 54% |
| 700  | `#6d2bab` | 43% |
| 800  | `#4e1f7a` | 32% |
| 900  | `#341452` | 21% |
| 950  | `#1f0c31` | 12% |

## Semantic Colours (unchanged)

| Token | Hex | Usage |
|-------|-----|-------|
| `--semantic-success` | `#22c55e` | Success indicators |
| `--semantic-danger` | `#ef4444` | Error / wrong-answer feedback |
| `--semantic-warning` | `#eab308` | Warning states |
| `--semantic-info` | `#3b82f6` | Info / primary action tint |

Semantic colours (correct/incorrect quiz feedback) remain green/red per UX convention and are not affected by the accent change.

## Dark Surface Palette (unchanged)

Obsidian scale (`--obsidian-950` → `--obsidian-50`) provides the dark backgrounds, borders, and text hierarchy. No changes required.

## Typography

- **Display / Headings:** Necto Mono (locally sourced), fallback JetBrains Mono
- **UI / Body:** JetBrains Mono — maintains the technical, precision-focused brand voice

## Theme Tokens (per-workspace)

Each workspace can override the following via the theme editor:

| Key | Default | Description |
|-----|---------|-------------|
| `primary` | `#4f46e5` | Indigo — progress bars, active states |
| `accent` | `#aa75dd` | Orchid — CTA buttons, links, highlights |
| `correct` | `#16a34a` | Semantic green — correct quiz answers |
| `incorrect` | `#dc2626` | Semantic red — wrong quiz answers |
| `headingFont` | Inter | Workspace heading typeface |
| `bodyFont` | Inter | Workspace body typeface |

## RGBA Quick Reference

For overlays and glows using the orchid accent:

```css
rgba(170, 117, 221, 0.08)  /* ember-400 @ 8%  — subtle bg tint  */
rgba(170, 117, 221, 0.12)  /* ember-400 @ 12% — bg wash          */
rgba(170, 117, 221, 0.20)  /* ember-400 @ 20% — border / ring    */
rgba(140,  67, 208, 0.06)  /* ember-500 @ 6%  — shadow glow      */
rgba(140,  67, 208, 0.25)  /* ember-500 @ 25% — focus ring       */
rgba(140,  67, 208, 0.28)  /* ember-500 @ 28% — hover shadow     */
```
