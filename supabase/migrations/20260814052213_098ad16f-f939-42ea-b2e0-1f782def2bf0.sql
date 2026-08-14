CREATE OR REPLACE FUNCTION public.get_beat_retailer_board(p_beat_id text, p_days integer DEFAULT 90)
RETURNS TABLE (
  retailer_id uuid,
  retailer_name text,
  category_assigned text,
  revenue numeric,
  orders_count integer,
  orders_total_count integer,
  visits_count integer,
  last_order_date date,
  days_since_last_order integer,
  median_gap_days numeric,
  overdue_ratio numeric,
  momentum_pct numeric,
  avg_order_value numeric,
  sku_count integer,
  premium_pct numeric,
  dominant_objection text,
  grade_derived text,
  state text,
  flags text[],
  value_at_risk numeric,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH params AS (
  SELECT GREATEST(COALESCE(p_days, 90), 7) AS days,
         250::numeric AS premium_rate_per_kg
),
base AS (
  SELECT r.id, r.name, r.category, r.created_at
  FROM public.retailers r
  WHERE r.beat_id = p_beat_id
),
ord AS (
  SELECT o.id, o.retailer_id, o.order_date, COALESCE(o.total_amount, 0) AS total_amount
  FROM public.orders o
  JOIN base b ON b.id = o.retailer_id
  WHERE o.status = 'confirmed'
),
win AS (
  SELECT o.*
  FROM ord o, params p
  WHERE o.order_date >= (CURRENT_DATE - p.days)
),
win_agg AS (
  SELECT retailer_id,
         SUM(total_amount) AS revenue,
         COUNT(*)::int AS orders_count
  FROM win GROUP BY retailer_id
),
all_agg AS (
  SELECT retailer_id,
         COUNT(*)::int AS orders_total_count,
         MAX(order_date) AS last_order_date
  FROM ord GROUP BY retailer_id
),
gaps AS (
  SELECT retailer_id,
         (order_date - LAG(order_date) OVER (PARTITION BY retailer_id ORDER BY order_date)) AS gap
  FROM (SELECT DISTINCT retailer_id, order_date FROM ord WHERE order_date >= CURRENT_DATE - 365) d
),
gap_agg AS (
  SELECT retailer_id,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY gap)::numeric AS median_gap_days
  FROM gaps WHERE gap IS NOT NULL AND gap > 0
  GROUP BY retailer_id
),
mom AS (
  SELECT o.retailer_id,
         SUM(CASE WHEN o.order_date >= CURRENT_DATE - (p.days / 2) THEN o.total_amount ELSE 0 END) AS recent,
         SUM(CASE WHEN o.order_date < CURRENT_DATE - (p.days / 2) THEN o.total_amount ELSE 0 END) AS prior
  FROM win o CROSS JOIN params p
  GROUP BY o.retailer_id
),
items AS (
  SELECT w.retailer_id,
         oi.product_id,
         COALESCE(oi.total, 0) AS value,
         CASE
           WHEN oi.unit IS NULL THEN COALESCE(oi.quantity, 0)
           WHEN lower(oi.unit) LIKE 'gram%' OR lower(oi.unit) = 'g' OR lower(oi.unit) = 'gm' OR lower(oi.unit) = 'gms'
             THEN COALESCE(oi.quantity, 0) / 1000.0
           ELSE COALESCE(oi.quantity, 0)
         END AS kg
  FROM public.order_items oi
  JOIN win w ON w.id = oi.order_id
),
item_agg AS (
  SELECT i.retailer_id,
         COUNT(DISTINCT i.product_id)::int AS sku_count,
         SUM(i.value) AS total_value,
         SUM(CASE WHEN i.kg > 0 AND (i.value / i.kg) >= p.premium_rate_per_kg THEN i.value ELSE 0 END) AS premium_value
  FROM items i CROSS JOIN params p
  GROUP BY i.retailer_id
),
vis AS (
  SELECT v.retailer_id,
         COUNT(*)::int AS visits_count
  FROM public.visits v
  JOIN base b ON b.id = v.retailer_id
  CROSS JOIN params p
  WHERE v.created_at >= (now() - make_interval(days => p.days))
  GROUP BY v.retailer_id
),
obj AS (
  SELECT retailer_id, no_order_reason, cnt
  FROM (
    SELECT v.retailer_id, v.no_order_reason, COUNT(*) AS cnt,
           ROW_NUMBER() OVER (PARTITION BY v.retailer_id ORDER BY COUNT(*) DESC, v.no_order_reason) AS rn
    FROM public.visits v
    JOIN base b ON b.id = v.retailer_id
    CROSS JOIN params p
    WHERE v.created_at >= (now() - make_interval(days => p.days))
      AND v.no_order_reason IS NOT NULL AND btrim(v.no_order_reason) <> ''
    GROUP BY v.retailer_id, v.no_order_reason
  ) x WHERE rn = 1
),
merged AS (
  SELECT
    b.id AS retailer_id,
    b.name AS retailer_name,
    CASE
      WHEN b.category IS NULL OR btrim(b.category) = '' THEN 'unset'
      ELSE upper(btrim(regexp_replace(b.category, '^[Cc]ategory\s*', '')))
    END AS category_assigned,
    COALESCE(w.revenue, 0) AS revenue,
    COALESCE(w.orders_count, 0) AS orders_count,
    COALESCE(a.orders_total_count, 0) AS orders_total_count,
    COALESCE(v.visits_count, 0) AS visits_count,
    a.last_order_date,
    CASE WHEN a.last_order_date IS NULL THEN NULL ELSE (CURRENT_DATE - a.last_order_date) END AS days_since_last_order,
    g.median_gap_days,
    CASE
      WHEN a.last_order_date IS NULL OR g.median_gap_days IS NULL OR g.median_gap_days <= 0 THEN NULL
      ELSE ROUND((CURRENT_DATE - a.last_order_date)::numeric / g.median_gap_days, 2)
    END AS overdue_ratio,
    CASE
      WHEN m.prior IS NULL OR m.prior <= 0 THEN
        CASE WHEN COALESCE(m.recent, 0) > 0 THEN 100::numeric ELSE NULL END
      ELSE ROUND(((COALESCE(m.recent, 0) - m.prior) / m.prior) * 100, 1)
    END AS momentum_pct,
    CASE WHEN COALESCE(w.orders_count, 0) > 0 THEN ROUND(w.revenue / w.orders_count, 0) ELSE 0 END AS avg_order_value,
    COALESCE(ia.sku_count, 0) AS sku_count,
    CASE WHEN COALESCE(ia.total_value, 0) > 0 THEN ROUND((ia.premium_value / ia.total_value) * 100, 1) ELSE NULL END AS premium_pct,
    o.no_order_reason AS dominant_objection,
    b.created_at
  FROM base b
  LEFT JOIN win_agg w ON w.retailer_id = b.id
  LEFT JOIN all_agg a ON a.retailer_id = b.id
  LEFT JOIN gap_agg g ON g.retailer_id = b.id
  LEFT JOIN mom m ON m.retailer_id = b.id
  LEFT JOIN item_agg ia ON ia.retailer_id = b.id
  LEFT JOIN vis v ON v.retailer_id = b.id
  LEFT JOIN obj o ON o.retailer_id = b.id
),
graded AS (
  SELECT mm.*,
    CASE
      WHEN mm.revenue <= 0 THEN 'C'
      ELSE CASE NTILE(3) OVER (ORDER BY mm.revenue DESC)
             WHEN 1 THEN 'A' WHEN 2 THEN 'B' ELSE 'C' END
    END AS grade_derived
  FROM merged mm
),
judged AS (
  SELECT gg.*,
    CASE
      WHEN gg.orders_total_count = 0 AND gg.visits_count = 0 THEN 'prospect'
      WHEN gg.orders_total_count = 0 THEN 'never_started'
      WHEN gg.created_at >= (now() - interval '90 days') THEN 'new'
      WHEN COALESCE(gg.days_since_last_order, 9999) >= 90 OR COALESCE(gg.overdue_ratio, 0) >= 3 THEN 'dormant'
      WHEN COALESCE(gg.overdue_ratio, 0) >= 2 THEN 'at_risk'
      WHEN COALESCE(gg.overdue_ratio, 0) >= 1.3 OR COALESCE(gg.momentum_pct, 0) <= -25 THEN 'slipping'
      WHEN COALESCE(gg.momentum_pct, 0) >= 25 THEN 'growing'
      ELSE 'steady'
    END AS state
  FROM graded gg
)
SELECT
  j.retailer_id,
  j.retailer_name,
  j.category_assigned,
  j.revenue,
  j.orders_count,
  j.orders_total_count,
  j.visits_count,
  j.last_order_date,
  j.days_since_last_order,
  j.median_gap_days,
  j.overdue_ratio,
  j.momentum_pct,
  j.avg_order_value,
  j.sku_count,
  j.premium_pct,
  j.dominant_objection,
  j.grade_derived,
  j.state,
  (
    ARRAY[]::text[]
    || CASE
         WHEN j.category_assigned IN ('A','B','C')
           AND (ascii(j.grade_derived) - ascii(j.category_assigned)) >= 2 THEN ARRAY['grade_gap']
         ELSE ARRAY[]::text[]
       END
    || CASE WHEN j.visits_count >= 5 AND j.orders_count = 0 THEN ARRAY['effort_sink'] ELSE ARRAY[]::text[] END
  ) AS flags,
  CASE WHEN j.state IN ('dormant','at_risk','slipping') THEN j.revenue ELSE 0 END AS value_at_risk,
  j.created_at
FROM judged j
ORDER BY value_at_risk DESC, j.revenue DESC, j.retailer_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_beat_retailer_board(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_beat_retailer_board(text, integer) TO service_role;