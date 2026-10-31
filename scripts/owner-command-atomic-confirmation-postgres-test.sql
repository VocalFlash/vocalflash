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
  v_i integer;
BEGIN
  INSERT INTO public.business_members(id,business_id,is_active,permissions)
  VALUES(v_member,v_business,true,jsonb_build_object(
    'version',1,
    'grants',jsonb_build_array('add_note','schedule_action'),
    'work_items',jsonb_build_object('mode','business','ids',jsonb_build_array())
  ));
  INSERT INTO public.business_channels(id,business_id,is_active) VALUES(v_channel,v_business,true);
  INSERT INTO public.work_items(id,business_id,lifecycle_status) VALUES(v_work,v_business,'open');
  INSERT INTO public.assistant_policies(business_id,scope,policy_key,autonomy_mode,is_active)
  VALUES(v_business,'business','add_note','confirm',true),
        (v_business,'business','schedule_action','confirm',true);

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

  -- A legacy NOTE_EXISTS must not be accepted when the persisted note differs.
  v_source := '10000000-0000-4000-8000-000000000601';
  v_proposal := '10000000-0000-4000-8000-000000000602';
  INSERT INTO public.work_events(id,business_id,work_item_id,business_member_id,business_channel_id,
    actor_type,direction,event_type,normalized_text,external_message_id,payload,occurred_at)
  VALUES(v_source,v_business,v_work,v_member,v_channel,'member','inbound','owner_command_received',
    'nota divergente','wamid-source-note-mismatch','{}'::jsonb,now()-interval '1 minute');
  INSERT INTO public.work_events(id,business_id,work_item_id,business_member_id,actor_type,direction,
    event_type,content_type,payload,occurred_at)
  VALUES(v_proposal,v_business,v_work,v_member,'assistant','internal','owner_command_proposal',
    'application/json',jsonb_build_object('intent','add_note','note','nota confermata',
      'owner_command_source_event_id',v_source::text,'expires_at',(now()+interval '10 minutes')::text),
    now()-interval '30 seconds');
  INSERT INTO public.work_events(business_id,work_item_id,business_member_id,actor_type,direction,
    event_type,content_type,normalized_text,payload)
  VALUES(v_business,v_work,v_member,'member','internal','owner_command_note_added','text',
    'testo differente',jsonb_build_object('owner_command_source_event_id',v_source::text,
      'proposal_event_id',v_proposal::text,'provenance','member_statement','verification_status','unverified'));
  v_record := public.vf_record_owner_command_confirmation_v1(
    v_business,v_member,v_channel,'wamid-confirm-note-mismatch',v_proposal,'confermo',now(),'{}'::jsonb);
  v_confirmation := (v_record->>'confirmation_event_id')::uuid;
  v_result := public.vf_commit_owner_command_confirmation_v2(v_business,v_member,v_channel,v_confirmation,v_proposal);
  IF v_result->>'status'<>'REPLAY_CONFLICT' OR v_result->>'reason'<>'NOTE_EFFECT_MISMATCH' THEN
    RAISE EXCEPTION 'mismatched existing note was not rejected: %',v_result;
  END IF;
  IF (SELECT payload ? 'confirmation_consumed_at' FROM public.work_events WHERE id=v_proposal)
     OR (SELECT payload ? 'consumed_at' FROM public.work_events WHERE id=v_confirmation) THEN
    RAISE EXCEPTION 'mismatched existing note consumed the confirmation';
  END IF;

  -- A legacy ACTION_EXISTS must not be accepted when the persisted action differs.
  v_source := '10000000-0000-4000-8000-000000000701';
  v_proposal := '10000000-0000-4000-8000-000000000702';
  v_due := now()+interval '2 hours';
  INSERT INTO public.work_events(id,business_id,work_item_id,business_member_id,business_channel_id,
    actor_type,direction,event_type,normalized_text,external_message_id,payload,occurred_at)
  VALUES(v_source,v_business,v_work,v_member,v_channel,'member','inbound','owner_command_received',
    'programma attività divergente','wamid-source-action-mismatch','{}'::jsonb,now()-interval '1 minute');
  INSERT INTO public.work_events(id,business_id,work_item_id,business_member_id,actor_type,direction,
    event_type,content_type,payload,occurred_at)
  VALUES(v_proposal,v_business,v_work,v_member,'assistant','internal','owner_command_proposal',
    'application/json',jsonb_build_object('intent','schedule_action','title','Chiamare Bianchi',
      'due_at',v_due::text,'owner_command_source_event_id',v_source::text,
      'expires_at',(now()+interval '10 minutes')::text),now()-interval '30 seconds');
  INSERT INTO public.open_actions(business_id,work_item_id,action_key,title,assigned_member_id,due_at,metadata)
  VALUES(v_business,v_work,'owner_command_reminder','Titolo errato',v_member,v_due,
    jsonb_build_object('owner_command_source_event_id',v_source::text,'proposal_event_id',v_proposal::text));
  v_record := public.vf_record_owner_command_confirmation_v1(
    v_business,v_member,v_channel,'wamid-confirm-action-mismatch',v_proposal,'confermo',now(),'{}'::jsonb);
  v_confirmation := (v_record->>'confirmation_event_id')::uuid;
  v_result := public.vf_commit_owner_command_confirmation_v2(v_business,v_member,v_channel,v_confirmation,v_proposal);
  IF v_result->>'status'<>'REPLAY_CONFLICT' OR v_result->>'reason'<>'ACTION_EFFECT_MISMATCH' THEN
    RAISE EXCEPTION 'mismatched existing action was not rejected: %',v_result;
  END IF;
  IF (SELECT payload ? 'confirmation_consumed_at' FROM public.work_events WHERE id=v_proposal)
     OR (SELECT payload ? 'consumed_at' FROM public.work_events WHERE id=v_confirmation) THEN
    RAISE EXCEPTION 'mismatched existing action consumed the confirmation';
  END IF;

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

  -- If the bounded resolver scan reaches 50 rows, it must not claim a unique match:
  -- older proposals could exist beyond the scan window.
  FOR v_i IN 1..51 LOOP
    v_source := gen_random_uuid();
    v_proposal := gen_random_uuid();
    INSERT INTO public.work_events(id,business_id,work_item_id,business_member_id,business_channel_id,
      actor_type,direction,event_type,normalized_text,external_message_id,payload,occurred_at)
    VALUES(v_source,v_business,v_work,v_member,v_channel,'member','inbound','owner_command_received',
      'scan cap source '||v_i,'wamid-scan-source-'||v_i,'{}'::jsonb,
      now()-(v_i*interval '1 millisecond'));
    INSERT INTO public.work_events(id,business_id,work_item_id,business_member_id,actor_type,direction,
      event_type,content_type,payload,occurred_at)
    VALUES(v_proposal,v_business,v_work,v_member,'assistant','internal','owner_command_proposal',
      'application/json',jsonb_build_object('intent','add_note','note','scan cap note '||v_i,
        'owner_command_source_event_id',v_source::text,
        'expires_at',case when v_i<=49 then (now()-interval '1 minute')::text
                         else (now()+interval '10 minutes')::text end),
      now()-(v_i*interval '1 millisecond'));
  END LOOP;
  v_resolved := public.vf_resolve_pending_owner_command_proposal_v2(
    v_business,v_member,v_channel,'wamid-scan-cap','confermo');
  IF v_resolved->>'status'<>'AMBIGUOUS_PENDING_PROPOSAL'
     OR v_resolved->>'reason'<>'CANDIDATE_SCAN_LIMIT_REACHED' THEN
    RAISE EXCEPTION 'resolver did not fail closed at candidate scan cap: %',v_resolved;
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
