import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft, RefreshCw, Sparkles, Loader2, Quote, ChevronDown, ChevronUp,
  AlertTriangle, IndianRupee,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * Target Advisor.
 *
 * Deliberately one screen with four things on it: how much per day, who to call,
 * why you're behind, and what lever to pull. A rep reads this standing in a shop
 * doorway, so everything that isn't one of those four is either cut or folded
 * behind "Show the numbers".
 *
 * Every figure here comes from get_target_advisor_facts. The model ranks and
 * phrases; it never computes, so a number on this screen can always be traced
 * back to a row in the database.
 */

interface Call {
  name: string;
  expect: number;
  why: string;
  flag: string | null;
}

interface Advice {
  status: 'behind' | 'on_track' | 'ahead';
  statusLine: string;
  calls: Call[];
  diagnosis: string;
  levers: string[];
}

interface Facts {
  pace: {
    monthRevenueTarget: number;
    monthQuantityTarget: number;
    quantityUnit: string;
    mtdRevenue: number;
    mtdQuantity: number;
    workingDaysLeft: number;
    requiredPerDay: number;
    gap: number;
    planYear: number | null;
  };
  today: Array<{
    name: string; expected: number; days_silent: number | null;
    cadence_days: number | null; dues: number; usual_sku: string | null; avg_value: number;
  }>;
  listSource: 'beat_plan' | 'lapsed_accounts';
  diagnosis: { visits90: number; buyers90: number; strikeRate: number | null; dormantOver45d: number };
  levers: { schemes: Array<{ name: string; endsIn: number }>; topSku: string | null; topSkuValue: number | null };
  generatedFor: string;
}

/** ₹66,667 / ₹1.2L / ₹1.67Cr — Indian grouping, because the reader is Indian. */
const money = (n: number): string => {
  if (!Number.isFinite(n)) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

const statusStyles: Record<Advice['status'], { chip: string; label: string }> = {
  behind: { chip: 'bg-destructive/10 text-destructive', label: 'Behind pace' },
  on_track: { chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'On track' },
  ahead: { chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Ahead' },
};

export default function TargetAchievementAdvisor() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [advice, setAdvice] = useState<Advice | null>(null);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [quote, setQuote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNumbers, setShowNumbers] = useState(false);

  const generate = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-target-advice', {
        body: {},
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setAdvice(data.advice ?? null);
      setFacts(data.facts ?? null);
      setQuote(data.quote ?? '');
    } catch (e: any) {
      const msg = e?.message || 'Could not generate your plan';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Generate on open. The rep tapped "Target Advisor" — that IS the request;
  // making them tap a second button to see anything is a wasted screen.
  useEffect(() => {
    if (user?.id) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const s = advice ? statusStyles[advice.status] ?? statusStyles.on_track : statusStyles.on_track;

  return (
    <Layout>
      <div className="mx-auto w-full max-w-lg px-4 pb-24 pt-3 space-y-3">

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base font-bold flex-1">Target Advisor</h1>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                  onClick={generate} disabled={loading} aria-label="Regenerate">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>

        {loading && !advice && (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs">Reading your numbers…</span>
          </div>
        )}

        {error && !loading && (
          <Card className="rounded-2xl border-destructive/30">
            <CardContent className="p-4 flex gap-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-2 min-w-0">
                <p className="text-sm">{error}</p>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={generate}>
                  Try again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {advice && !loading && (
          <>
            {/* The one number. Nothing else competes with it. */}
            <Card className="rounded-2xl">
              <CardContent className="p-4">
                <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', s.chip)}>
                  {s.label}
                </span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold tabular-nums leading-none">
                    {facts ? money(facts.pace.requiredPerDay) : '—'}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">/day</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{advice.statusLine}</p>
              </CardContent>
            </Card>

            {advice.calls.length > 0 && (
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Today · {advice.calls.length} calls ·{' '}
                    {money(advice.calls.reduce((t, c) => t + (Number(c.expect) || 0), 0))} likely
                  </p>

                  <ul className="mt-2 divide-y divide-border">
                    {advice.calls.map((c, i) => (
                      <li key={`${c.name}-${i}`} className="py-2.5">
                        <div className="flex items-baseline gap-2">
                          <span className="w-4 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                            {i + 1}
                          </span>
                          <span className="flex-1 truncate text-sm font-semibold">{c.name}</span>
                          {c.flag && (
                            <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                              {c.flag}
                            </span>
                          )}
                          <span className="shrink-0 text-sm font-bold tabular-nums">
                            {money(Number(c.expect) || 0)}
                          </span>
                        </div>
                        <p className="pl-6 text-xs text-muted-foreground">{c.why}</p>
                      </li>
                    ))}
                  </ul>

                  {facts?.listSource === 'lapsed_accounts' && (
                    <p className="pt-2 text-[10px] text-muted-foreground">
                      No beat plan today — showing your lapsed accounts.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* The most valuable line on the screen: coverage problem or
                conversion problem. They need opposite responses. */}
            <Card className="rounded-2xl">
              <CardContent className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Why you're behind
                </p>
                <p className="mt-1 text-sm leading-relaxed">{advice.diagnosis}</p>
                {advice.levers.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {advice.levers.map((l, i) => (
                      <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                        <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{l}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Everything else lives here. Available, not competing. */}
            {facts && (
              <div>
                <button
                  onClick={() => setShowNumbers(v => !v)}
                  className="flex w-full items-center justify-center gap-1 py-2 text-xs text-muted-foreground"
                >
                  {showNumbers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showNumbers ? 'Hide the numbers' : 'Show the numbers'}
                </button>

                {showNumbers && (
                  <Card className="rounded-2xl">
                    <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
                      <Stat label="Month target" value={money(facts.pace.monthRevenueTarget)} />
                      <Stat label="Achieved" value={money(facts.pace.mtdRevenue)} />
                      <Stat label="Gap" value={money(facts.pace.gap)} />
                      <Stat label="Working days left" value={String(facts.pace.workingDaysLeft)} />
                      <Stat label="Visits (90d)" value={String(facts.diagnosis.visits90)} />
                      <Stat label="Bought (90d)" value={String(facts.diagnosis.buyers90)} />
                      <Stat
                        label="Strike rate"
                        value={facts.diagnosis.strikeRate != null ? `${facts.diagnosis.strikeRate}%` : '—'}
                      />
                      <Stat label="Silent 45d+" value={String(facts.diagnosis.dormantOver45d)} />
                      {facts.levers.topSku && (
                        <Stat label="Top product" value={facts.levers.topSku} />
                      )}
                      {facts.pace.monthQuantityTarget > 0 && (
                        <Stat
                          label={`Quantity (${facts.pace.quantityUnit})`}
                          value={`${facts.pace.mtdQuantity} / ${facts.pace.monthQuantityTarget}`}
                        />
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {quote && (
              <p className="flex gap-2 px-1 pt-1 text-[11px] italic leading-relaxed text-muted-foreground">
                <Quote className="mt-0.5 h-3 w-3 shrink-0" />
                {quote}
              </p>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate font-semibold tabular-nums">{value}</p>
    </div>
  );
}
