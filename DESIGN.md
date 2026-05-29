# DESIGN.md — Daily Tracker Design System

## Direction

Tech / utility — inspired by Datadog, GitHub, Cloudflare. Dense, monospace-friendly, system sans, hairline borders, green accent.

## Color Tokens

### Light Mode (default)

| Token       | Value                  | Usage                        |
| ----------- | ---------------------- | ---------------------------- |
| `--bg`      | `oklch(98% 0.005 250)` | Page background              |
| `--surface` | `oklch(100% 0 0)`      | Cards, inputs, header        |
| `--fg`      | `oklch(22% 0.02 240)`  | Primary text                 |
| `--muted`   | `oklch(50% 0.018 240)` | Secondary text, labels       |
| `--border`  | `oklch(90% 0.008 240)` | Borders, dividers            |
| `--accent`  | `oklch(58% 0.16 145)`  | Primary action, active state |
| `--danger`  | `oklch(55% 0.18 25)`   | Error, destructive actions   |
| `--warn`    | `oklch(65% 0.16 85)`   | Warning states               |

### Dark Mode (`[data-theme="dark"]`)

| Token       | Value                  |
| ----------- | ---------------------- |
| `--bg`      | `oklch(14% 0.01 250)`  |
| `--surface` | `oklch(20% 0.012 250)` |
| `--fg`      | `oklch(92% 0.005 250)` |
| `--muted`   | `oklch(60% 0.012 250)` |
| `--border`  | `oklch(28% 0.012 250)` |

## Typography

| Token         | Stack                                                                           | Usage           |
| ------------- | ------------------------------------------------------------------------------- | --------------- |
| `--font-body` | `-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif` | All UI text     |
| `--font-mono` | `'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace`             | Time, data, IDs |

### Type Scale

| Element         | Size        | Weight | Extras                               |
| --------------- | ----------- | ------ | ------------------------------------ |
| Page title (h1) | `1.5rem`    | 700    | `letter-spacing: -0.02em`            |
| Section title   | `1.125rem`  | 600    | `letter-spacing: -0.01em`            |
| Body            | `0.9375rem` | 400    | —                                    |
| Label           | `0.8125rem` | 500    | Uppercase, `letter-spacing: 0.04em`  |
| Caption/pill    | `0.6875rem` | 500    | —                                    |
| Mono data       | `0.75rem`   | 400    | `font-variant-numeric: tabular-nums` |

## Spacing & Layout

- **Border radius:** `10px` (`--radius`)
- **Page padding:** `24px` mobile → `48px` tablet
- **Content padding:** `20px` mobile → `24px 32px` tablet
- **Form group gap:** `16px`
- **Card padding:** `14px 16px`
- **Card gap (stacked):** `10px`
- **Max content width:** `480px` centered on desktop (≥1024px)

## Breakpoints

| Name    | Min-width | Behavior                         |
| ------- | --------- | -------------------------------- |
| Mobile  | default   | Full-width, compact padding      |
| Tablet  | `600px`   | Increased padding (32px)         |
| Desktop | `1024px`  | Centered container, side borders |

## Components

### Buttons

- **Primary:** Full-width, `--accent` bg, white text, `12px` padding, `0.9375rem` font, 600 weight. Hover: `opacity 0.9`.
- **Google auth:** `--surface` bg, `1px solid --border`, flex row with icon + text. Hover: border → accent.
- **Icon button:** `36px` square, `8px` radius, grid center. Hover: `--border` bg.

### Inputs

- `1px solid --border`, `--radius` corners, `10px 14px` padding
- Focus: `border-color: --accent`
- Textarea: `min-height: 80px`, vertical resize

### Tabs

- Horizontal row, `--surface` bg, bottom border
- Tab button: `12px 16px` padding, `0.875rem`, 500 weight
- Active: `--accent` color + 2px bottom border
- Hover: `--fg` color

### Cards (Reminder)

- `--surface` bg, `1px solid --border`, `--radius` corners
- Flex row: time (mono, accent) + body content
- Category pill: `--accent` at 12% opacity bg, accent text, `20px` radius

### Toast

- Fixed bottom-center, `--fg` bg, `--bg` text
- Slide-up animation via transform + opacity
- Auto-dismiss after 2.5s

## Interaction Patterns

- **Theme toggle:** Persisted to `localStorage('tracker-theme')`. Sun/moon icon swap.
- **Auth state:** Persisted to `localStorage('tracker-auth')`. Screen swap (login ↔ app).
- **Tab navigation:** JS-driven class toggle (`.active`), no page reload.
- **Form validation:** Required title field, focus on empty submit.
- **Toast feedback:** Confirms successful actions.

## Anti-patterns (do NOT use)

- Purple/violet gradients
- Warm beige/cream/peach backgrounds
- Emoji as icons
- Rounded cards with left color border
- Inter/Roboto as display face
- Shadows on cards (use borders only)
- Multiple competing accent colors
