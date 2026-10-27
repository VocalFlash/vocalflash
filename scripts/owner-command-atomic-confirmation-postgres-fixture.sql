-- Minimal isolated PostgreSQL fixture for the proposed atomic confirmation wrapper.
-- The old commit RPCs are intentionally mocked here: this validates transaction
-- mechanics and wrapper SQL, not the production policy implementation.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
END
$roles$;

CREATE TABLE public.business_members(
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.business_channels(
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.work_items(
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  lifecycle_status text NOT NULL DEFAULT 'open'
);
CREATE TABLE public.work_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  work_item_id uuid,
  business_member_id uuid,
  business_channel_id uuid,
  actor_type text NOT NULL,
  direction text NOT NULL,
  event_type text NOT NULL,
  channel_type text,
  content_type text,
  normalized_text text,
  external_message_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX work_events_external_message_uidx
  ON public.work_events(business_channel_id,external_message_id)
  WHERE business_channel_id IS NOT NULL AND external_message_id IS NOT NULL;
CREATE UNIQUE INDEX work_events_owner_command_proposal_source_uidx
  ON public.work_events(business_id,(payload->>'owner_command_source_event_id'))
  WHERE event_type='owner_command_proposal' AND payload ? 'owner_command_source_event_id';

CREATE TABLE public.mock_owner_effects(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  work_item_id uuid NOT NULL,
  member_id uuid NOT NULL,
  source_event_id uuid NOT NULL UNIQUE,
  effect_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.vf_commit_owner_note_v1(
  p_business_id uuid,p_work_item_id uuid,p_member_id uuid,p_source_event_id uuid,
  p_note text,p_confirmed boolean DEFAULT false,p_proposal_event_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_proposal jsonb;
  v_effect_id uuid;
BEGIN
  SELECT payload INTO v_proposal FROM public.work_events
  WHERE id=p_proposal_event_id AND business_id=p_business_id
    AND business_member_id=p_member_id AND event_type='owner_command_proposal';
  IF NOT FOUND OR v_proposal->>'intent'<>'add_note'
     OR v_proposal->>'owner_command_source_event_id'<>p_source_event_id::text
     OR btrim(coalesce(v_proposal->>'note',''))<>btrim(p_note) OR p_confirmed IS NOT TRUE THEN
    RETURN jsonb_build_object('ok',false,'status','DENIED','reason','MOCK_PROPOSAL_MISMATCH');
  END IF;
  PERFORM pg_sleep(1);
  INSERT INTO public.mock_owner_effects(business_id,work_item_id,member_id,source_event_id,effect_type,payload)
  VALUES(p_business_id,p_work_item_id,p_member_id,p_source_event_id,'add_note',jsonb_build_object('note',p_note))
  ON CONFLICT(source_event_id) DO NOTHING RETURNING id INTO v_effect_id;
  IF p_note='__raise__' THEN RAISE EXCEPTION 'simulated failure after effect insert'; END IF;
  IF v_effect_id IS NULL THEN
    RETURN jsonb_build_object('ok',true,'status','NOTE_EXISTS','replayed',true);
  END IF;
  RETURN jsonb_build_object('ok',true,'status','NOTE_ADDED','note_event_id',v_effect_id,'replayed',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.vf_commit_owner_schedule_action_v1(
  p_business_id uuid,p_work_item_id uuid,p_member_id uuid,p_source_event_id uuid,
  p_title text,p_due_at timestamptz,p_confirmed boolean DEFAULT false,p_proposal_event_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_proposal jsonb;
  v_effect_id uuid;
BEGIN
  SELECT payload INTO v_proposal FROM public.work_events
  WHERE id=p_proposal_event_id AND business_id=p_business_id
    AND business_member_id=p_member_id AND event_type='owner_command_proposal';
  IF NOT FOUND OR v_proposal->>'intent'<>'schedule_action'
     OR v_proposal->>'owner_command_source_event_id'<>p_source_event_id::text
     OR btrim(coalesce(v_proposal->>'title',''))<>btrim(p_title)
     OR (v_proposal->>'due_at')::timestamptz<>p_due_at OR p_confirmed IS NOT TRUE THEN
    RETURN jsonb_build_object('ok',false,'status','DENIED','reason','MOCK_PROPOSAL_MISMATCH');
  END IF;
  INSERT INTO public.mock_owner_effects(business_id,work_item_id,member_id,source_event_id,effect_type,payload)
  VALUES(p_business_id,p_work_item_id,p_member_id,p_source_event_id,'schedule_action',
         jsonb_build_object('title',p_title,'due_at',p_due_at))
  ON CONFLICT(source_event_id) DO NOTHING RETURNING id INTO v_effect_id;
  IF v_effect_id IS NULL THEN
    RETURN jsonb_build_object('ok',true,'status','ACTION_EXISTS','replayed',true);
  END IF;
  RETURN jsonb_build_object('ok',true,'status','ACTION_CREATED','action_id',v_effect_id,'replayed',false);
END;
$$;
