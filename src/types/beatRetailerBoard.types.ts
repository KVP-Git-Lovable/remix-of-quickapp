export type RetailerState =
  | 'prospect'
  | 'never_started'
  | 'new'
  | 'dormant'
  | 'at_risk'
  | 'slipping'
  | 'growing'
  | 'steady';

export type RetailerFlag = 'grade_gap' | 'effort_sink';

export interface RetailerBoardRow {
  retailer_id: string;
  retailer_name: string;
  category_assigned: string;
  revenue: number;
  orders_count: number;
  orders_total_count: number;
  visits_count: number;
  last_order_date: string | null;
  days_since_last_order: number | null;
  median_gap_days: number | null;
  overdue_ratio: number | null;
  momentum_pct: number | null;
  avg_order_value: number;
  sku_count: number;
  premium_pct: number | null;
  dominant_objection: string | null;
  grade_derived: string;
  state: RetailerState;
  flags: RetailerFlag[];
  value_at_risk: number;
  created_at: string;
}

export const STATE_LABELS: Record<RetailerState, string> = {
  prospect: 'Prospect',
  never_started: 'Never started',
  new: 'New',
  dormant: 'Dormant',
  at_risk: 'At risk',
  slipping: 'Slipping',
  growing: 'Growing',
  steady: 'Steady',
};

/** Ordered worst-first, used for the state strip and chip order. */
export const STATE_ORDER: RetailerState[] = [
  'dormant',
  'at_risk',
  'slipping',
  'steady',
  'growing',
  'new',
  'never_started',
  'prospect',
];

/** Tailwind classes per state — text/bg/border for chips and pills. */
export const STATE_STYLES: Record<RetailerState, { chip: string; bar: string }> = {
  dormant: { chip: 'bg-rose-100 text-rose-700 border-rose-200', bar: 'bg-rose-400' },
  at_risk: { chip: 'bg-orange-100 text-orange-700 border-orange-200', bar: 'bg-orange-400' },
  slipping: { chip: 'bg-amber-100 text-amber-700 border-amber-200', bar: 'bg-amber-400' },
  steady: { chip: 'bg-sky-100 text-sky-700 border-sky-200', bar: 'bg-sky-400' },
  growing: { chip: 'bg-emerald-100 text-emerald-700 border-emerald-200', bar: 'bg-emerald-400' },
  new: { chip: 'bg-violet-100 text-violet-700 border-violet-200', bar: 'bg-violet-400' },
  never_started: { chip: 'bg-stone-100 text-stone-600 border-stone-200', bar: 'bg-stone-400' },
  prospect: { chip: 'bg-slate-100 text-slate-600 border-slate-200', bar: 'bg-slate-300' },
};
