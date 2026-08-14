# Retailers tab in Beat Analytics

Add a second top-level tab to the Beat Analytics modal (opened from the Analytics button on a beat card in My Beats) that judges each retailer in the beat: who is healthy, who is slipping, who needs a visit. Everything currently in the modal stays exactly as it is, moved under an "Overview" tab.

## What the rep sees

- **Header strip** — beat name, owner, retailer count, period, total revenue, then one computed summary sentence (e.g. "5 retailers worth ₹1.2L have stopped ordering — the biggest thing to fix in this beat this week.").
- **State strip + filter chips** — a bar segmented by state, and chips with per-state counts.
- **Table** — Retailer · State · Value · Momentum · Overdue · Premium. Under each name: `Category A · behaves B` plus `grade gap` / `effort sink` pills where they apply.
- **Detail panel** — opens below the table on row click with the verdict sentence in a tinted box and eight tiles (Value, Momentum, Rhythm, Overdue, Avg order, Conversion, Premium mix, Grade), plus a link that opens the existing RetailerDetailModal.
- Default sort: value at risk descending, then revenue. Default filter: All. Keyboard operable rows, skeleton loading, error with retry, 375px-safe layout.

Styling follows the attached HTML reference (light surfaces, rounded cards, pill chips, uppercase muted table headers) mapped onto existing semantic tokens and shadcn components.

## The judgement logic

Every retailer gets exactly one state, judged against its own ordering rhythm (`overdue_ratio = days since last order ÷ that retailer's median gap`), never a fixed "no order in 30 days" rule. Evaluated in order, first match wins: `prospect`, `never_started`, `new`, `dormant`, `at_risk`, `slipping`, `growing`, `steady`. Each state produces a deterministic templated sentence containing that retailer's own numbers — no AI call anywhere on this tab.

Cross-cutting flags: **grade gap** (assigned category outranks behaviour by two or more levels, behaviour derived by revenue thirds within the beat) and **effort sink** (5+ visits, zero orders).

## Technical details

**Migration** — new read-only function `get_beat_retailer_board(p_beat_id text, p_days int default 90)`, `SECURITY INVOKER` so RLS applies to the calling user. Returns one row per retailer with: revenue, orders_count, visits_count, last_order_date, days_since_last_order, median_gap_days, overdue_ratio, momentum_pct, avg_order_value, sku_count, premium_pct, dominant_objection, category_assigned, grade_derived, state, flags, value_at_risk. No table or RLS changes.

Schema decisions confirmed against the live database:

- Join `retailers.beat_id` → `beats.beat_id` (text), never `beats.id`.
- Beat membership comes from `retailers.beat_id`; `orders.beat_id` is never used for filtering. `retailer_beat_assignments` is not used.
- `orders.status = 'confirmed'` everywhere; `order_date` for windowing.
- `retailers.category` normalised (`Category A` → `A`, blank → `unset`).
- Visits counted by `visits.created_at`; `dominant_objection` = most frequent non-null `visits.no_order_reason` in the window.
- `premium_pct` = share of order value whose realised rate is ≥ a named constant `PREMIUM_RATE_PER_KG_THRESHOLD = 250` (₹/kg), computed from `order_items` value ÷ kg in the window. `Grams`/`GRAM` divided by 1000; `conversion_to_base` not trusted. `products.rate` deliberately not used.
- Beat access respected through existing RLS on `retailers`/`beats`/`beat_user_access` — ownership and grants both work.

**New files**

- `src/types/beatRetailerBoard.types.ts` — row type, state union, flag union.
- `src/hooks/useBeatRetailerBoard.ts` — react-query call to the RPC, plus pure helpers for verdict sentences, the beat summary line, and a single `formatInr`.
- `src/components/beats/BeatRetailersTab.tsx` — header strip, state strip, chips, table, detail panel.

**Changed file**

- `src/components/BeatAnalyticsModal.tsx` — wrap the current body in `<Tabs>` with `Overview` and `Retailers`. The existing inner 5-tab group (Sales by Product / Retailers / Revenue Trend / Lifetime Value / Last 10 Visits) stays untouched inside Overview; its inner "Retailers" tab is renamed to "Top Retailers" only to avoid label confusion with the new outer tab. Last outer tab remembered in `sessionStorage`. AI Insights button and `BeatInsightModal` untouched.

No new npm dependencies; no writes; nothing removed from Overview.
