
create or replace function public.vf_record_owner_command_received_v1(
  p_business_id uuid,
  p_member_id uuid,
  p_channel_id uuid,
  p_external_message_id text,
  p_normalized_text text,
  p_occurred_at timestamptz,
  p_payload jsonb default '{}'::jsonb
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
  if p_external_message_id is null or length(btrim(p_external_message_id)) = 0 then
    return jsonb_build_object('ok',false,'status','INVALID','reason','EXTERNAL_MESSAGE_ID_REQUIRED');
  end if;

  if not exists (
    select 1 from public.business_members m
    where m.id=p_member_id and m.business_id=p_business_id and m.is_active=true
  ) then
    return jsonb_build_object('ok',false,'status','DENIED','reason','MEMBER_NOT_ACTIVE');
  end if;

  if not exists (
    select 1 from public.business_channels c
    where c.id=p_channel_id and c.business_id=p_business_id and c.is_active=true
  ) then
    return jsonb_build_object('ok',false,'status','DENIED','reason','CHANNEL_NOT_ACTIVE');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_business_id::text || ':received:' || p_channel_id::text || ':' || p_external_message_id,0)
  );

  insert into public.work_events(
    business_id,business_member_id,business_channel_id,
    actor_type,direction,event_type,channel_type,content_type,
    normalized_text,external_message_id,payload,occurred_at
  )
  values(
    p_business_id,p_member_id,p_channel_id,
    'member','internal','owner_command_received','whatsapp','text',
    p_normalized_text,p_external_message_id,coalesce(p_payload,'{}'::jsonb),
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
      'ok',true,'status','RECEIVED_EXISTS',
      'event_id',v_existing,'replayed',true
    );
  end if;

  return jsonb_build_object(
    'ok',true,'status','RECEIVED_RECORDED',
    'event_id',v_event_id,'replayed',false
  );
end;
$$;

revoke all on function public.vf_record_owner_command_received_v1(uuid,uuid,uuid,text,text,timestamptz,jsonb)
from public, anon, authenticated;
grant execute on function public.vf_record_owner_command_received_v1(uuid,uuid,uuid,text,text,timestamptz,jsonb)
to service_role;
