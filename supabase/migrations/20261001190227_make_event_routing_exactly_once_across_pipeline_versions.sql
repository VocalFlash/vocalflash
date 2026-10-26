
drop index if exists public.event_routing_decisions_event_idx;

alter table public.event_routing_decisions
  drop constraint if exists event_routing_decisions_once_per_pipeline;

alter table public.event_routing_decisions
  add constraint event_routing_decisions_once_per_event
  unique (business_id,event_id);

create index event_routing_decisions_event_idx
  on public.event_routing_decisions(business_id,event_id,created_at desc);

create or replace function public.vf_commit_routing_decision_v1(
  p_business_id uuid,
  p_event_id uuid,
  p_pipeline_version text,
  p_decision_payload jsonb,
  p_matches jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_pipeline_version text := btrim(coalesce(p_pipeline_version,''));
  v_existing public.event_routing_decisions%rowtype;
  v_decision_id uuid;
  v_match jsonb;
  v_work_item_id uuid;
  v_confidence numeric;
  v_reason text;
  v_link_id uuid;
  v_links jsonb := '[]'::jsonb;
begin
  if length(v_pipeline_version) < 1 or length(v_pipeline_version) > 100 then
    raise exception 'invalid_pipeline_version';
  end if;

  if p_decision_payload is null or jsonb_typeof(p_decision_payload) <> 'object' then
    raise exception 'decision_payload_must_be_object';
  end if;

  if p_matches is null or jsonb_typeof(p_matches) <> 'array' then
    raise exception 'matches_must_be_array';
  end if;

  if not exists (
    select 1 from public.work_events e
    where e.id=p_event_id and e.business_id=p_business_id
  ) then
    raise exception 'event_not_in_business';
  end if;

  -- Automatic routing is exactly once per event, regardless of software version.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_business_id::text || ':' || p_event_id::text,0
    )
  );

  select * into v_existing
  from public.event_routing_decisions d
  where d.business_id=p_business_id
    and d.event_id=p_event_id
  limit 1;

  if found then
    select coalesce(jsonb_agg(jsonb_build_object(
      'work_item_id',l.work_item_id,
      'link_id',l.id,
      'created',false
    ) order by l.created_at,l.id),'[]'::jsonb)
    into v_links
    from public.work_event_links l
    where l.business_id=p_business_id
      and l.event_id=p_event_id
      and l.decision_type='link'
      and l.metadata->>'routing_decision_id'=v_existing.id::text
      and not exists (
        select 1 from public.work_event_links r
        where r.decision_type='revoke' and r.reverses_link_id=l.id
      );

    return jsonb_build_object(
      'decision_id',v_existing.id,
      'created',false,
      'pipeline_version',v_existing.pipeline_version,
      'decision_payload',v_existing.decision_payload,
      'links',v_links
    );
  end if;

  -- Validate all targets before creating either audit decision or links.
  for v_match in select value from jsonb_array_elements(p_matches)
  loop
    begin
      v_work_item_id := (v_match->>'work_item_id')::uuid;
    exception when others then
      raise exception 'invalid_work_item_id';
    end;

    v_confidence := nullif(v_match->>'confidence','')::numeric;
    if v_confidence is not null and (v_confidence < 0 or v_confidence > 1) then
      raise exception 'confidence_out_of_range';
    end if;

    if not exists (
      select 1 from public.work_items w
      where w.id=v_work_item_id
        and w.business_id=p_business_id
        and w.lifecycle_status='open'
    ) then
      raise exception 'open_work_item_not_in_business';
    end if;
  end loop;

  insert into public.event_routing_decisions(
    business_id,event_id,pipeline_version,decision_payload,metadata
  ) values(
    p_business_id,p_event_id,v_pipeline_version,p_decision_payload,
    jsonb_build_object('committer_version','vf_commit_routing_decision_v1')
  )
  returning id into v_decision_id;

  for v_match in
    select distinct on ((value->>'work_item_id')::uuid) value
    from jsonb_array_elements(p_matches)
    order by (value->>'work_item_id')::uuid
  loop
    v_work_item_id := (v_match->>'work_item_id')::uuid;
    v_confidence := nullif(v_match->>'confidence','')::numeric;
    v_reason := left(coalesce(v_match->>'reason','Resolver MATCH'),2000);

    insert into public.work_event_links(
      business_id,event_id,work_item_id,decision_type,resolution_method,
      confidence,reason,metadata
    ) values(
      p_business_id,p_event_id,v_work_item_id,'link','resolver',
      v_confidence,v_reason,
      jsonb_build_object(
        'writer_version','routing_commit_v1',
        'routing_decision_id',v_decision_id::text,
        'pipeline_version',v_pipeline_version,
        'unit_id',v_match->>'unit_id',
        'routing_text',left(coalesce(v_match->>'routing_text',''),4000),
        'resolver_evidence',coalesce(v_match->'evidence','[]'::jsonb)
      )
    )
    returning id into v_link_id;

    v_links := v_links || jsonb_build_array(jsonb_build_object(
      'work_item_id',v_work_item_id,
      'link_id',v_link_id,
      'created',true
    ));
  end loop;

  return jsonb_build_object(
    'decision_id',v_decision_id,
    'created',true,
    'pipeline_version',v_pipeline_version,
    'decision_payload',p_decision_payload,
    'links',v_links
  );
end;
$$;

revoke all on function public.vf_commit_routing_decision_v1(uuid,uuid,text,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.vf_commit_routing_decision_v1(uuid,uuid,text,jsonb,jsonb)
  to service_role;
