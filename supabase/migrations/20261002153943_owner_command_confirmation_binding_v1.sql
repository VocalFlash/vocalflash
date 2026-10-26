
drop function if exists public.vf_commit_owner_schedule_action_v1(uuid,uuid,uuid,uuid,text,timestamptz,boolean);
drop function if exists public.vf_commit_owner_note_v1(uuid,uuid,uuid,uuid,text,boolean);

create or replace function public.vf_record_owner_command_confirmation_v1(
  p_business_id uuid,
  p_member_id uuid,
  p_channel_id uuid,
  p_external_message_id text,
  p_proposal_event_id uuid,
  p_normalized_text text,
  p_occurred_at timestamptz,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_event_id uuid;
  v_existing uuid;
  v_source_event_id text;
begin
  if p_external_message_id is null or length(btrim(p_external_message_id))=0 then
    return jsonb_build_object('ok',false,'status','INVALID','reason','EXTERNAL_MESSAGE_ID_REQUIRED');
  end if;

  if not exists(
    select 1 from public.business_members m
    where m.id=p_member_id and m.business_id=p_business_id and m.is_active=true
  ) then
    return jsonb_build_object('ok',false,'status','DENIED','reason','MEMBER_NOT_ACTIVE');
  end if;

  if not exists(
    select 1 from public.business_channels c
    where c.id=p_channel_id and c.business_id=p_business_id and c.is_active=true
  ) then
    return jsonb_build_object('ok',false,'status','DENIED','reason','CHANNEL_NOT_ACTIVE');
  end if;

  select e.payload->>'owner_command_source_event_id'
    into v_source_event_id
  from public.work_events e
  where e.id=p_proposal_event_id
    and e.business_id=p_business_id
    and e.business_member_id=p_member_id
    and e.event_type='owner_command_proposal';

  if v_source_event_id is null then
    return jsonb_build_object('ok',false,'status','DENIED','reason','PROPOSAL_NOT_FOUND');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_business_id::text||':confirm:'||p_channel_id::text||':'||p_external_message_id,0)
  );

  insert into public.work_events(
    business_id,business_member_id,business_channel_id,
    actor_type,direction,event_type,channel_type,content_type,
    normalized_text,external_message_id,payload,occurred_at
  )
  values(
    p_business_id,p_member_id,p_channel_id,
    'member','internal','owner_command_confirmation','whatsapp','text',
    p_normalized_text,p_external_message_id,
    coalesce(p_payload,'{}'::jsonb) || jsonb_build_object(
      'proposal_event_id',p_proposal_event_id::text,
      'owner_command_source_event_id',v_source_event_id
    ),
    coalesce(p_occurred_at,now())
  )
  on conflict do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select e.id into v_existing
    from public.work_events e
    where e.business_channel_id=p_channel_id
      and e.external_message_id=p_external_message_id
    limit 1;

    return jsonb_build_object(
      'ok',true,'status','CONFIRMATION_EXISTS',
      'confirmation_event_id',v_existing,'replayed',true,
      'proposal_event_id',p_proposal_event_id
    );
  end if;

  return jsonb_build_object(
    'ok',true,'status','CONFIRMATION_RECORDED',
    'confirmation_event_id',v_event_id,'replayed',false,
    'proposal_event_id',p_proposal_event_id
  );
end;
$$;

create or replace function public.vf_commit_owner_schedule_action_v1(
  p_business_id uuid,
  p_work_item_id uuid,
  p_member_id uuid,
  p_source_event_id uuid,
  p_title text,
  p_due_at timestamptz,
  p_confirmed boolean default false,
  p_proposal_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_permissions jsonb;
  v_workflow_id uuid;
  v_scope_mode text;
  v_ids jsonb;
  v_modes text[];
  v_effective_mode text;
  v_action_id uuid;
  v_proposal_payload jsonb;
  v_proposal_due_at timestamptz;
begin
  if p_title is null or length(btrim(p_title))=0 or p_due_at is null then
    return jsonb_build_object('ok',false,'status','INVALID','reason','ACTION_DATA_REQUIRED');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_business_id::text||':action:'||p_source_event_id::text,0)
  );

  select m.permissions into v_permissions
  from public.business_members m
  where m.id=p_member_id and m.business_id=p_business_id and m.is_active=true;

  if v_permissions is null then
    return jsonb_build_object('ok',false,'status','DENIED','reason','MEMBER_NOT_ACTIVE');
  end if;

  if jsonb_typeof(v_permissions)<>'object'
     or coalesce((v_permissions->>'version')::int,0)<>1
     or jsonb_typeof(v_permissions->'grants')<>'array'
     or jsonb_typeof(v_permissions->'work_items')<>'object'
     or not (v_permissions->'grants' ? 'schedule_action') then
    return jsonb_build_object('ok',false,'status','DENIED','reason','PERMISSION_REQUIRED');
  end if;

  v_scope_mode:=v_permissions->'work_items'->>'mode';
  v_ids:=v_permissions->'work_items'->'ids';

  if v_scope_mode='explicit' then
    if jsonb_typeof(v_ids)<>'array' or not (v_ids ? p_work_item_id::text) then
      return jsonb_build_object('ok',false,'status','DENIED','reason','WORK_ITEM_NOT_AUTHORIZED');
    end if;
  elsif v_scope_mode<>'business' then
    return jsonb_build_object('ok',false,'status','CONFIG_REQUIRED','reason','INVALID_WORK_ITEM_SCOPE');
  end if;

  select w.workflow_id into v_workflow_id
  from public.work_items w
  where w.id=p_work_item_id and w.business_id=p_business_id and w.lifecycle_status='open';

  if not found then
    return jsonb_build_object('ok',false,'status','DENIED','reason','WORK_ITEM_NOT_OPEN');
  end if;

  if not exists(
    select 1 from public.work_events e
    where e.id=p_source_event_id
      and e.business_id=p_business_id
      and e.business_member_id=p_member_id
      and e.event_type='owner_command_received'
  ) then
    return jsonb_build_object('ok',false,'status','DENIED','reason','SOURCE_EVENT_INVALID');
  end if;

  select array_agg(p.autonomy_mode order by case p.scope when 'business' then 1 else 2 end)
    into v_modes
  from public.assistant_policies p
  where p.business_id=p_business_id
    and p.policy_key='schedule_action'
    and p.is_active=true
    and (
      (p.scope='business' and p.workflow_id is null)
      or
      (p.scope='workflow' and p.workflow_id=v_workflow_id)
    );

  if v_modes is null or array_length(v_modes,1) is null then
    return jsonb_build_object('ok',false,'status','CONFIG_REQUIRED','reason','POLICY_NOT_RESOLVED');
  end if;

  if 'forbidden'=any(v_modes) then
    return jsonb_build_object('ok',false,'status','DENIED','reason','POLICY_FORBIDDEN');
  elsif 'professional_only'=any(v_modes) then
    return jsonb_build_object('ok',false,'status','HANDOFF_REQUIRED','reason','PROFESSIONAL_ONLY');
  elsif 'confirm'=any(v_modes) then
    v_effective_mode:='confirm';
  else
    v_effective_mode:='auto';
  end if;

  if v_effective_mode='confirm' then
    if p_confirmed is not true then
      return jsonb_build_object('ok',true,'status','CONFIRMATION_REQUIRED','reason','POLICY_CONFIRM','notification_scheduled',false);
    end if;

    if p_proposal_event_id is null then
      return jsonb_build_object('ok',false,'status','DENIED','reason','PROPOSAL_REQUIRED');
    end if;

    select e.payload into v_proposal_payload
    from public.work_events e
    where e.id=p_proposal_event_id
      and e.business_id=p_business_id
      and e.work_item_id=p_work_item_id
      and e.business_member_id=p_member_id
      and e.event_type='owner_command_proposal'
      and e.payload->>'owner_command_source_event_id'=p_source_event_id::text;

    if v_proposal_payload is null then
      return jsonb_build_object('ok',false,'status','DENIED','reason','PROPOSAL_NOT_FOUND');
    end if;

    if v_proposal_payload->>'intent'<>'schedule_action'
       or btrim(coalesce(v_proposal_payload->>'title',''))<>btrim(p_title) then
      return jsonb_build_object('ok',false,'status','DENIED','reason','PROPOSAL_CHANGED');
    end if;

    begin
      v_proposal_due_at:=(v_proposal_payload->>'due_at')::timestamptz;
    exception when others then
      return jsonb_build_object('ok',false,'status','CONFIG_REQUIRED','reason','PROPOSAL_DUE_AT_INVALID');
    end;

    if v_proposal_due_at is distinct from p_due_at then
      return jsonb_build_object('ok',false,'status','DENIED','reason','PROPOSAL_CHANGED');
    end if;
  end if;

  insert into public.open_actions(
    business_id,work_item_id,action_key,title,status,autonomy_mode,
    assigned_member_id,due_at,metadata
  )
  values(
    p_business_id,p_work_item_id,'owner_command_reminder',btrim(p_title),'open',
    v_effective_mode,p_member_id,p_due_at,
    jsonb_build_object(
      'owner_command_source_event_id',p_source_event_id::text,
      'proposal_event_id',case when p_proposal_event_id is null then null else p_proposal_event_id::text end,
      'notification_scheduled',false
    )
  )
  on conflict do nothing
  returning id into v_action_id;

  if v_action_id is null then
    select a.id into v_action_id
    from public.open_actions a
    where a.business_id=p_business_id
      and a.metadata->>'owner_command_source_event_id'=p_source_event_id::text
    limit 1;

    return jsonb_build_object(
      'ok',true,'status','ACTION_EXISTS','action_id',v_action_id,
      'replayed',true,'notification_scheduled',false
    );
  end if;

  insert into public.work_events(
    business_id,work_item_id,business_member_id,
    actor_type,direction,event_type,content_type,payload,occurred_at
  )
  values(
    p_business_id,p_work_item_id,p_member_id,
    'assistant','internal','owner_command_action_created','application/json',
    jsonb_build_object(
      'owner_command_source_event_id',p_source_event_id::text,
      'proposal_event_id',case when p_proposal_event_id is null then null else p_proposal_event_id::text end,
      'action_id',v_action_id::text,
      'notification_scheduled',false
    ),
    now()
  );

  return jsonb_build_object(
    'ok',true,'status','ACTION_CREATED','action_id',v_action_id,
    'replayed',false,'notification_scheduled',false,
    'message','Attività registrata con scadenza. Nessuna notifica è stata programmata.'
  );
end;
$$;

create or replace function public.vf_commit_owner_note_v1(
  p_business_id uuid,
  p_work_item_id uuid,
  p_member_id uuid,
  p_source_event_id uuid,
  p_note text,
  p_confirmed boolean default false,
  p_proposal_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_permissions jsonb;
  v_workflow_id uuid;
  v_scope_mode text;
  v_ids jsonb;
  v_modes text[];
  v_effective_mode text;
  v_note_event_id uuid;
  v_proposal_payload jsonb;
begin
  if p_note is null or length(btrim(p_note))=0 then
    return jsonb_build_object('ok',false,'status','INVALID','reason','NOTE_REQUIRED');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_business_id::text||':note:'||p_source_event_id::text,0)
  );

  select m.permissions into v_permissions
  from public.business_members m
  where m.id=p_member_id and m.business_id=p_business_id and m.is_active=true;

  if v_permissions is null then
    return jsonb_build_object('ok',false,'status','DENIED','reason','MEMBER_NOT_ACTIVE');
  end if;

  if jsonb_typeof(v_permissions)<>'object'
     or coalesce((v_permissions->>'version')::int,0)<>1
     or jsonb_typeof(v_permissions->'grants')<>'array'
     or jsonb_typeof(v_permissions->'work_items')<>'object'
     or not (v_permissions->'grants' ? 'add_note') then
    return jsonb_build_object('ok',false,'status','DENIED','reason','PERMISSION_REQUIRED');
  end if;

  v_scope_mode:=v_permissions->'work_items'->>'mode';
  v_ids:=v_permissions->'work_items'->'ids';

  if v_scope_mode='explicit' then
    if jsonb_typeof(v_ids)<>'array' or not (v_ids ? p_work_item_id::text) then
      return jsonb_build_object('ok',false,'status','DENIED','reason','WORK_ITEM_NOT_AUTHORIZED');
    end if;
  elsif v_scope_mode<>'business' then
    return jsonb_build_object('ok',false,'status','CONFIG_REQUIRED','reason','INVALID_WORK_ITEM_SCOPE');
  end if;

  select w.workflow_id into v_workflow_id
  from public.work_items w
  where w.id=p_work_item_id and w.business_id=p_business_id and w.lifecycle_status='open';

  if not found then
    return jsonb_build_object('ok',false,'status','DENIED','reason','WORK_ITEM_NOT_OPEN');
  end if;

  if not exists(
    select 1 from public.work_events e
    where e.id=p_source_event_id
      and e.business_id=p_business_id
      and e.business_member_id=p_member_id
      and e.event_type='owner_command_received'
  ) then
    return jsonb_build_object('ok',false,'status','DENIED','reason','SOURCE_EVENT_INVALID');
  end if;

  select array_agg(p.autonomy_mode order by case p.scope when 'business' then 1 else 2 end)
    into v_modes
  from public.assistant_policies p
  where p.business_id=p_business_id
    and p.policy_key='add_note'
    and p.is_active=true
    and (
      (p.scope='business' and p.workflow_id is null)
      or
      (p.scope='workflow' and p.workflow_id=v_workflow_id)
    );

  if v_modes is null or array_length(v_modes,1) is null then
    return jsonb_build_object('ok',false,'status','CONFIG_REQUIRED','reason','POLICY_NOT_RESOLVED');
  end if;

  if 'forbidden'=any(v_modes) then
    return jsonb_build_object('ok',false,'status','DENIED','reason','POLICY_FORBIDDEN');
  elsif 'professional_only'=any(v_modes) then
    return jsonb_build_object('ok',false,'status','HANDOFF_REQUIRED','reason','PROFESSIONAL_ONLY');
  elsif 'confirm'=any(v_modes) then
    v_effective_mode:='confirm';
  else
    v_effective_mode:='auto';
  end if;

  if v_effective_mode='confirm' then
    if p_confirmed is not true then
      return jsonb_build_object('ok',true,'status','CONFIRMATION_REQUIRED','reason','POLICY_CONFIRM');
    end if;

    if p_proposal_event_id is null then
      return jsonb_build_object('ok',false,'status','DENIED','reason','PROPOSAL_REQUIRED');
    end if;

    select e.payload into v_proposal_payload
    from public.work_events e
    where e.id=p_proposal_event_id
      and e.business_id=p_business_id
      and e.work_item_id=p_work_item_id
      and e.business_member_id=p_member_id
      and e.event_type='owner_command_proposal'
      and e.payload->>'owner_command_source_event_id'=p_source_event_id::text;

    if v_proposal_payload is null then
      return jsonb_build_object('ok',false,'status','DENIED','reason','PROPOSAL_NOT_FOUND');
    end if;

    if v_proposal_payload->>'intent'<>'add_note'
       or btrim(coalesce(v_proposal_payload->>'note',''))<>btrim(p_note) then
      return jsonb_build_object('ok',false,'status','DENIED','reason','PROPOSAL_CHANGED');
    end if;
  end if;

  insert into public.work_events(
    business_id,work_item_id,business_member_id,
    actor_type,direction,event_type,content_type,normalized_text,payload,occurred_at
  )
  values(
    p_business_id,p_work_item_id,p_member_id,
    'member','internal','owner_command_note_added','text',btrim(p_note),
    jsonb_build_object(
      'owner_command_source_event_id',p_source_event_id::text,
      'proposal_event_id',case when p_proposal_event_id is null then null else p_proposal_event_id::text end,
      'provenance','member_statement',
      'verification_status','unverified'
    ),
    now()
  )
  on conflict do nothing
  returning id into v_note_event_id;

  if v_note_event_id is null then
    select e.id into v_note_event_id
    from public.work_events e
    where e.business_id=p_business_id
      and e.event_type='owner_command_note_added'
      and e.payload->>'owner_command_source_event_id'=p_source_event_id::text
    limit 1;

    return jsonb_build_object(
      'ok',true,'status','NOTE_EXISTS','note_event_id',v_note_event_id,
      'replayed',true,'provenance','member_statement','verification_status','unverified'
    );
  end if;

  return jsonb_build_object(
    'ok',true,'status','NOTE_ADDED','note_event_id',v_note_event_id,
    'replayed',false,'provenance','member_statement','verification_status','unverified'
  );
end;
$$;

revoke all on function public.vf_record_owner_command_confirmation_v1(uuid,uuid,uuid,text,uuid,text,timestamptz,jsonb)
from public,anon,authenticated;
grant execute on function public.vf_record_owner_command_confirmation_v1(uuid,uuid,uuid,text,uuid,text,timestamptz,jsonb)
to service_role;

revoke all on function public.vf_commit_owner_schedule_action_v1(uuid,uuid,uuid,uuid,text,timestamptz,boolean,uuid)
from public,anon,authenticated;
grant execute on function public.vf_commit_owner_schedule_action_v1(uuid,uuid,uuid,uuid,text,timestamptz,boolean,uuid)
to service_role;

revoke all on function public.vf_commit_owner_note_v1(uuid,uuid,uuid,uuid,text,boolean,uuid)
from public,anon,authenticated;
grant execute on function public.vf_commit_owner_note_v1(uuid,uuid,uuid,uuid,text,boolean,uuid)
to service_role;
