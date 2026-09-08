# Design System: Pepsi Stock Balance

A semantic design specification and visual directives document engineered for Google Stitch screen generation. This file acts as the single source of truth for generating screens, components, and workflows that reflect classic, modern, and professional business software for warehouse operations and retail distribution.

---

## 1. Visual Theme & Atmosphere

* **Atmosphere:** Classic, authoritative, utilitarian enterprise software. It evokes the crisp precision of an industrial balance sheet combined with the tactile usability of a well-organized logistics terminal. It is clean, dependable, and immediately legible to cashiers, warehouse supervisors, and business owners alike.
* **Density Index:** `8 / 10` (Cockpit Dense). Prioritizes high information density, tabular legibility, rapid data entry, and compact visual grouping over wasteful marketing whitespace.
* **Variance Index:** `3 / 10` (Predictable Structural Grid). Strict visual rhythm, consistent column alignments, standard 8px grid modularity, and predictable navigation hierarchies. Asymmetry is restrained to dashboard analytical summaries.
* **Motion Index:** `4 / 10` (Snappy Tactile Utilities). Restrained, purpose-driven UI transitions (150ms–200ms) that provide instant physical feedback during high-frequency barcode scanning, invoice line entry, and modal confirmations. No decorative or lingering animations.

---

## 2. Color Palette & Roles

The palette is built on high-contrast slate neutrals anchored by an authoritative, industrial beverage-blue accent. Fluctuations between warm and cool grays are strictly prohibited. Pure black (`#000000`) and AI neon/purple glows are banned.

### Neutrals (Foundation & Structure)
* **Canvas Neutral** (`#F8FAFC`, Slate-50) — Root application background canvas; soft, low-glare surface for all-day office usage.
* **Pure Surface** (`#FFFFFF`, White) — Primary container fill for data tables, invoices, cards, and modal panels.
* **Panel Header Tint** (`#F1F5F9`, Slate-100) — Subdued background for table header rows, metric summaries, and inactive tabs.
* **Subtle Structural Border** (`#CBD5E1`, Slate-300) — Distinct 1px border for form inputs, table gridlines, and card perimeters (provides strong boundary contrast for older displays).
* **Hairline Divider** (`#E2E8F0`, Slate-200) — Internal subtle horizontal row dividers and separation lines.
* **Charcoal Ink** (`#0F172A`, Slate-900) — Primary high-contrast typography, high-priority numbers, and active navigation labels.
* **Slate Body** (`#334155`, Slate-700) — Standard body text, form field values, and secondary headers.
* **Muted Steel** (`#64748B`, Slate-500) — Secondary labels, timestamps, metadata, helper text, and inactive iconography.

### Single Core Brand Accent (Command & Action)
* **Industrial Cobalt** (`#1D4ED8`, Blue-700 / 72% Saturation) — Sole primary interactive accent. Used exclusively for primary action buttons, focused input rings, selected tab indicators, and active workflow badges.
* **Cobalt Hover** (`#1E40AF`, Blue-800) — Darkened hover state for primary action buttons.
* **Cobalt Subtle Wash** (`#EFF6FF`, Blue-50) — Background tint for selected table rows, active navigation groups, and info highlights.

### Functional Status Tokens (High-Contrast & Muted Backgrounds)
* **Verified Emerald** (`#059669`, Green-600) / **Emerald Wash** (`#ECFDF5`, Green-50) — Fully paid invoices, active staff accounts, approved inventory returns, balanced closing.
* **Warning Amber** (`#D97706`, Amber-600) / **Amber Wash** (`#FFFBEB`, Amber-50) — Quarantined returns awaiting inspection, pending stock discrepancies, credit due notices.
* **Critical Crimson** (`#DC2626`, Red-600) / **Crimson Wash** (`#FEF2F2`, Red-50) — Damaged stock write-offs, cancelled invoices, overdue accounts, validation errors.
* **Info Steel** (`#0284C7`, Sky-600) / **Sky Wash** (`#F0F9FF`, Sky-50) — Draft receiving records, customer notes, operational tags.

---

## 3. Typographic Architecture

Typography enforces strict functional clarity. Variable scales must remain disciplined so headlines never overpower operational data. Monospace tabular numbers are mandatory for all mathematical balances.

* **Display & Section Headers:** `Geist Sans` (Fallback: `Arial, sans-serif`)
  * Tight letter-spacing (`tracking-tight`, `-0.02em`).
  * Controlled scale: Page titles capped at `1.5rem` (24px) / `font-bold` (700). Section headers at `1.125rem` (18px) / `font-semibold` (600).
  * Weight-driven hierarchy over excessive font sizes.
* **Body & Form Text:** `Geist Sans` (Fallback: `Arial, sans-serif`)
  * Standard body: `0.875rem` (14px) / `leading-relaxed` / Slate Body (`#334155`).
  * Table cells & field labels: `0.8125rem` (13px) to `0.875rem` (14px) / `font-medium` (500).
  * Line length constrained to a maximum of 65 characters (`max-w-prose`) for notes and audit justifications.
* **Numerical & Ledger Mono:** `Geist Mono` (Fallback: `ui-monospace, monospace`)
  * **Mandatory Usage:** All currency figures (`Rs. 1,500.00`), crate and bottle balances, stock quantities, invoice numbers (`INV-20260908-001`), SKU codes, and audit timestamps (`17:42:01`).
  * Feature tag: `font-variant-numeric: tabular-nums` ensures zero column jitter during live recalculations.
* **Banned Typography:**
  * `Inter` is banned to avoid generic AI slop aesthetics.
  * Serif fonts (`Times New Roman`, `Georgia`, `Garamond`, etc.) are strictly banned across all screens.
  * Thin weights (`font-thin`, `font-extralight`) are banned to preserve legibility for older operators.

---

## 4. Component Stylings & Interaction Behaviors

Every interactive element must provide unmistakable, tactile visual feedback.

### Buttons & Interactive Controls
* **Primary Action Button:**
  * Fill: Industrial Cobalt (`#1D4ED8`), Text: White (`#FFFFFF`), Weight: `font-semibold` (600).
  * Geometry: Crisp rounded corners (`rounded-lg` / 8px). Standard height: `40px` (Desktop) / `44px` (Tablet/Mobile).
  * Tactile Push Feedback: Translates `-1px` on `:active` with subtle inner shadow.
  * Prohibition: Absolutely NO neon glow shadows, radial gradients, or pulsing ring animations on primary buttons.
* **Secondary / Neutral Button:**
  * Fill: White (`#FFFFFF`), Border: `1px solid #CBD5E1` (Slate-300), Text: Charcoal Ink (`#0F172A`).
  * Hover: Background shifts to Panel Header Tint (`#F1F5F9`).
* **Destructive Action Button:**
  * Fill: White (`#FFFFFF`), Border: `1px solid #FCA5A5` (Red-300), Text: Critical Crimson (`#DC2626`).
  * Hover: Background shifts to Crimson Wash (`#FEF2F2`).
* **Tap Target Rule:** Minimum interactive hit area is `44px × 44px` across all screen sizes.

### Data Tables & Ledger Grids
* **Container Structure:** Outer border `1px solid #CBD5E1`, background White (`#FFFFFF`), corner radius `rounded-lg` (8px).
* **Header Row:** Background Panel Header Tint (`#F1F5F9`), uppercase micro-labels (`0.75rem` / 12px, `font-semibold`, `tracking-wider`, `#64748B`), bottom border `2px solid #CBD5E1`.
* **Data Rows:** Compact row height (`44px`–`48px`), bottom divider `1px solid #E2E8F0`. Hover state applies a subtle tint (`#F8FAFC`).
* **Alignment Standards:** Text and customer names left-aligned; status badges centered; quantities, unit prices, discounts, and totals **strictly right-aligned** using `Geist Mono`.

### Form Fields & Inputs
* **Label Placement:** Top-aligned permanent label (`0.8125rem` / 13px, `font-medium`, `#0F172A`) with `4px` gap to input. Never use floating labels that disappear upon entry.
* **Input Box:** Height `40px` (desktop) / `44px` (mobile), padding `0.5rem 0.75rem`, background White (`#FFFFFF`), border `1px solid #CBD5E1`.
* **Focus State:** 2px ring in Industrial Cobalt (`#1D4ED8`) with zero offset (`ring-2 ring-blue-700`).
* **Validation / Error State:** Border shifts to Critical Crimson (`#DC2626`), inline error message appears directly below the input in 12px red font.
* **Quantity Input Controls:** Stepper plus/minus buttons or clearly visible numeric inputs with large, comfortable click targets.

### Status Badges & Chips
* **Shape:** Inline, compact pill or rounded rectangle (`rounded-md` / 6px), padding `2px 8px`.
* **Design:** Solid 1px border matched with muted background wash and deep text.
  * *Completed/Paid:* Emerald border (`#A7F3D0`), Emerald wash (`#ECFDF5`), Emerald text (`#065F46`).
  * *Quarantined/Pending:* Amber border (`#FDE68A`), Amber wash (`#FFFBEB`), Amber text (`#92400E`).
  * *Cancelled/Damaged:* Red border (`#FECACA`), Red wash (`#FEF2F2`), Red text (`#991B1B`).

### Modals & Dialogs
* **Backdrop:** Semi-transparent neutral scrim (`rgba(15, 23, 42, 0.5)` / Slate-900 at 50% opacity). No blurry backdrop filters that slow down terminal hardware.
* **Dialog Container:** Max width `32rem` (512px) for confirmations, `48rem` (768px) for complex forms. Elevation: `0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)`.
* **Header & Footer:** Explicit border-b on header and border-t on footer. Primary action right-aligned; "Cancel" or "Close" clearly placed on the left.

### Empty & Loading States
* **Skeletal Loaders:** Geometric pulses with exact matching dimensions (`#E2E8F0` pulse) that preserve layout stability. Never use generic floating circular spinners.
* **Empty States:** Clear icon in Muted Steel (`#64748B`), bold single-sentence statement (e.g. "No sales found for this date range"), paired with a direct primary action button (e.g. "Create New Sale").

---

## 5. Layout Principles & Navigation Architecture

* **Max-Width Containment:** All desktop views constrained to `1400px` (`max-w-7xl`) centered with responsive gutter padding (`px-4 sm:px-6 lg:px-8`).
* **Global Navigation Bar:**
  * Clean, compact desktop header (`64px` height) with white surface (`#FFFFFF`) and bottom border `1px solid #CBD5E1`.
  * Grouped navigation links with subtle category tags:
    * **Front Office:** Dashboard, Sales, Customers
    * **Warehouse:** Products, Receiving, Returns, Damage, Stock Counts
    * **Admin (Owner Only):** Daily Closing, Reports, Approvals, Suppliers, Users
  * Visible active-route indicator: Industrial Cobalt bottom bar (`2px solid #1D4ED8`) and bold charcoal typography.
  * Navigation is never icon-only; clear labels are permanently visible.
* **Spatial Integrity (No Overlapping):**
  * Absolute positioning for layout stacking is strictly forbidden.
  * Every card, form group, summary ribbon, and table occupies its own explicit spatial bounding box.
* **Multi-Metric Summary Ribbons (Dashboard & Reports):**
  * Displayed as a 4-column structured grid on desktop (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`).
  * Each metric card displays: Micro-label (`0.75rem`, Muted Steel), Primary Value (`1.5rem`, `font-bold`, Tabular Mono), and Contextual Subtitle (e.g. "+12 crates vs yesterday").

---

## 6. Responsive Rules & Viewport Adaptation

The application must deliver seamless operation on both desktop monitors (1280px+) and warehouse tablets / checkout counters (768px–1024px).

* **Mobile-First Structural Collapse (< 768px):**
  * Multi-column form layouts (Customer + Items + Payment) collapse into a clean, vertical single-column sequence.
  * Navigation collapses into a full-width accessible menu drawer with large 48px touch targets.
* **Zero Horizontal Page Overflow:**
  * Viewport-level horizontal scrolling is classified as a critical failure.
  * Filter rows wrap gracefully into multi-line flex containers (`flex-wrap gap-2`).
* **Data Grid Adaptation on Tablets:**
  * Tables are wrapped in an isolated scroll container (`overflow-x-auto`) with fixed left column headers where appropriate.
  * On narrow screens (< 640px), non-essential metadata columns (e.g. Created By, Timestamp) are suppressed to keep Product, Quantity, and Balance immediately visible.
* **Form Viewport Sizing:**
  * Full-height modals and screens use `min-h-[100dvh]` rather than `h-screen` to prevent iOS/Android dynamic browser bar jumps.

---

## 7. Motion & Interaction Specifications

* **Spring Physics Parameters:**
  * Modal entry & sliding drawers: `stiffness: 140, damping: 22` (delivers a weighted, professional arrival with zero spring wobble).
* **Micro-Interaction Transition Speeds:**
  * Standard hover and focus transitions: `150ms ease-out`.
  * Active button press: `75ms ease-in`.
  * Animated properties restricted exclusively to `transform` and `opacity`. Never animate `width`, `height`, `margin`, or `padding` to avoid layout thrashing.
* **Perpetual Status Indicators:**
  * Subdued 2-second pulse on live inventory warnings or unclosed register drawers (`animate-pulse` with 40% opacity floor).

---

## 8. Anti-Patterns & Banned AI Clichés

The following design patterns and implementation choices are strictly prohibited across all screens:

1. **No Emojis:** Never use emojis (🚀, 📦, 💰, ⚠️) for status indicators, section titles, or buttons. Use SVG iconography exclusively (`Lucide` or clean stroke icons).
2. **No `Inter` Font:** Default generic SaaS typeface is banned. Use `Geist Sans` and `Geist Mono`.
3. **No Generic Serif Typefaces:** `Times New Roman`, `Georgia`, `Garamond`, and `Palatino` are banned. Serif fonts are forbidden in business software and dashboards.
4. **No Pure Black:** `#000000` is banned. Use Charcoal Ink (`#0F172A`) or Slate-900 for dark surfaces.
5. **No AI Purple / Neon Glows:** No purple button gradients, no multi-colored ambient background blobs, no neon box-shadows.
6. **No Floating Labels:** Form inputs must maintain permanent top-aligned labels.
7. **No 3-Column Equal Feature Cards:** Generic marketing bento grids are forbidden. Use purpose-built data tables, asymmetric metric ribbons, or structured split screens.
8. **No Overlapping Elements:** Text must never overlap pictures or charts. Absolute stacking is banned.
9. **No AI Copywriting Clichés:** Words like *"Seamless"*, *"Elevate"*, *"Unleash"*, *"Next-Gen"*, and *"Empower"* are banned. Use practical business terminology (*"Post Receiving"*, *"Record Damaged Stock"*, *"Finalize Daily Closing"*).
10. **No Fictional Metric Rounding:** Never use fake metrics like `99.9%` or `100% Guaranteed`. All figures must reflect actual stock balances, crate debts, and rupee cash counts.
11. **No Filler Scroll Prompts:** "Scroll to explore", bouncing chevrons, or down-arrows are banned.
12. **No Walk-in Customer Entity:** Anonymous transactions must display as *"No Customer"* or *"Anonymous"*. Never fabricate a dummy database customer.
13. **No Unhandled Broken Assets:** All product avatars or brand assets must provide fallback SVG containers with brand initials.
