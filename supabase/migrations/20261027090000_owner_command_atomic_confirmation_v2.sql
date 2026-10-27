-- Forward-only owner confirmation atomicity v2.
-- This migration is a proposal on an isolated Git branch only. Do not apply to live
-- Supabase until baseline/provenance and isolated PostgreSQL tests are complete.
-- Proposal payload must include an explicit server-generated expires_at timestamp.
-- No default TTL is invented here; the application must be configured deliberately.

create or replace function public.vf_resolve_pending_owner_command_proposal_v2(
  p_business_id uuid,
  p_member_id uuid,
  p_channel_id uuid,
  p_external_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_ok boolean;
  v_channel_ok boolean;
  v_row record;
  v_expiry timestamptz;
  v_candidate record;
  v_existing_confirmation public.work_events%rowtype;
  v_existing_proposal_id uuid;
  v_count integer := 0;
  v_proposal_id uuid;
  v_source_event_id uuid;
  v_work_item_id uuid;
  v_payload jsonb;
begin
  select exists(
    select 1 from public.business_members m
    where m.id=p_member_id and m.business_id=p_business_id and m.is_active=true
  ) into v_member_ok;
  if not v_member_ok then
    return jsonb_build_object('ok',false,'status','DENIED','reason','MEMBER_NOT_ACTIVE');
  end if;

  select exists(
    select 1 from public.business_channels c
    where c.id=p_channel_id and c.business_id=p_business_id and c.is_active=true
  ) into v_channel_ok;
  if not v_channel_ok then
    return jsonb_build_object('ok',false,'status','DENIED','reason','CHANNEL_NOT_ACTIVE');
  end if;

  -- Resolve exact retries before scanning for unconsumed proposals.
  select * into v_existing_confirmation
  from public.work_events
  where business_channel_id=p_channel_id
    and external_message_id=p_external_message_id
  limit 1;
  if found then
    if v_existing_confirmation.business_id<>p_business_id
       or v_existing_confirmation.business_member_id<>p_member_id
       or v_existing_confirmation.event_type<>'owner_command_confirmation' then
      return jsonb_build_object('ok',false,'status','REPLAY_CONFLICT','reason','CONFIRMATION_MESSAGE_ID_REUSED','writes_performed',false);
    end if;
    begin
      v_existing_proposal_id := (v_existing_confirmation.payload->>'proposal_event_id')::uuid;
    exception when others then
      return jsonb_build_object('ok',false,'status','REPLAY_CONFLICT','reason','CONFIRMATION_PROPOSAL_BINDING_INVALID','writes_performed',false);
    end;
    select p.id,p.business_id,p.work_item_id,p.business_member_id,p.payload,p.occurred_at,
           s.id as source_id,s.business_channel_id
      into v_candidate
    from public.work_events p
    join public.work_events s
      on s.id::text=(p.payload->>'owner_command_source_event_id')
     and s.business_id=p.business_id
     and s.business_member_id=p.business_member_id
     and s.event_type='owner_command_received'
    where p.id=v_existing_proposal_id
      and p.business_id=p_business_id
      and p.business_member_id=p_member_id
      and s.business_channel_id=p_channel_id
      and p.event_type='owner_command_proposal';
    if not found then
      return jsonb_build_object('ok',false,'status','REPLAY_CONFLICT','reason','CONFIRMATION_PROPOSAL_BINDING_INVALID','writes_performed',false);
    end if;
    return jsonb_build_object(
      'ok',true,'status','EXISTING_CONFIRMATION',
      'proposal_event_id',v_candidate.id,
      'source_event_id',v_candidate.source_id,
      'work_item_id',v_candidate.work_item_id,
      'expires_at',v_candidate.payload->>'expires_at',
      'proposal',v_candidate.payload,
      'writes_performed',false
    );
  end if;

  -- A proposal is channel-bound through its authenticated source event. Invalid
  -- or missing expiry values are ignored (fail closed), never treated as unexpired.
  for v_row in
    select p.id,p.business_id,p.work_item_id,p.business_member_id,p.payload,p.occurred_at,
           s.id as source_id,s.business_channel_id
    from public.work_events p
    join public.work_events s
      on s.id::text=(p.payload->>'owner_command_source_event_id')
     and s.business_id=p.business_id
     and s.business_member_id=p.business_member_id
     and s.event_type='owner_command_received'
    where p.business_id=p_business_id
      and p.business_member_id=p_member_id
      and p.event_type='owner_command_proposal'
      and s.business_channel_id=p_channel_id
      and p.payload ? 'expires_at'
      and not (p.payload ? 'confirmation_consumed_at')
    order by p.occurred_at desc
    limit 50
  loop
    begin
      v_expiry := (v_row.payload->>'expires_at')::timestamptz;
    exception when others then
      continue;
    end;
    if v_expiry > now() and v_row.occurred_at <= v_expiry then
      v_count := v_count + 1;
      v_candidate := v_row;
    end if;
  end loop;

  if v_count=0 then
    return jsonb_build_object('ok',true,'status','NO_PENDING_PROPOSAL','writes_performed',false);
  end if;
  if v_count>1 then
    return jsonb_build_object('ok',false,'status','AMBIGUOUS_PENDING_PROPOSAL','reason','EXPLICIT_PROPOSAL_SELECTION_REQUIRED','writes_performed',false);
  end if;

  v_proposal_id := v_candidate.id;
  v_source_event_id := v_candidate.source_id;
  v_work_item_id := v_candidate.work_item_id;
  v_payload := v_candidate.payload;
  return jsonb_build_object(
    'ok',true,'status','PENDING_PROPOSAL',
    'proposal_event_id',v_proposal_id,
    'source_event_id',v_source_event_id,
    'work_item_id',v_work_item_id,
    'expires_at',v_payload->>'expires_at',
    'proposal',v_payload,
    'writes_performed',false
  );
end;
$$;

create or replace function public.vf_commit_owner_command_confirmation_v2(
  p_business_id uuid,
  p_member_id uuid,
  p_channel_id uuid,
  p_confirmation_event_id uuid,
  p_proposal_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_proposal public.work_events%rowtype;
  v_confirmation public.work_events%rowtype;
  v_source public.work_events%rowtype;
  v_payload jsonb;
  v_confirmation_payload jsonb;
  v_expiry timestamptz;
  v_intent text;
  v_note text;
  v_title text;
  v_due_at timestamptz;
  v_source_id uuid;
  v_result jsonb;
  v_existing_result jsonb;
  v_normalized_confirmation text;
begin
  if p_business_id is null or p_member_id is null or p_channel_id is null
     or p_confirmation_event_id is null or p_proposal_event_id is null then
    return jsonb_build_object('ok',false,'status','INVALID','reason','CONFIRMATION_BINDING_REQUIRED','writes_performed',false);
  end if;

  -- Stable lock order: proposal first, then confirmation. Both are locked and
  -- consumed in the same transaction as the business effect.
  select * into v_proposal
  from public.work_events
  where id=p_proposal_event_id
    and business_id=p_business_id
    and business_member_id=p_member_id
    and event_type='owner_command_proposal'
  for update;

  if not found then
    return jsonb_build_object('ok',false,'status','DENIED','reason','PROPOSAL_NOT_FOUND','writes_performed',false);
  end if;

  select * into v_confirmation
  from public.work_events
  where id=p_confirmation_event_id
    and business_id=p_business_id
    and business_member_id=p_member_id
    and business_channel_id=p_channel_id
    and event_type='owner_command_confirmation'
  for update;

  if not found then
    return jsonb_build_object('ok',false,'status','DENIED','reason','CONFIRMATION_NOT_FOUND_OR_BINDING_MISMATCH','writes_performed',false);
  end if;

  v_confirmation_payload := coalesce(v_confirmation.payload,'{}'::jsonb);
  if v_confirmation_payload->>'proposal_event_id' is distinct from p_proposal_event_id::text then
    return jsonb_build_object('ok',false,'status','DENIED','reason','CONFIRMATION_PROPOSAL_MISMATCH','writes_performed',false);
  end if;

  v_normalized_confirmation := regexp_replace(
    regexp_replace(
      regexp_replace(lower(btrim(coalesce(v_confirmation.normalized_text,''))), '[,:;]+', ' ', 'g'),
      '[.!?]+$', ''
    ),
    '\s+', ' ', 'g'
  );
  if v_normalized_confirmation not in ('confermo','si confermo','sì confermo','ok confermo','confermo ok') then
    return jsonb_build_object('ok',false,'status','DENIED','reason','EXPLICIT_CONFIRMATION_REQUIRED','writes_performed',false);
  end if;

  v_payload := coalesce(v_proposal.payload,'{}'::jsonb);
  -- An exact replay returns the persisted result even after expiry. Inconsistent
  -- consumption markers fail closed.
  if (v_payload ? 'confirmation_consumed_at') or (v_confirmation_payload ? 'consumed_at') then
    if v_payload->>'confirmation_event_id'=p_confirmation_event_id::text
       and v_confirmation_payload->>'consumed_for_proposal_event_id'=p_proposal_event_id::text
       and jsonb_typeof(v_payload->'confirmation_result')='object'
       and jsonb_typeof(v_confirmation_payload->'commit_result')='object'
       and v_payload->'confirmation_result'=v_confirmation_payload->'commit_result' then
      return jsonb_build_object('ok',true,'status','CONFIRMATION_COMMITTED',
        'result',v_payload->'confirmation_result','replayed',true,'writes_performed',false);
    end if;
    return jsonb_build_object('ok',false,'status','DENIED','reason','CONFIRMATION_OR_PROPOSAL_ALREADY_CONSUMED','writes_performed',false);
  end if;

  if not (v_payload ? 'expires_at') then
    return jsonb_build_object('ok',false,'status','CONFIG_REQUIRED','reason','PROPOSAL_EXPIRY_REQUIRED','writes_performed',false);
  end if;
  begin
    v_expiry := (v_payload->>'expires_at')::timestamptz;
  exception when others then
    return jsonb_build_object('ok',false,'status','CONFIG_REQUIRED','reason','PROPOSAL_EXPIRY_INVALID','writes_performed',false);
  end;
  if now() > v_expiry or v_confirmation.occurred_at > v_expiry
     or v_confirmation.occurred_at < v_proposal.occurred_at then
    return jsonb_build_object('ok',false,'status','DENIED','reason','CONFIRMATION_EXPIRED_OR_OUT_OF_ORDER','writes_performed',false);
  end if;

  -- Verify that the source event is the same authenticated member/channel and
  -- is the source named by this immutable proposal.
  begin
    v_source_id := (v_payload->>'owner_command_source_event_id')::uuid;
  exception when others then
    return jsonb_build_object('ok',false,'status','DENIED','reason','PROPOSAL_SOURCE_INVALID','writes_performed',false);
  end;
  select * into v_source
  from public.work_events
  where id=v_source_id
    and business_id=p_business_id
    and business_member_id=p_member_id
    and business_channel_id=p_channel_id
    and event_type='owner_command_received';
  if not found then
    return jsonb_build_object('ok',false,'status','DENIED','reason','PROPOSAL_SOURCE_BINDING_MISMATCH','writes_performed',false);
  end if;

  if v_proposal.work_item_id is null or not exists(
    select 1 from public.work_items w
    where w.id=v_proposal.work_item_id and w.business_id=p_business_id
  ) then
    return jsonb_build_object('ok',false,'status','DENIED','reason','PROPOSAL_WORK_ITEM_INVALID','writes_performed',false);
  end if;

  v_intent := v_payload->>'intent';
  if v_intent='add_note' then
    v_note := nullif(btrim(v_payload->>'note'),'');
    if v_note is null then
      return jsonb_build_object('ok',false,'status','DENIED','reason','PROPOSAL_NOTE_INVALID','writes_performed',false);
    end if;
    v_result := public.vf_commit_owner_note_v1(
      p_business_id,v_proposal.work_item_id,p_member_id,v_source_id,v_note,true,p_proposal_event_id
    );
    if coalesce(v_result->>'status','') not in ('NOTE_ADDED','NOTE_EXISTS') then
      return jsonb_build_object('ok',false,'status','COMMIT_REJECTED','result',v_result,'writes_performed',false);
    end if;
  elsif v_intent='schedule_action' then
    v_title := nullif(btrim(v_payload->>'title'),'');
    if v_title is null or nullif(v_payload->>'due_at','') is null then
      return jsonb_build_object('ok',false,'status','DENIED','reason','PROPOSAL_ACTION_INVALID','writes_performed',false);
    end if;
    begin
      v_due_at := (v_payload->>'due_at')::timestamptz;
    exception when others then
      return jsonb_build_object('ok',false,'status','DENIED','reason','PROPOSAL_ACTION_INVALID','writes_performed',false);
    end;
    v_result := public.vf_commit_owner_schedule_action_v1(
      p_business_id,v_proposal.work_item_id,p_member_id,v_source_id,v_title,v_due_at,true,p_proposal_event_id
    );
    if coalesce(v_result->>'status','') not in ('ACTION_CREATED','ACTION_EXISTS') then
      return jsonb_build_object('ok',false,'status','COMMIT_REJECTED','result',v_result,'writes_performed',false);
    end if;
  else
    return jsonb_build_object('ok',false,'status','DENIED','reason','PROPOSAL_INTENT_UNSUPPORTED','writes_performed',false);
  end if;

  -- The write above and these consumption markers commit or roll back together.
  update public.work_events
  set payload=coalesce(payload,'{}'::jsonb) || jsonb_build_object(
    'consumed_at',now(),
    'consumed_for_proposal_event_id',p_proposal_event_id::text,
    'commit_result',v_result
  )
  where id=p_confirmation_event_id and business_id=p_business_id;

  update public.work_events
  set payload=coalesce(payload,'{}'::jsonb) || jsonb_build_object(
    'confirmation_consumed_at',now(),
    'confirmation_event_id',p_confirmation_event_id::text,
    'confirmation_result',v_result
  )
  where id=p_proposal_event_id and business_id=p_business_id;

  return jsonb_build_object('ok',true,'status','CONFIRMATION_COMMITTED',
    'result',v_result,'replayed',false,'writes_performed',true);
end;
$$;

revoke all on function public.vf_resolve_pending_owner_command_proposal_v2(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.vf_commit_owner_command_confirmation_v2(uuid,uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.vf_resolve_pending_owner_command_proposal_v2(uuid,uuid,uuid) to service_role;
grant execute on function public.vf_commit_owner_command_confirmation_v2(uuid,uuid,uuid,uuid,uuid) to service_role;
