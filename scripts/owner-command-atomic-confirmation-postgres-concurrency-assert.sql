-- Final assertions after two concurrent calls against the same proposal+confirmation.
DO $assert$
DECLARE
  v_source uuid := '10000000-0000-4000-8000-000000000401';
  v_proposal uuid := '10000000-0000-4000-8000-000000000402';
  v_confirmation uuid;
  v_count integer;
  v_payload jsonb;
BEGIN
  SELECT id,payload INTO v_confirmation,v_payload
  FROM public.work_events
  WHERE business_channel_id='10000000-0000-4000-8000-000000000003'
    AND external_message_id='wamid-confirm-concurrent'
    AND event_type='owner_command_confirmation';
  IF v_confirmation IS NULL THEN RAISE EXCEPTION 'concurrent confirmation missing'; END IF;
  SELECT count(*) INTO v_count FROM public.mock_owner_effects WHERE source_event_id=v_source;
  IF v_count<>1 THEN RAISE EXCEPTION 'concurrent commits produced % effects, expected 1',v_count; END IF;
  IF NOT (SELECT payload ? 'confirmation_consumed_at' FROM public.work_events WHERE id=v_proposal) THEN
    RAISE EXCEPTION 'proposal was not marked consumed';
  END IF;
  IF NOT (SELECT payload ? 'consumed_at' FROM public.work_events WHERE id=v_confirmation) THEN
    RAISE EXCEPTION 'confirmation was not marked consumed';
  END IF;
  IF NOT has_function_privilege('service_role',
       'public.vf_commit_owner_command_confirmation_v2(uuid,uuid,uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute atomic commit RPC';
  END IF;
  IF has_function_privilege('anon',
       'public.vf_commit_owner_command_confirmation_v2(uuid,uuid,uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute atomic commit RPC';
  END IF;
END
$assert$;
