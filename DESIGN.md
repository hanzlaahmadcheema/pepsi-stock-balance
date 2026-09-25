# Design System: Pepsi Stock Balance

The single source of truth for building screens that look and behave like a **classic printed depot ledger**. This is a working, high-frequency operational tool used by cashiers, warehouse staff, and owners — many of them older, first-time computer users, or working in bright sunlight and dusty warehouse light. Optimising for "modern SaaS polish" is an explicit failure. Optimising for **legibility, obviousness, and forgiveness** is the goal.

---

## 1. Visual Theme & Atmosphere

* **Atmosphere:** A printed stock ledger and depot issue register, rendered on screen. Warm paper, black ink, stamped notices, ruled columns, visible edges. It should look *maintained by hand* and *impossible to misread*.
* **Density Index:** `7 / 10`. Ledger tables are dense, but every control is generously sized. Density never comes at the cost of a missed tap.
* **Variance Index:** `2 / 10`. Predictable structure, strict column alignment, one panel style used everywhere. The layout must be learnable in one sitting.
* **Motion Index:** `2 / 10`. Functional only. A button changes colour when pressed. Nothing slides, bounces, or pulses for decoration.
* **Reference feel:** Indian/Pakistani government and wholesale trade ledgers, printed invoices, rubber stamps, carbon-copy receipt books.

---

## 2. Colour Palette & Roles

Warm paper neutrals, black-brown ink, one Pepsi navy for action, one stamp red for danger. Cool slate/blue-grey "SaaS" greys are banned — the paper is warm.

### Neutrals (semantic tokens, defined in `src/app/globals.css`)
| Token | Light | Role |
| --- | --- | --- |
| `--paper` | `#f4f0e4` | Application canvas — ledger paper |
| `--surface` | `#ffffff` | Cards, tables, forms, modal panels |
| `--surface-alt` | `#faf7ef` | Table headers, quiet panels, alternating rows |
| `--ink` | `#1c1a16` | Primary text, headings, key figures |
| `--ink-2` | `#45402f` | Secondary text, supporting copy |
| `--ink-3` | `#67604f` | Labels, helper text (5.7:1 on white — verified) |
| `--rule` | `#c8bda3` | Table gridlines, row dividers |
| `--rule-strong` | `#8a8270` | Panel edges, input and button edges (4.2:1) |

### Core brand accent — Pepsi Navy
* **`--navy` `#0b4a8b`** — primary buttons, active nav, focus rings, selected states.
* **`--navy-deep` `#072c55`** — primary button hover and pressed edge.
* **`--navy-wash` `#e8f0fa`** — selected table row, active line item, info highlight.

### Functional status (word + colour, never colour alone)
* **`--stamp` `#b32218` / `--stamp-wash` `#fbe9e7`** — destructive actions, overdue, validation errors.
* **`--good` `#15653a` / `--good-wash` `#e7f2eb`** — paid, active, in stock, balanced.
* **`--warn` `#8a5200` / `--warn-wash` `#fbf0dc`** — pending, low stock, unclosed day, credit due.
* **`--info-wash` `#e8f0fa`** — neutral information.

**Dark theme ("night depot")** is opt-in only. It is defined in `.dark` and is a genuine re-mapping of every token, not an opacity filter. Light remains the default because that is the depot reality.

### Banned
* Cool slate/blue-grey neutrals (`#0F172A`, `#334155`, `#64748B`, `#F8FAFC` family) — these are the previous system.
* Purple, neon, gradients on buttons, glassmorphism, `backdrop-blur` on modals.
* Pure `#000000` body text on screen (banned; use `--ink`).

---

## 3. Typography

* **UI / body / form text: `Atkinson Hyperlegible`.** Chosen because it is designed for low-vision readability: unusually wide apertures, tall x-height, thick strokes, disambiguated characters. Fallback: `system-ui, sans-serif`.
* **Figures: `Geist Mono`** with `font-variant-numeric: tabular-nums` (`.num`). Mandatory for every currency amount, crate/bottle count, quantity, price, SKU, invoice number, and timestamp — so columns never jitter while a cashier types.
* **Root size is operator-controlled** via `--font-app-scale`:
  * `medium` = `16px`, `large` = `18px` (**default**), `largest` = `20px`.
  * Stored in `localStorage` under `pepsi_text_size`, applied by a blocking inline script in `src/app/layout.tsx` to avoid a flash.
* **Absolute floor: no visible text below 15px.** The Tailwind scale is remapped so the smallest step, `--text-xs`, is `0.9375rem` (15px at the default root). `text-[0.8125rem]`-style literals are prohibited in new code.
* **Hierarchy:** weight and ink colour carry hierarchy before size does. Page titles `2xl`–`3xl` `font-black`; section titles `lg`–`xl` `font-bold`; body `base`–`sm`; labels `sm` `font-bold`.
* **Banned:** `Inter`; all serif faces; thin weights (`font-thin`, `font-extralignt`, `font-extralight`); `text-ellipsis` / `truncate` on anything a human must read (product names, customer names, SKUs) — wrap with `break-words` instead.

---

## 4. Component Stylings

Every component is a CSS primitive in `src/app/globals.css`. **Use the primitive; do not hand-roll a Tailwind approximation.** Reusable display pieces live in `src/components/ui/classic.tsx`.

### Buttons — `.btn`
* Minimum height `3rem` (48px). `.btn-lg` is larger; `.btn-sm` is **still ≥ 44px** — there is no small tap target.
* `2px solid var(--rule-strong)` border, `border-radius: 6px`, and a flat `box-shadow: 0 2px 0 0 var(--rule)` so the button reads as a solid physical key.
* Font weight 700, size `1.0625rem` (17px).
* Variants: `.btn-primary` (navy fill, white text), `.btn` (paper fill), `.btn-danger` (stamp outline), `.btn-warn`, `.btn-good`. Disabled: muted fill, no shadow, `cursor: not-allowed`.
* **No** transform-on-press scale animations, no glow, no shadow bloom.

### Panels — `.panel`, `.panel-head`, `.panel-body`
* `2px solid var(--rule)` border, white surface, `border-radius: 8px`.
* `.panel-head`: `--surface-alt` background, `2px` bottom rule, bold title plus optional count/subtitle on the right.
* Every logical block of content sits in exactly one panel. Nesting panels inside panels is discouraged.

### Fields — `.field`
* Minimum height `3rem` (48px), `2px` solid border, `border-radius: 6px`, `1.0625rem` text.
* **Permanent top-aligned label on every field**, always visible. Placeholder-only labelling is a defect, not a style choice.
* Focus: `2px` `--navy` ring at zero offset. Error: `.field-error` (stamp border) plus `.field-error-text` beneath.
* Controls must be associated with their label via `htmlFor`/`id` **or** an explicit `aria-label`. An unlabelled input is a release blocker.

### Ledger tables — `.ledger`, `.ledger-head`, `.ledger-row`
* `.ledger` for real `<table>` markup. `.ledger-head` / `.ledger-row` are grid-based equivalents for div tables (POS catalog, ticket lines) and must be used together.
* Header row: `--surface-alt`, uppercase, `0.9375rem`, `0.05em` tracking, `2px` bottom rule, `white-space: nowrap`.
* Rows: `1px` bottom rule, alternating `--surface-alt` tint, hover `--navy-wash`.
* `.ledger-row-active`: `--navy-wash` fill with a `3px` inset navy left edge — the "already in the ticket" marker.
* Text and names left-aligned; **all quantities, prices, discounts, and totals right-aligned** in `.num`.

### Badges — `.badge`, `.badge-good|warn|bad|info|neutral`
* Muted wash background, 1px matching border, dark readable text, `border-radius: 4px`. Inline only.
* **Always contain a word.** `42 crates`, `Low`, `Out of stock`, `Unpaid`. Never a bare coloured dot for a state a user must act on.

### Notices — `.notice`, `.notice-warn`, `.notice-bad`
* `2px` border, 8px radius, `1.0625rem` semibold text. Used for unclosed previous business day, validation errors, credit warnings.
* Actionable notices carry a real `.btn` on the right, not a text link.

### Links — `.link`, `.link-btn`
* `.link` for inline text links.
* `.link-btn` for links that act like a control ("← Back to Sales", "Switch to Walk-in", "All Shortcuts [?]") — it reserves a 44px hit area so it is not a precision tap.

### Modals
* Scrim `rgba(28,26,22,0.6)`, **no blur filter**. Container white, `2px solid var(--rule-strong)`, `--shadow-pop`, `8px` radius.
* `role="dialog"` + `aria-modal="true"` + an `aria-label` that names the action, not just "Close".
* Header `2px` bottom rule, footer `2px` top rule, destructive action clearly separated.

### Empty states
* `src/components/ui/classic.tsx` → `EmptyState`. Icon in `--ink-3`, one plain sentence, one obvious `.btn` that fixes the problem ("Clear Search and Brand Filter"). Never "No results." alone.

---

## 5. Layout & Navigation

* **Shell:** `src/components/app-header.tsx`. Expanded left sidebar on desktop — never icon-only. On mobile an "All Screens" drawer plus a persistent bottom navigation bar.
* **Max width** `1720px`, gutters `px-4 sm:px-6 lg:px-8`.
* **Page structure:** optional `.link-btn` back link → `h1` → one-line plain-language purpose → notices → action panels.
* **Summary figures:** `StatCard` in a responsive grid; `FigureBox` for boxed ledger figures. Never a row of three equal marketing cards.
* **Sticky context:** the POS ticket column is `sticky` on desktop so the running total never scrolls away.
* **No overlapping or absolutely-positioned layout stacking.** Every block owns its box.
* **Zero horizontal page overflow** on any viewport. Wide tables go in an isolated `overflow-x-auto` container (`ScrollableTable`); the page itself must never scroll sideways.
* **Long content wraps, never truncates.** Product names, customer names, and SKUs must be fully readable.

---

## 6. Roles & Modes (never break these)

* **Owner** — full access, including stock edits, users, suppliers, reports.
* **Staff** — day-to-day operations; destructive and administrative actions are hidden, not merely disabled.
* **Cloud portal** — read-only. Mutating controls are not rendered at all.

---

## 7. Motion, Print & Accessibility

* Transitions `120ms–150ms ease-out` on `background-color`, `border-color`, `color` only. No `width`/`height`/`margin` animation.
* `prefers-reduced-motion: reduce` disables all non-essential motion.
* **Print** (`@media print`): 80mm thermal receipt path is preserved in full — `html` forced to `12px`, page fixed to `80mm`, app chrome hidden, `.pos-receipt-80mm` forced to monospace `10.5px` with wrapping (never truncated) product names. Do not regress this block when restyling.
* **Verified baselines** (audited with Playwright against `/`, `/products`, `/customers`, `/sales/new`):
  * Root font size 18px; **no visible text below 15px**.
  * **Zero WCAG AA contrast failures** (4.5:1 body, 3:1 large) on all four routes.
  * **Zero unnamed controls**, zero clipped text, zero page-level horizontal overflow.
  * **Every interactive target ≥ 44×44px** (`.btn-sm` included).
* `sr-only` content is intentional and exempt from the clipping/target checks — do not "fix" the skip link.

---

## 8. Anti-Patterns & Banned Clichés

1. **No emojis.** SVG icons only.
2. **No cool slate/blue-grey neutrals** — the previous system; warm paper only.
3. **No `Inter`.** Use Atkinson Hyperlegible.
4. **No serifs** anywhere.
5. **No placeholders as labels.** Every field has a permanent label.
6. **No truncated human-readable text.** Wrap it.
7. **No tap target under 44px**, including links that behave like buttons.
8. **No status conveyed by colour alone** — badge text always says the state.
9. **No soft-SaaS styling:** no pill buttons, no soft shadows, no gradient CTAs, no glass, no blur backdrops, no decorative motion.
10. **No AI copywriting:** *"Seamless"*, *"Elevate"*, *"Unleash"*, *"Next-Gen"*, *"Empower"*, *"Streamline"* are banned. Write what the operator does: *"Record Receiving"*, *"Post Damaged Stock"*, *"Finalize Daily Closing"*, *"Enter Amount Received"*.
11. **No fake or rounded-up metrics.** Figures must be real balances.
12. **No filler scroll prompts.**
13. **No invented "Walk-in Customer" database record** — the walk-in case is a sentinel option, never a row.
14. **No broken brand assets** — every brand mark has a fallback with brand initials.

---

## 9. Verification Loop

Because screenshots are not always reviewable in this environment, layout and accessibility are proven **numerically**:

* `/tmp/opencode/audit.mjs` — root font size, text under 15px, clipped text, unnamed controls, sub-44px targets, horizontal overflow, HTTP status, and font/height samples.
* `/tmp/opencode/contrast.mjs` — computes real effective foreground/background pairs (walking ancestors and compositing alpha) and reports WCAG AA failures. Validated against injected known-bad samples so a `0` result is trustworthy.

Run both after any screen change, then `npx tsc --noEmit` and `npx next build`.
