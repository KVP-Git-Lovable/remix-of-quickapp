import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RetailerBoardRow, RetailerState } from '@/types/beatRetailerBoard.types';
import { STATE_LABELS } from '@/types/beatRetailerBoard.types';

/** Realised rate (₹ per kg) at or above which order value counts as premium. */
export const PREMIUM_RATE_PER_KG_THRESHOLD = 250;

export function formatInr(value: number | null | undefined): string {
  const n = Number(value || 0);
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  return `${n > 0 ? '+' : ''}${n.toFixed(0)}%`;
}

/** Deterministic verdict sentence built from the retailer's own numbers. No LLM. */
export function buildVerdict(r: RetailerBoardRow): string {
  const gap = r.median_gap_days ? `${Math.round(r.median_gap_days)} days` : null;
  const since = r.days_since_last_order;
  const objection = r.dominant_objection ? ` Field reason logged most often: "${r.dominant_objection}".` : '';

  switch (r.state) {
    case 'prospect':
      return 'No orders and no visits on record — this outlet has never been worked. First step is a visit, not a follow-up.';
    case 'never_started':
      return `Visited ${r.visits_count} time${r.visits_count === 1 ? '' : 's'} but has never placed an order.${objection || ' Worth deciding whether it converts or comes off the route.'}`;
    case 'new':
      return `Opened recently and has ${r.orders_total_count} order${r.orders_total_count === 1 ? '' : 's'} so far worth ${formatInr(r.revenue)}. Too young to judge — keep the rhythm going before the habit sets.`;
    case 'dormant':
      return `No order for ${since} days${gap ? `, against a usual gap of ${gap}` : ''}. ${formatInr(r.revenue)} of business has effectively stopped here.${objection}`;
    case 'at_risk':
      return `Last ordered ${since} days ago — about ${r.overdue_ratio}x its usual ${gap} rhythm. ${formatInr(r.revenue)} is at risk if the next visit slips again.${objection}`;
    case 'slipping':
      return `Ordering is losing pace${r.momentum_pct !== null ? ` (${formatPct(r.momentum_pct)} vs the previous period)` : ''}${gap ? ` and it is ${since} days since the last order against a ${gap} rhythm` : ''}. Still recoverable with one deliberate visit.${objection}`;
    case 'growing':
      return `Ordering is up ${formatPct(r.momentum_pct)} on the previous period at ${formatInr(r.revenue)} across ${r.orders_count} orders. Room to widen the range — ${r.sku_count} SKU${r.sku_count === 1 ? '' : 's'} bought so far.`;
    case 'steady':
    default:
      return `Ordering on rhythm${gap ? ` (about every ${gap})` : ''} at ${formatInr(r.revenue)} across ${r.orders_count} orders. Nothing to fix — protect it and push range.`;
  }
}

export function buildBeatSummary(rows: RetailerBoardRow[]): string {
  if (!rows.length) return 'No retailers mapped to this beat yet.';
  const risky = rows.filter((r) => r.state === 'dormant' || r.state === 'at_risk');
  const riskyValue = risky.reduce((s, r) => s + Number(r.revenue || 0), 0);
  if (risky.length && riskyValue > 0) {
    return `${risky.length} retailer${risky.length === 1 ? '' : 's'} worth ${formatInr(riskyValue)} have stopped ordering to rhythm — the biggest thing to fix in this beat this week.`;
  }
  if (risky.length) {
    return `${risky.length} retailer${risky.length === 1 ? '' : 's'} have gone quiet with no billing behind them — decide whether they stay on the route.`;
  }
  const slipping = rows.filter((r) => r.state === 'slipping').length;
  if (slipping) return `${slipping} retailer${slipping === 1 ? '' : 's'} are losing pace but none have stopped — a corrective visit each is enough.`;
  const growing = rows.filter((r) => r.state === 'growing').length;
  if (growing) return `Nothing is at risk here and ${growing} retailer${growing === 1 ? '' : 's'} are growing — push range rather than coverage.`;
  return 'No retailer in this beat is off rhythm — hold coverage and work on range.';
}

export function countByState(rows: RetailerBoardRow[]): Record<RetailerState, number> {
  const counts = {} as Record<RetailerState, number>;
  (Object.keys(STATE_LABELS) as RetailerState[]).forEach((s) => (counts[s] = 0));
  rows.forEach((r) => {
    counts[r.state] = (counts[r.state] || 0) + 1;
  });
  return counts;
}

export function useBeatRetailerBoard(beatId: string | null, days = 90, enabled = true) {
  return useQuery({
    queryKey: ['beat-retailer-board', beatId, days],
    enabled: !!beatId && enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RetailerBoardRow[]> => {
      const { data, error } = await (supabase as any).rpc('get_beat_retailer_board', {
        p_beat_id: beatId,
        p_days: days,
      });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        ...r,
        revenue: Number(r.revenue || 0),
        median_gap_days: r.median_gap_days === null ? null : Number(r.median_gap_days),
        overdue_ratio: r.overdue_ratio === null ? null : Number(r.overdue_ratio),
        momentum_pct: r.momentum_pct === null ? null : Number(r.momentum_pct),
        premium_pct: r.premium_pct === null ? null : Number(r.premium_pct),
        avg_order_value: Number(r.avg_order_value || 0),
        value_at_risk: Number(r.value_at_risk || 0),
        flags: (r.flags || []) as RetailerBoardRow['flags'],
      })) as RetailerBoardRow[];
    },
  });
}
