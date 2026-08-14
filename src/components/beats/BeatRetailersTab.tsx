import { Fragment, useMemo, useState } from 'react';
import { AlertCircle, ChevronRight, ExternalLink, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  STATE_LABELS,
  STATE_ORDER,
  STATE_STYLES,
  type RetailerBoardRow,
  type RetailerState,
} from '@/types/beatRetailerBoard.types';
import {
  buildBeatSummary,
  buildVerdict,
  countByState,
  formatInr,
  formatPct,
  useBeatRetailerBoard,
} from '@/hooks/useBeatRetailerBoard';

interface BeatRetailersTabProps {
  beatId: string;
  beatName: string;
  ownerName?: string;
  days?: number;
  onOpenRetailer?: (retailerId: string) => void;
}

const FLAG_LABELS: Record<string, string> = {
  grade_gap: 'grade gap',
  effort_sink: 'effort sink',
};

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function BeatRetailersTab({
  beatId,
  beatName,
  ownerName,
  days = 90,
  onOpenRetailer,
}: BeatRetailersTabProps) {
  const { data, isLoading, error, refetch } = useBeatRetailerBoard(beatId, days);
  const [filter, setFilter] = useState<RetailerState | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rows = data || [];
  const counts = useMemo(() => countByState(rows), [rows]);
  const totalRevenue = useMemo(() => rows.reduce((s, r) => s + Number(r.revenue || 0), 0), [rows]);
  const summary = useMemo(() => buildBeatSummary(rows), [rows]);

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.state === filter)),
    [rows, filter],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-8 w-full rounded-full" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-muted-foreground">Could not load the retailer board for this beat.</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="text-base font-semibold">{beatName}</h3>
          {ownerName && <span className="text-xs text-muted-foreground">· {ownerName}</span>}
          <span className="text-xs text-muted-foreground">· {rows.length} retailers</span>
          <span className="text-xs text-muted-foreground">· last {days} days</span>
          <span className="text-xs font-medium">· {formatInr(totalRevenue)}</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground/80">{summary}</p>
      </div>

      {/* State strip */}
      {rows.length > 0 && (
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          {STATE_ORDER.filter((s) => counts[s] > 0).map((s) => (
            <div
              key={s}
              className={STATE_STYLES[s].bar}
              style={{ width: `${(counts[s] / rows.length) * 100}%` }}
              title={`${STATE_LABELS[s]}: ${counts[s]}`}
            />
          ))}
        </div>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs',
            filter === 'all' ? 'bg-foreground text-background border-foreground' : 'bg-background',
          )}
        >
          All {rows.length}
        </button>
        {STATE_ORDER.filter((s) => counts[s] > 0).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? 'all' : s)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs',
              STATE_STYLES[s].chip,
              filter === s && 'ring-2 ring-offset-1 ring-foreground/30',
            )}
          >
            {STATE_LABELS[s]} {counts[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">
          No retailers match this filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Retailer</th>
                <th className="px-3 py-2 text-left font-medium">State</th>
                <th className="px-3 py-2 text-right font-medium">Value</th>
                <th className="px-3 py-2 text-right font-medium">Momentum</th>
                <th className="px-3 py-2 text-right font-medium">Overdue</th>
                <th className="px-3 py-2 text-right font-medium">Premium</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r: RetailerBoardRow) => {
                const open = expandedId === r.retailer_id;
                return (
                  <Fragment key={r.retailer_id}>
                    <tr
                      tabIndex={0}
                      role="button"
                      aria-expanded={open}
                      onClick={() => setExpandedId(open ? null : r.retailer_id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setExpandedId(open ? null : r.retailer_id);
                        }
                      }}
                      className={cn('cursor-pointer border-b outline-none hover:bg-muted/40 focus:bg-muted/50', open && 'bg-muted/40')}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium leading-tight">{r.retailer_name?.trim()}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                          <span>
                            Category {r.category_assigned} · behaves {r.grade_derived}
                          </span>
                          {r.flags.map((f) => (
                            <span key={f} className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-700">
                              {FLAG_LABELS[f] || f}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', STATE_STYLES[r.state].chip)}>
                          {STATE_LABELS[r.state]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{formatInr(r.revenue)}</td>
                      <td className="px-3 py-2 text-right">
                        {r.momentum_pct === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={cn('inline-flex items-center gap-0.5', r.momentum_pct >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                            {r.momentum_pct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {formatPct(r.momentum_pct)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.overdue_ratio === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          `${r.overdue_ratio}x`
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.premium_pct === null ? <span className="text-muted-foreground">—</span> : `${r.premium_pct}%`}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        <ChevronRight size={14} className={cn('transition-transform', open && 'rotate-90')} />
                      </td>
                    </tr>

                    {open && (
                      <tr className="border-b bg-muted/20">
                        <td colSpan={7} className="px-3 py-3">
                          <div className={cn('rounded-xl border p-3 text-sm leading-relaxed', STATE_STYLES[r.state].chip)}>
                            {buildVerdict(r)}
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <Tile label="Value" value={formatInr(r.revenue)} hint={`${r.orders_count} orders`} />
                            <Tile label="Momentum" value={formatPct(r.momentum_pct)} hint="vs previous period" />
                            <Tile
                              label="Rhythm"
                              value={r.median_gap_days ? `${Math.round(r.median_gap_days)}d` : '—'}
                              hint="median order gap"
                            />
                            <Tile
                              label="Overdue"
                              value={r.overdue_ratio === null ? '—' : `${r.overdue_ratio}x`}
                              hint={r.days_since_last_order === null ? 'never ordered' : `${r.days_since_last_order}d since order`}
                            />
                            <Tile label="Avg order" value={formatInr(r.avg_order_value)} />
                            <Tile
                              label="Conversion"
                              value={r.visits_count ? `${Math.round((r.orders_count / r.visits_count) * 100)}%` : '—'}
                              hint={`${r.visits_count} visits`}
                            />
                            <Tile
                              label="Premium mix"
                              value={r.premium_pct === null ? '—' : `${r.premium_pct}%`}
                              hint={`${r.sku_count} SKUs`}
                            />
                            <Tile label="Grade" value={`${r.category_assigned} → ${r.grade_derived}`} hint="assigned → behaviour" />
                          </div>
                          {onOpenRetailer && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-3"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenRetailer(r.retailer_id);
                              }}
                            >
                              <ExternalLink size={14} className="mr-1" /> Open retailer
                            </Button>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default BeatRetailersTab;
