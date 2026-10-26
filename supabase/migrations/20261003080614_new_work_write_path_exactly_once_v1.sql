create unique index if not exists work_items_new_work_dedupe_uidx
on public.work_items (business_id, (metadata->>'new_work_dedupe_key'))
where metadata ? 'new_work_dedupe_key';

create unique index if not exists work_event_links_event_work_link_uidx
on public.work_event_links (business_id,event_id,work_item_id)
where decision_type='link';

create or replace function public.vf_commit_new_work_item_v1(
  p_business_id uuid,
  p_event_id uuid,
  p_unit_id text,
  p_workflow_id uuid,
  p_provided_data jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_contact_id uuid;
  v_event_text text;
  v_decision_id uuid;
  v_payload jsonb;
  v_unit jsonb;
  v_route jsonb;
  v_workflow_name text;
  v_required jsonb;
  v_required_keys text[] := array[]::text[];
  v_provided_keys text[] := array[]::text[];
  v_modes text[];
  v_effective text;
  v_dedupe_key text;
  v_work_item_id uuid;
  v_link_id uuid;
  v_confidence numeric;
  v_item jsonb;
  v_key text;
  v_value text;
  v_label text;
begin
  if p_unit_id is null or length(btrim(p_unit_id))=0 then
    return jsonb_build_object('ok',false,'status','INVALID','reason','UNIT_ID_REQUIRED');
  end if;
  if p_provided_data is null then p_provided_data := '[]'::jsonb; end if;
  if jsonb_typeof(p_provided_data) <> 'array' then
    return jsonb_build_object('ok',false,'status','INVALID','reason','PROVIDED_DATA_MUST_BE_ARRAY');
  end if;

  v_dedupe_key := p_event_id::text || ':' || btrim(p_unit_id) || ':' || p_workflow_id::text;
  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':new-work:' || v_dedupe_key,0));

  select e.contact_id,e.normalized_text into v_contact_id,v_event_text
  from public.work_events e
  where e.id=p_event_id and e.business_id=p_business_id
    and e.direction='inbound' and e.actor_type='customer' and e.contact_id is not null;
  if not found then
    return jsonb_build_object('ok',false,'status','DENIED','reason','SOURCE_EVENT_INVALID');
  end if;

  select d.id,d.decision_payload into v_decision_id,v_payload
  from public.event_routing_decisions d
  where d.business_id=p_business_id and d.event_id=p_event_id
  limit 1;
  if v_decision_id is null then
    return jsonb_build_object('ok',false,'status','CONFIG_REQUIRED','reason','ROUTING_DECISION_REQUIRED');
  end if;

  select u into v_unit
  from jsonb_array_elements(coalesce(v_payload->'units','[]'::jsonb)) u
  where u->>'unit_id'=btrim(p_unit_id)
  limit 1;
  if v_unit is null then
    return jsonb_build_object('ok',false,'status','DENIED','reason','ROUTING_UNIT_NOT_FOUND');
  end if;
  if coalesce(v_unit->>'next_action','') <> 'NEW_WORK_CANDIDATE_CLASSIFIED' then
    return jsonb_build_object('ok',false,'status','DENIED','reason','ROUTING_UNIT_NOT_NEW_CLASSIFIED');
  end if;
  if coalesce(v_unit->'classifier'->>'decision','') <> 'CLASSIFIED_SINGLE' then
    return jsonb_build_object('ok',false,'status','REVIEW_REQUIRED','reason','ONLY_CLASSIFIED_SINGLE_CAN_AUTO_CREATE');
  end if;
  if jsonb_array_length(coalesce(v_unit->'classifier'->'routes','[]'::jsonb)) <> 1 then
    return jsonb_build_object('ok',false,'status','REVIEW_REQUIRED','reason','SINGLE_ROUTE_REQUIRED');
  end if;

  select r into v_route
  from jsonb_array_elements(coalesce(v_unit->'classifier'->'routes','[]'::jsonb)) r
  where r->>'workflow_id'=p_workflow_id::text
  limit 1;
  if v_route is null then
    return jsonb_build_object('ok',false,'status','DENIED','reason','WORKFLOW_NOT_IN_ROUTING_DECISION');
  end if;

  select w.name,w.required_data into v_workflow_name,v_required
  from public.workflows w
  where w.id=p_workflow_id and w.business_id=p_business_id and w.is_active=true;
  if not found then
    return jsonb_build_object('ok',false,'status','DENIED','reason','WORKFLOW_NOT_ACTIVE');
  end if;

  select array_agg(p.autonomy_mode order by case p.scope when 'business' then 1 else 2 end)
    into v_modes
  from public.assistant_policies p
  where p.business_id=p_business_id and p.policy_key='create_work_item' and p.is_active=true
    and ((p.scope='business' and p.workflow_id is null) or (p.scope='workflow' and p.workflow_id=p_workflow_id));
  if v_modes is null or array_length(v_modes,1) is null then
    return jsonb_build_object('ok',true,'status','CONFIG_REQUIRED','reason','CREATE_WORK_ITEM_POLICY_NOT_RESOLVED');
  end if;
  if 'forbidden'=any(v_modes) then v_effective:='forbidden';
  elsif 'professional_only'=any(v_modes) then v_effective:='professional_only';
  elsif 'confirm'=any(v_modes) then v_effective:='confirm';
  else v_effective:='auto'; end if;

  if v_effective='forbidden' then
    return jsonb_build_object('ok',true,'status','DENIED','reason','POLICY_FORBIDDEN');
  elsif v_effective='professional_only' then
    return jsonb_build_object('ok',true,'status','HANDOFF_REQUIRED','reason','PROFESSIONAL_ONLY');
  elsif v_effective='confirm' then
    return jsonb_build_object('ok',true,'status','CONFIRMATION_REQUIRED','reason','POLICY_CONFIRM');
  end if;

  -- Normalize configured required keys.
  if jsonb_typeof(v_required)='object' and v_required ? 'fields' and jsonb_typeof(v_required->'fields')='array' then
    select coalesce(array_agg(distinct k),'{}'::text[]) into v_required_keys
    from (
      select case when jsonb_typeof(x)='string' then btrim(x#>>'{}') else btrim(x->>'key') end k
      from jsonb_array_elements(v_required->'fields') x
    ) q where k is not null and k<>'';
  elsif jsonb_typeof(v_required)='object' then
    select coalesce(array_agg(k),'{}'::text[]) into v_required_keys from jsonb_object_keys(v_required) k;
  elsif jsonb_typeof(v_required)='array' then
    select coalesce(array_agg(distinct k),'{}'::text[]) into v_required_keys
    from (
      select case when jsonb_typeof(x)='string' then btrim(x#>>'{}') else btrim(x->>'key') end k
      from jsonb_array_elements(v_required) x
    ) q where k is not null and k<>'';
  end if;

  -- Validate provided data and collect keys.
  for v_item in select value from jsonb_array_elements(p_provided_data)
  loop
    if jsonb_typeof(v_item)<>'object' then
      return jsonb_build_object('ok',false,'status','INVALID','reason','PROVIDED_DATA_ITEM_INVALID');
    end if;
    v_key:=btrim(coalesce(v_item->>'key',''));
    v_value:=v_item->>'value';
    if v_key='' or v_value is null or length(btrim(v_value))=0 then
      return jsonb_build_object('ok',false,'status','INVALID','reason','PROVIDED_DATA_KEY_VALUE_REQUIRED');
    end if;
    if not (v_key=any(v_required_keys)) then
      return jsonb_build_object('ok',false,'status','DENIED','reason','PROVIDED_DATA_KEY_NOT_CONFIGURED','field_key',v_key);
    end if;
    if v_key=any(v_provided_keys) then
      return jsonb_build_object('ok',false,'status','INVALID','reason','PROVIDED_DATA_DUPLICATE_KEY','field_key',v_key);
    end if;
    v_provided_keys:=array_append(v_provided_keys,v_key);
  end loop;

  if cardinality(v_required_keys)>0 then
    if exists(select 1 from unnest(v_required_keys) rk where not (rk=any(v_provided_keys))) then
      return jsonb_build_object('ok',true,'status','DATA_COLLECTION_REQUIRED','reason','REQUIRED_DATA_INCOMPLETE');
    end if;
  elsif jsonb_array_length(p_provided_data)>0 then
    return jsonb_build_object('ok',false,'status','DENIED','reason','NO_REQUIRED_DATA_CONFIGURED');
  end if;

  select wi.id into v_work_item_id
  from public.work_items wi
  where wi.business_id=p_business_id and wi.metadata->>'new_work_dedupe_key'=v_dedupe_key
  limit 1;
  if v_work_item_id is not null then
    return jsonb_build_object('ok',true,'status','WORK_ITEM_EXISTS','work_item_id',v_work_item_id,'replayed',true);
  end if;

  insert into public.work_items(
    business_id,workflow_id,title,work_type,lifecycle_status,workflow_state,summary,metadata
  ) values(
    p_business_id,p_workflow_id,v_workflow_name,coalesce(v_route->>'work_type',v_workflow_name),
    'open','new',left(v_event_text,2000),
    jsonb_build_object(
      'new_work_dedupe_key',v_dedupe_key,
      'new_work_source_event_id',p_event_id::text,
      'new_work_unit_id',btrim(p_unit_id),
      'routing_decision_id',v_decision_id::text,
      'creation_policy','auto'
    )
  ) returning id into v_work_item_id;

  insert into public.work_participants(business_id,work_item_id,contact_id,participant_role,metadata)
  values(p_business_id,v_work_item_id,v_contact_id,'primary',jsonb_build_object('source','new_work_write_path_v1'));

  for v_item in select value from jsonb_array_elements(p_provided_data)
  loop
    v_key:=btrim(v_item->>'key');
    v_value:=v_item->>'value';
    v_label:=nullif(btrim(coalesce(v_item->>'label','')),'');
    insert into public.work_data(
      business_id,work_item_id,field_key,field_label,value,data_status,source_event_id,metadata
    ) values(
      p_business_id,v_work_item_id,v_key,v_label,to_jsonb(v_value),'collected',p_event_id,
      jsonb_build_object('source','required_data_extractor_v1','evidence',v_item->'evidence','confidence',v_item->'confidence')
    );
  end loop;

  begin
    v_confidence:=(v_route->>'confidence')::numeric;
  exception when others then
    v_confidence:=null;
  end;

  insert into public.work_event_links(
    business_id,event_id,work_item_id,decision_type,resolution_method,confidence,reason,metadata
  ) values(
    p_business_id,p_event_id,v_work_item_id,'link','resolver',v_confidence,
    'Nuova pratica creata da unità NEW classificata e autorizzata dalla policy create_work_item=auto.',
    jsonb_build_object('source','new_work_write_path_v1','unit_id',btrim(p_unit_id),'routing_decision_id',v_decision_id::text)
  ) returning id into v_link_id;

  return jsonb_build_object(
    'ok',true,'status','WORK_ITEM_CREATED','work_item_id',v_work_item_id,
    'work_event_link_id',v_link_id,'replayed',false,'policy_mode','auto'
  );
end;
$$;

revoke all on function public.vf_commit_new_work_item_v1(uuid,uuid,text,uuid,jsonb)
from public,anon,authenticated;
grant execute on function public.vf_commit_new_work_item_v1(uuid,uuid,text,uuid,jsonb)
to service_role;