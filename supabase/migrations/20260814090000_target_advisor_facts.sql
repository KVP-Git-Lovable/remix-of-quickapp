-- Target Advisor fact layer.
--
-- The advisor used to hand the model percentages (revenueProgress: 47) and ask
-- it to invent advice — hence long, generic output. This computes the hard facts
-- instead, so the model only ranks and phrases and never invents a number.
--
-- Already applied to preprod as target_advisor_facts_function +
-- target_advisor_facts_sku_name_fallback. This file is the source of record so a
-- rebuild, remix or port to another environment carries it.

-- 34% of order_items rows carry no product_name, and that unnamed group
-- outweighed every real SKU — "your top product" came back null while its value
-- did not. Resolve the name through products.product_id when the denormalised
-- copy is blank.
create or replace function public.oi_product_label(p_name text, p_product_id uuid)
returns text
language sql
stable
as $$
  select nullif(btrim(coalesce(
    nullif(btrim(p_name), ''),
    (select pr.name from products pr where pr.id = p_product_id)
  )), '');
$$;

-- SECURITY DEFINER so the aggregates are reliable, but every query is pinned to
-- the caller via auth.uid(). There is deliberately no parameter to point this at
-- another user.
create or replace function public.get_target_advisor_facts()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid           uuid := auth.uid();
  v_plan          record;
  v_month         record;
  v_mtd_rev       numeric := 0;
  v_mtd_qty       numeric := 0;
  v_days_left     int;
  v_visits_90     int;
  v_buyers_90     int;
  v_dormant       int;
  v_today         jsonb;
  v_schemes       jsonb;
  v_top_sku       record;
  v_has_beat_plan boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select bp.id, bp.year, bp.revenue_target, bp.quantity_target, bp.quantity_unit
    into v_plan
    from user_business_plans bp
   where bp.user_id = v_uid
   order by bp.year desc
   limit 1;

  select m.month_number, m.revenue_target, m.quantity_target, m.working_days
    into v_month
    from user_business_plan_months m
   where m.business_plan_id = v_plan.id
     and m.month_number = extract(month from current_date)::int;

  select coalesce(sum(o.total_amount), 0)
    into v_mtd_rev
    from orders o
   where o.user_id = v_uid
     and o.status <> 'cancelled'
     and date_trunc('month', o.order_date) = date_trunc('month', current_date);

  select coalesce(sum(oi.quantity), 0)
    into v_mtd_qty
    from order_items oi
    join orders o on o.id = oi.order_id
   where o.user_id = v_uid
     and o.status <> 'cancelled'
     and date_trunc('month', o.order_date) = date_trunc('month', current_date);

  -- Working days remaining, from the plan's own working_days scaled by how much
  -- of the month is left. Better than counting weekdays: the plan already knows
  -- this business's holidays.
  v_days_left := greatest(
    1,
    round(
      coalesce(v_month.working_days, 25)::numeric
      * (extract(day from date_trunc('month', current_date) + interval '1 month' - interval '1 day')
         - extract(day from current_date) + 1)
      / extract(day from date_trunc('month', current_date) + interval '1 month' - interval '1 day')
    )::int
  );

  -- Coverage vs conversion — the single most useful diagnostic. It says whether
  -- to visit more people or sell harder to the ones already being visited.
  select count(*) into v_visits_90
    from visits v
   where v.user_id = v_uid and v.retailer_id is not null
     and v.planned_date >= current_date - 90;

  select count(distinct o.retailer_id) into v_buyers_90
    from orders o
   where o.user_id = v_uid and o.status <> 'cancelled'
     and o.order_date >= current_date - 90;

  select count(*) into v_dormant
    from (
      select o.retailer_id, max(o.order_date) last_order
        from orders o
       where o.user_id = v_uid and o.status <> 'cancelled'
       group by o.retailer_id
    ) t
   where t.last_order < current_date - 45;

  select exists (
    select 1 from beat_plans b
     where b.user_id = v_uid and b.plan_date = current_date
  ) into v_has_beat_plan;

  -- The call list: today's beat when there is one, otherwise the highest-value
  -- lapsed accounts, so the screen is never empty.
  with scope as (
    select r.id, r.name
      from retailers r
     where r.beat_id in (
             select b.beat_id from beat_plans b
              where b.user_id = v_uid and b.plan_date = current_date
           )
       and v_has_beat_plan
    union
    select r.id, r.name
      from retailers r
     where not v_has_beat_plan
       and r.id in (
             select o.retailer_id from orders o
              where o.user_id = v_uid and o.status <> 'cancelled'
           )
  ),
  hist as (
    select o.retailer_id,
           max(o.order_date)                                    as last_order,
           count(*) filter (where o.order_date >= current_date - 90) as orders_90,
           round(avg(o.total_amount) filter (where o.order_date >= current_date - 90)) as avg_value,
           round(sum(coalesce(o.credit_pending_amount, 0)))      as dues
      from orders o
     where o.user_id = v_uid and o.status <> 'cancelled'
     group by o.retailer_id
  ),
  ranked as (
    select s.id, s.name,
           h.last_order, h.orders_90, h.avg_value, h.dues,
           (current_date - h.last_order) as days_silent,
           -- Their own buying rhythm, so "due today" means their normal gap
           -- rather than an arbitrary threshold.
           case when h.orders_90 > 1 then round(90.0 / h.orders_90) end as cadence_days,
           (select oi_product_label(oi.product_name, oi.product_id)
              from order_items oi join orders o2 on o2.id = oi.order_id
             where o2.retailer_id = s.id and o2.user_id = v_uid
               and oi_product_label(oi.product_name, oi.product_id) is not null
             group by oi_product_label(oi.product_name, oi.product_id)
             order by sum(oi.total) desc limit 1) as usual_sku,
           -- Expected value, discounted the longer they have been silent.
           coalesce(h.avg_value, 0)
             * case when (current_date - h.last_order) > 90 then 0.4
                    when (current_date - h.last_order) > 45 then 0.7
                    else 1.0 end as expected
      from scope s
      left join hist h on h.retailer_id = s.id
     where h.avg_value is not null
  )
  select jsonb_agg(x order by x.expected desc)
    into v_today
    from (
      select name, expected::int as expected, days_silent, cadence_days,
             coalesce(dues, 0)::int as dues, usual_sku, avg_value::int as avg_value
        from ranked
       order by expected desc
       limit 8
    ) x;

  select jsonb_agg(jsonb_build_object(
           'name', ps.name,
           'endsIn', (ps.end_date - current_date)
         ))
    into v_schemes
    from product_schemes ps
   where ps.is_active and ps.end_date >= current_date;

  select oi_product_label(oi.product_name, oi.product_id) as label,
         round(sum(oi.total)) as value
    into v_top_sku
    from order_items oi join orders o on o.id = oi.order_id
   where o.user_id = v_uid and o.status <> 'cancelled'
     and o.order_date >= current_date - 90
     and oi_product_label(oi.product_name, oi.product_id) is not null
   group by oi_product_label(oi.product_name, oi.product_id)
   order by sum(oi.total) desc
   limit 1;

  return jsonb_build_object(
    'pace', jsonb_build_object(
      'monthRevenueTarget', round(coalesce(v_month.revenue_target, 0)),
      'monthQuantityTarget', round(coalesce(v_month.quantity_target, 0)),
      'quantityUnit', coalesce(v_plan.quantity_unit, 'Kg'),
      'mtdRevenue', round(v_mtd_rev),
      'mtdQuantity', round(v_mtd_qty),
      'workingDaysLeft', v_days_left,
      'requiredPerDay', round(greatest(0, coalesce(v_month.revenue_target, 0) - v_mtd_rev) / v_days_left),
      'gap', round(greatest(0, coalesce(v_month.revenue_target, 0) - v_mtd_rev)),
      'planYear', v_plan.year
    ),
    'today', coalesce(v_today, '[]'::jsonb),
    'listSource', case when v_has_beat_plan then 'beat_plan' else 'lapsed_accounts' end,
    'diagnosis', jsonb_build_object(
      'visits90', v_visits_90,
      'buyers90', v_buyers_90,
      'strikeRate', case when v_visits_90 > 0
                         then round(100.0 * v_buyers_90 / v_visits_90) else null end,
      'dormantOver45d', v_dormant
    ),
    'levers', jsonb_build_object(
      'schemes', coalesce(v_schemes, '[]'::jsonb),
      'topSku', v_top_sku.label,
      'topSkuValue', v_top_sku.value
    ),
    'generatedFor', current_date
  );
end;
$function$;

revoke all on function public.get_target_advisor_facts() from public, anon;
grant execute on function public.get_target_advisor_facts() to authenticated;
grant execute on function public.oi_product_label(text, uuid) to authenticated;
