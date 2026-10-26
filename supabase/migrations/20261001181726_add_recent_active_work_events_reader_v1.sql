
create or replace function public.vf_recent_active_work_events_v1(
  p_business_id uuid,
  p_work_item_ids uuid[],
  p_per_item_limit integer default 8
)
returns table(
  work_item_id uuid,
  event_id uuid,
  actor_type text,
  content_type text,
  normalized_text text,
  occurred_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  with active_links as (
    select distinct on (l.work_item_id, l.event_id)
      l.work_item_id,
      l.event_id,
      l.created_at
    from public.work_event_links l
    where l.business_id = p_business_id
      and l.work_item_id = any(p_work_item_ids)
      and l.decision_type = 'link'
      and not exists (
        select 1
        from public.work_event_links r
        where r.decision_type = 'revoke'
          and r.reverses_link_id = l.id
      )
    order by l.work_item_id, l.event_id, l.created_at desc
  ),
  ranked as (
    select
      a.work_item_id,
      e.id as event_id,
      e.actor_type,
      e.content_type,
      e.normalized_text,
      e.occurred_at,
      row_number() over (
        partition by a.work_item_id
        order by e.occurred_at desc, e.id desc
      ) as rn
    from active_links a
    join public.work_events e
      on e.id = a.event_id
     and e.business_id = p_business_id
  )
  select
    ranked.work_item_id,
    ranked.event_id,
    ranked.actor_type,
    ranked.content_type,
    ranked.normalized_text,
    ranked.occurred_at
  from ranked
  where ranked.rn <= greatest(1, least(coalesce(p_per_item_limit,8),20))
  order by ranked.work_item_id, ranked.occurred_at desc, ranked.event_id desc;
$$;

revoke all on function public.vf_recent_active_work_events_v1(uuid,uuid[],integer) from public, anon, authenticated;
grant execute on function public.vf_recent_active_work_events_v1(uuid,uuid[],integer) to service_role;
