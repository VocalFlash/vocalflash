-- Runs only against the disposable PostgreSQL service in GitHub Actions.
DO $test$
DECLARE
  v_business uuid := '10000000-0000-4000-8000-000000000001';
  v_member uuid := '10000000-0000-4000-8000-000000000002';
  v_channel uuid := '10000000-0000-4000-8000-000000000003';
  v_work uuid := '10000000-0000-4000-8000-000000000004';
  v_source uuid;
  v_proposal uuid;
  v_confirmation uuid;
  v_record jsonb;
  v_result jsonb;
  v_resolved jsonb;
  v_failed boolean;
  v_count integer;
  v_due timestamptz;
BEGIN
  INSERT INTO public.business_members(id,business_id,is_active) VALUES(v_member,v_business,true);
  INSERT INTO public.business_channels(id,business_id,is_active) VALUES(v_channel,v_business,true);
  INSERT INTO public.work_items(id,business_id,lifecycle_status) VALUES(v_work,v_business,'open');

  -- Successful note commit, exact replay and conflicting external-message replay.
  v_source := '10000000-0000-4000-8000-000000000101';
  v_proposal := '10000000-0000-4000-8000-000000000102';
  INSERT INTO public.work_events(id,business_id,work_item_id,business_member_id,business_channel_id,
    actor_type,direction,event_type,normalized_text,external_message_id,payload,occurred_at)
  VALUES(v_source,v_business,v_work,v_member,v_channel,'member','inbound','owner_command_received',
    'aggiungi nota','wamid-source-note','{}'::jsonb,now()-interval '1 minute');
  INSERT INTO public.work_events(id,business_id,work_item_id,business_member_id,actor_type,direction,
    event_type,content_type,payload,occurred_at)
  VALUES(v_proposal,v_business,v_work,v_member,'assistant','internal','owner_command_proposal',
    'application/json',jsonb_build_object('intent','add_note','note','25 persone',
      'owner_command_source_event_id',v_source::text,'expires_at',(now()+interval '10 minutes')::text),
    now()-interval '30 seconds');

  v_record := public.vf_record_owner_command_confirmation_v1(
    v_business,v_member,v_channel,'wamid-confirm-note',v_proposal,'confermo',now(),'{}'::jsonb);
  IF v_record->>'status'<>'CONFIRMATION_RECORDED' THEN RAISE EXCEPTION 'expected new confirmation, got %',v_record; END IF;
  v_confirmation := (v_record->>'confirmation_event_id')::uuid;
  v_result := public.vf_commit_owner_command_confirmation_v2(v_business,v_member,v_channel,v_confirmation,v_proposal);
  IF v_result->>'status'<>'CONFIRMATION_COMMITTED' OR v_result->'result'->>'status'<>'NOTE_ADDED'
     OR v_result->>'writes_performed'<>'true' THEN
    RAISE EXCEPTION 'expected committed note, got %',v_result;
  END IF;
  SELECT count(*) INTO v_count FROM public.mock_owner_effects WHERE source_event_id=v_source;
  IF v_count<>1 THEN RAISE EXCEPTION 'expected one note effect, got %',v_count; END IF;

  v_resolved := public.vf_resolve_pending_owner_command_proposal_v2(
    v_business,v_member,v_channel,'wamid-confirm-note','confermo');
  IF v_resolved->>'status'<>'EXISTING_CONFIRMATION'
     OR v_resolved->>'proposal_event_id'<>v_proposal::text THEN
    RAISE EXCEPTION 'expected exact confirmation replay resolution, got %',v_resolved;
  END IF;
  v_record := public.vf_record_owner_command_confirmation_v1(
    v_business,v_member,v_channel,'wamid-confirm-note',v_proposal,'confermo',now(),'{}'::jsonb);
  IF v_record->>'status'<>'CONFIRMATION_EXISTS' THEN RAISE EXCEPTION 'expected identical replay, got %',v_record; END IF;
  v_result := public.vf_commit_owner_command_confirmation_v2(v_business,v_member,v_channel,v_confirmation,v_proposal);
  IF v_result->>'status'<>'CONFIRMATION_COMMITTED' OR v_result->>'replayed'<>'true'
     OR v_result->>'writes_performed'<>'false' THEN
    RAISE EXCEPTION 'expected replay result, got %',v_result;
  END IF;
  v_record := public.vf_record_owner_command_confirmation_v1(
    v_business,v_member,v_channel,'wamid-confirm-note',v_proposal,'sì confermo',now(),'{}'::jsonb);
  IF v_record->>'status'<>'REPLAY_CONFLICT' THEN RAISE EXCEPTION 'expected conflicting replay rejection, got %',v_record; END IF;
  SELECT count(*) INTO v_count FROM public.mock_owner_effects WHERE source_event_id=v_source;
  IF v_count<>1 THEN RAISE EXCEPTION 'replay duplicated note effect: %',v_count; END IF;

  -- Expired proposals must not produce effects or consumption markers.
  v_source := '10000000-0000-4000-8000-000000000201';
  v_proposal := '10000000-0000-4000-8000-000000000202';
  INSERT INTO public.work_events(id,business_id,work_item_id,business_member_id,business_channel_id,
    actor_type,direction,event_type,normalized_text,external_message_id,payload,occurred_at)
  VALUES(v_source,v_business,v_work,v_member,v_channel,'member','inbound','owner_command_received',
    'aggiungi nota scaduta','wamid-source-expired','{}'::jsonb,now()-interval '2 minutes');
  INSERT INTO public.work_events(id,business_id,work_item_id,business_member_id,actor_type,direction,
    event_type,content_type,payload,occurred_at)
  VALUES(v_proposal,v_business,v_work,v_member,'assistant','internal','owner_command_proposal',
    'application/json',jsonb_build_object('intent','add_note','note','expired note',
      'owner_command_source_event_id',v_source::text,'expires_at',(now()-interval '30 seconds')::text),
    now()-interval '90 seconds');
  v_record := public.vf_record_owner_command_confirmation_v1(
    v_business,v_member,v_channel,'wamid-confirm-expired',v_proposal,'confermo',now(),'{}'::jsonb);
  v_confirmation := (v_record->>'confirmation_event_id')::uuid;
  v_result := public.vf_commit_owner_command_confirmation_v2(v_business,v_member,v_channel,v_confirmation,v_proposal);
  IF v_result->>'status'<>'DENIED' OR v_result->>'reason'<>'CONFIRMATION_EXPIRED_OR_OUT_OF_ORDER' THEN
    RAISE EXCEPTION 'expected expired confirmation denial, got %',v_result;
  END IF;
  SELECT count(*) INTO v_count FROM public.mock_owner_effects WHERE source_event_id=v_source;
  IF v_count<>0 THEN RAISE EXCEPTION 'expired proposal caused an effect'; END IF;

  -- Exception after a mock effect insert must roll back both the effect and consumption.
  v_source := '10000000-0000-4000-8000-000000000301';
  v_proposal := '10000000-0000-4000-8000-000000000302';
  INSERT INTO public.work_events(id,business_id,work_item_id,business_member_id,business_channel_id,
    actor_type,direction,event_type,normalized_text,external_message_id,payload,occurred_at)
  VALUES(v_source,v_business,v_work,v_member,v_channel,'member','inbound','owner_command_received',
    'aggiungi nota test rollback','wamid-source-rollback','{}'::jsonb,now()-interval '1 minute');
  INSERT INTO public.work_events(id,business_id,work_item_id,business_member_id,actor_type,direction,
    event_type,content_type,payload,occurred_at)
  VALUES(v_proposal,v_business,v_work,v_member,'assistant','internal','owner_command_proposal',
    'application/json',jsonb_build_object('intent','add_note','note','__raise__',
      'owner_command_source_event_id',v_source::text,'expires_at',(now()+interval '10 minutes')::text),
    now()-interval '30 seconds');
  v_record := public.vf_record_owner_command_confirmation_v1(
    v_business,v_member,v_channel,'wamid-confirm-rollback',v_proposal,'confermo',now(),'{}'::jsonb);
  v_confirmation := (v_record->>'confirmation_event_id')::uuid;
  v_failed := false;
  BEGIN
    PERFORM public.vf_commit_owner_command_confirmation_v2(v_business,v_member,v_channel,v_confirmation,v_proposal);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'expected simulated commit failure'; END IF;
  SELECT count(*) INTO v_count FROM public.mock_owner_effects WHERE source_event_id=v_source;
  IF v_count<>0 THEN RAISE EXCEPTION 'effect was not rolled back'; END IF;
  IF (SELECT payload ? 'confirmation_consumed_at' FROM public.work_events WHERE id=v_proposal)
     OR (SELECT payload ? 'consumed_at' FROM public.work_events WHERE id=v_confirmation) THEN
    RAISE EXCEPTION 'consumption markers survived rollback';
  END IF;

  -- Schedule-action branch uses the same atomic wrapper.
  v_source := '10000000-0000-4000-8000-000000000501';
  v_proposal := '10000000-0000-4000-8000-000000000502';
  v_due := now()+interval '1 hour';
  INSERT INTO public.work_events(id,business_id,work_item_id,business_member_id,business_channel_id,
    actor_type,direction,event_type,normalized_text,external_message_id,payload,occurred_at)
  VALUES(v_source,v_business,v_work,v_member,v_channel,'member','inbound','owner_command_received',
    'programma chiamata','wamid-source-schedule','{}'::jsonb,now()-interval '1 minute');
  INSERT INTO public.work_events(id,business_id,work_item_id,business_member_id,actor_type,direction,
    event_type,content_type,payload,occurred_at)
  VALUES(v_proposal,v_business,v_work,v_member,'assistant','internal','owner_command_proposal',
    'application/json',jsonb_build_object('intent','schedule_action','title','Chiamare Rossi',
      'due_at',v_due::text,'owner_command_source_event_id',v_source::text,
      'expires_at',(now()+interval '10 minutes')::text),now()-interval '30 seconds');
  v_record := public.vf_record_owner_command_confirmation_v1(
    v_business,v_member,v_channel,'wamid-confirm-schedule',v_proposal,'confermo',now(),'{}'::jsonb);
  v_confirmation := (v_record->>'confirmation_event_id')::uuid;
  v_result := public.vf_commit_owner_command_confirmation_v2(v_business,v_member,v_channel,v_confirmation,v_proposal);
  IF v_result->>'status'<>'CONFIRMATION_COMMITTED' OR v_result->'result'->>'status'<>'ACTION_CREATED' THEN
    RAISE EXCEPTION 'expected committed schedule action, got %',v_result;
  END IF;

  -- Leave one valid unconsumed confirmation for the shell-driven concurrency test.
  v_source := '10000000-0000-4000-8000-000000000401';
  v_proposal := '10000000-0000-4000-8000-000000000402';
  INSERT INTO public.work_events(id,business_id,work_item_id,business_member_id,business_channel_id,
    actor_type,direction,event_type,normalized_text,external_message_id,payload,occurred_at)
  VALUES(v_source,v_business,v_work,v_member,v_channel,'member','inbound','owner_command_received',
    'nota concorrente','wamid-source-concurrent','{}'::jsonb,now()-interval '1 minute');
  INSERT INTO public.work_events(id,business_id,work_item_id,business_member_id,actor_type,direction,
    event_type,content_type,payload,occurred_at)
  VALUES(v_proposal,v_business,v_work,v_member,'assistant','internal','owner_command_proposal',
    'application/json',jsonb_build_object('intent','add_note','note','concurrent note',
      'owner_command_source_event_id',v_source::text,'expires_at',(now()+interval '10 minutes')::text),
    now()-interval '30 seconds');
  v_record := public.vf_record_owner_command_confirmation_v1(
    v_business,v_member,v_channel,'wamid-confirm-concurrent',v_proposal,'confermo',now(),'{}'::jsonb);
  IF v_record->>'status'<>'CONFIRMATION_RECORDED' THEN RAISE EXCEPTION 'concurrency fixture confirmation failed: %',v_record; END IF;
END
$test$;
