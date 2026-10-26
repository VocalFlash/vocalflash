
create unique index if not exists work_events_owner_command_proposal_source_uidx
on public.work_events (
  business_id,
  (payload->>'owner_command_source_event_id')
)
where event_type = 'owner_command_proposal'
  and payload ? 'owner_command_source_event_id';

create or replace function public.vf_record_owner_command_proposal_v1(
  p_business_id uuid,
  p_work_item_id uuid,
  p_member_id uuid,
  p_source_event_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_existing uuid;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_business_id::text || ':proposal:' || p_source_event_id::text, 0)
  );

  if not exists (
    select 1
    from public.business_members m
    where m.id = p_member_id
      and m.business_id = p_business_id
      and m.is_active = true
  ) then
    return jsonb_build_object('ok', false, 'status', 'DENIED', 'reason', 'MEMBER_NOT_ACTIVE');
  end if;

  if not exists (
    select 1
    from public.work_events e
    where e.id = p_source_event_id
      and e.business_id = p_business_id
      and e.business_member_id = p_member_id
      and e.event_type = 'owner_command_received'
  ) then
    return jsonb_build_object('ok', false, 'status', 'DENIED', 'reason', 'SOURCE_EVENT_INVALID');
  end if;

  if not exists (
    select 1
    from public.work_items w
    where w.id = p_work_item_id
      and w.business_id = p_business_id
      and w.lifecycle_status = 'open'
  ) then
    return jsonb_build_object('ok', false, 'status', 'DENIED', 'reason', 'WORK_ITEM_NOT_OPEN');
  end if;

  insert into public.work_events (
    business_id,
    work_item_id,
    business_member_id,
    actor_type,
    direction,
    event_type,
    content_type,
    payload,
    occurred_at
  )
  values (
    p_business_id,
    p_work_item_id,
    p_member_id,
    'assistant',
    'internal',
    'owner_command_proposal',
    'application/json',
    coalesce(p_payload, '{}'::jsonb) ||
      jsonb_build_object('owner_command_source_event_id', p_source_event_id::text),
    now()
  )
  on conflict do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select e.id into v_existing
    from public.work_events e
    where e.business_id = p_business_id
      and e.event_type = 'owner_command_proposal'
      and e.payload->>'owner_command_source_event_id' = p_source_event_id::text
    limit 1;

    return jsonb_build_object(
      'ok', true,
      'status', 'PROPOSAL_EXISTS',
      'proposal_event_id', v_existing,
      'replayed', true
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'PROPOSAL_RECORDED',
    'proposal_event_id', v_event_id,
    'replayed', false
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
  p_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_permissions jsonb;
  v_workflow_id uuid;
  v_scope_mode text;
  v_ids jsonb;
  v_modes text[];
  v_effective_mode text;
  v_action_id uuid;
  v_created boolean := false;
begin
  if p_title is null or length(btrim(p_title)) = 0 or p_due_at is null then
    return jsonb_build_object('ok', false, 'status', 'INVALID', 'reason', 'ACTION_DATA_REQUIRED');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_business_id::text || ':action:' || p_source_event_id::text, 0)
  );

  select m.permissions
    into v_permissions
  from public.business_members m
  where m.id = p_member_id
    and m.business_id = p_business_id
    and m.is_active = true;

  if v_permissions is null then
    return jsonb_build_object('ok', false, 'status', 'DENIED', 'reason', 'MEMBER_NOT_ACTIVE');
  end if;

  if jsonb_typeof(v_permissions) <> 'object'
     or coalesce((v_permissions->>'version')::int, 0) <> 1
     or jsonb_typeof(v_permissions->'grants') <> 'array'
     or jsonb_typeof(v_permissions->'work_items') <> 'object'
     or not (v_permissions->'grants' ? 'schedule_action') then
    return jsonb_build_object('ok', false, 'status', 'DENIED', 'reason', 'PERMISSION_REQUIRED');
  end if;

  v_scope_mode := v_permissions->'work_items'->>'mode';
  v_ids := v_permissions->'work_items'->'ids';

  if v_scope_mode = 'explicit' then
    if jsonb_typeof(v_ids) <> 'array' or not (v_ids ? p_work_item_id::text) then
      return jsonb_build_object('ok', false, 'status', 'DENIED', 'reason', 'WORK_ITEM_NOT_AUTHORIZED');
    end if;
  elsif v_scope_mode <> 'business' then
    return jsonb_build_object('ok', false, 'status', 'CONFIG_REQUIRED', 'reason', 'INVALID_WORK_ITEM_SCOPE');
  end if;

  select w.workflow_id
    into v_workflow_id
  from public.work_items w
  where w.id = p_work_item_id
    and w.business_id = p_business_id
    and w.lifecycle_status = 'open';

  if not found then
    return jsonb_build_object('ok', false, 'status', 'DENIED', 'reason', 'WORK_ITEM_NOT_OPEN');
  end if;

  if not exists (
    select 1
    from public.work_events e
    where e.id = p_source_event_id
      and e.business_id = p_business_id
      and e.business_member_id = p_member_id
      and e.event_type = 'owner_command_received'
  ) then
    return jsonb_build_object('ok', false, 'status', 'DENIED', 'reason', 'SOURCE_EVENT_INVALID');
  end if;

  select array_agg(p.autonomy_mode order by
    case p.scope when 'business' then 1 else 2 end
  )
  into v_modes
  from public.assistant_policies p
  where p.business_id = p_business_id
    and p.policy_key = 'schedule_action'
    and p.is_active = true
    and (
      (p.scope = 'business' and p.workflow_id is null)
      or
      (p.scope = 'workflow' and p.workflow_id = v_workflow_id)
    );

  if v_modes is null or array_length(v_modes, 1) is null then
    return jsonb_build_object('ok', false, 'status', 'CONFIG_REQUIRED', 'reason', 'POLICY_NOT_RESOLVED');
  end if;

  if 'forbidden' = any(v_modes) then
    return jsonb_build_object('ok', false, 'status', 'DENIED', 'reason', 'POLICY_FORBIDDEN');
  elsif 'professional_only' = any(v_modes) then
    return jsonb_build_object('ok', false, 'status', 'HANDOFF_REQUIRED', 'reason', 'PROFESSIONAL_ONLY');
  elsif 'confirm' = any(v_modes) then
    v_effective_mode := 'confirm';
  else
    v_effective_mode := 'auto';
  end if;

  if v_effective_mode = 'confirm' and p_confirmed is not true then
    return jsonb_build_object(
      'ok', true,
      'status', 'CONFIRMATION_REQUIRED',
      'reason', 'POLICY_CONFIRM',
      'notification_scheduled', false
    );
  end if;

  insert into public.open_actions (
    business_id,
    work_item_id,
    action_key,
    title,
    status,
    autonomy_mode,
    assigned_member_id,
    due_at,
    metadata
  )
  values (
    p_business_id,
    p_work_item_id,
    'owner_command_reminder',
    btrim(p_title),
    'open',
    v_effective_mode,
    p_member_id,
    p_due_at,
    jsonb_build_object(
      'owner_command_source_event_id', p_source_event_id::text,
      'notification_scheduled', false
    )
  )
  on conflict do nothing
  returning id into v_action_id;

  if v_action_id is null then
    select a.id into v_action_id
    from public.open_actions a
    where a.business_id = p_business_id
      and a.metadata->>'owner_command_source_event_id' = p_source_event_id::text
    limit 1;

    return jsonb_build_object(
      'ok', true,
      'status', 'ACTION_EXISTS',
      'action_id', v_action_id,
      'replayed', true,
      'notification_scheduled', false
    );
  end if;

  v_created := true;

  insert into public.work_events (
    business_id,
    work_item_id,
    business_member_id,
    actor_type,
    direction,
    event_type,
    content_type,
    payload,
    occurred_at
  )
  values (
    p_business_id,
    p_work_item_id,
    p_member_id,
    'assistant',
    'internal',
    'owner_command_action_created',
    'application/json',
    jsonb_build_object(
      'owner_command_source_event_id', p_source_event_id::text,
      'action_id', v_action_id::text,
      'notification_scheduled', false
    ),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'status', 'ACTION_CREATED',
    'action_id', v_action_id,
    'replayed', false,
    'notification_scheduled', false,
    'message', 'Attività registrata con scadenza. Nessuna notifica è stata programmata.'
  );
end;
$$;

revoke all on function public.vf_record_owner_command_proposal_v1(uuid,uuid,uuid,uuid,jsonb)
from public, anon, authenticated;
grant execute on function public.vf_record_owner_command_proposal_v1(uuid,uuid,uuid,uuid,jsonb)
to service_role;

revoke all on function public.vf_commit_owner_schedule_action_v1(uuid,uuid,uuid,uuid,text,timestamptz,boolean)
from public, anon, authenticated;
grant execute on function public.vf_commit_owner_schedule_action_v1(uuid,uuid,uuid,uuid,text,timestamptz,boolean)
to service_role;
