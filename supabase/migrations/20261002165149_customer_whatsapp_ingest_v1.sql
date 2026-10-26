
create or replace function public.vf_ingest_customer_whatsapp_event_v1(
  p_external_account_id text,
  p_sender_wa_id text,
  p_external_message_id text,
  p_normalized_text text,
  p_occurred_at timestamptz default null,
  p_content_type text default 'text',
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_channel_id uuid;
  v_business_id uuid;
  v_sender_digits text;
  v_contact_id uuid;
  v_event_id uuid;
  v_existing_event_id uuid;
  v_existing_contact_id uuid;
  v_contact_created boolean := false;
begin
  if p_external_account_id is null or length(btrim(p_external_account_id))=0 then
    return jsonb_build_object('ok',false,'status','INVALID','reason','EXTERNAL_ACCOUNT_ID_REQUIRED');
  end if;

  if p_external_message_id is null or length(btrim(p_external_message_id))=0 then
    return jsonb_build_object('ok',false,'status','INVALID','reason','EXTERNAL_MESSAGE_ID_REQUIRED');
  end if;

  if p_normalized_text is null or length(btrim(p_normalized_text))=0 then
    return jsonb_build_object('ok',false,'status','INVALID','reason','NORMALIZED_TEXT_REQUIRED');
  end if;

  if p_content_type not in ('text','audio','image','document') then
    return jsonb_build_object('ok',false,'status','INVALID','reason','CONTENT_TYPE_NOT_SUPPORTED');
  end if;

  v_sender_digits := regexp_replace(coalesce(p_sender_wa_id,''),'[^0-9]','','g');
  if v_sender_digits !~ '^[1-9][0-9]{7,14}$' then
    return jsonb_build_object('ok',false,'status','INVALID','reason','SENDER_WA_ID_INVALID');
  end if;

  select c.id,c.business_id
    into v_channel_id,v_business_id
  from public.business_channels c
  join public.businesses b on b.id=c.business_id and b.is_active=true
  where c.channel_type='whatsapp'
    and c.external_account_id=p_external_account_id
    and c.is_active=true
  limit 1;

  if v_channel_id is null then
    return jsonb_build_object('ok',false,'status','DENIED','reason','CHANNEL_NOT_ACTIVE');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_channel_id::text||':msg:'||p_external_message_id,0)
  );

  select e.id,e.contact_id
    into v_existing_event_id,v_existing_contact_id
  from public.work_events e
  where e.business_channel_id=v_channel_id
    and e.external_message_id=p_external_message_id
  limit 1;

  if v_existing_event_id is not null then
    return jsonb_build_object(
      'ok',true,
      'status','EVENT_EXISTS',
      'business_id',v_business_id,
      'channel_id',v_channel_id,
      'contact_id',v_existing_contact_id,
      'event_id',v_existing_event_id,
      'replayed',true,
      'contact_created',false
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_business_id::text||':contact-wa:'||v_sender_digits,0)
  );

  select c.id into v_contact_id
  from public.contacts c
  where c.business_id=v_business_id
    and c.is_active=true
    and c.whatsapp_number is not null
    and regexp_replace(c.whatsapp_number,'[^0-9]','','g')=v_sender_digits
  order by c.created_at asc
  limit 1;

  if v_contact_id is null then
    insert into public.contacts(
      business_id,display_name,contact_type,whatsapp_number,metadata,is_active
    )
    values(
      v_business_id,null,'customer',v_sender_digits,
      jsonb_build_object('source','whatsapp_inbound','auto_created',true),
      true
    )
    returning id into v_contact_id;
    v_contact_created := true;
  end if;

  insert into public.work_events(
    business_id,
    contact_id,
    business_channel_id,
    actor_type,
    direction,
    event_type,
    channel_type,
    content_type,
    normalized_text,
    external_message_id,
    payload,
    occurred_at
  )
  values(
    v_business_id,
    v_contact_id,
    v_channel_id,
    'customer',
    'inbound',
    'message',
    'whatsapp',
    p_content_type,
    btrim(p_normalized_text),
    p_external_message_id,
    coalesce(p_payload,'{}'::jsonb),
    coalesce(p_occurred_at,now())
  )
  on conflict do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select e.id,e.contact_id
      into v_existing_event_id,v_existing_contact_id
    from public.work_events e
    where e.business_channel_id=v_channel_id
      and e.external_message_id=p_external_message_id
    limit 1;

    return jsonb_build_object(
      'ok',true,
      'status','EVENT_EXISTS',
      'business_id',v_business_id,
      'channel_id',v_channel_id,
      'contact_id',v_existing_contact_id,
      'event_id',v_existing_event_id,
      'replayed',true,
      'contact_created',false
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'status','EVENT_RECORDED',
    'business_id',v_business_id,
    'channel_id',v_channel_id,
    'contact_id',v_contact_id,
    'event_id',v_event_id,
    'replayed',false,
    'contact_created',v_contact_created
  );
end;
$$;

revoke all on function public.vf_ingest_customer_whatsapp_event_v1(text,text,text,text,timestamptz,text,jsonb)
from public,anon,authenticated;
grant execute on function public.vf_ingest_customer_whatsapp_event_v1(text,text,text,text,timestamptz,text,jsonb)
to service_role;

comment on function public.vf_ingest_customer_whatsapp_event_v1(text,text,text,text,timestamptz,text,jsonb)
is 'Server-only idempotent WhatsApp customer event ingestion. Resolves active business channel, reuses/creates customer contact, records one inbound work_event per channel+external_message_id. Does not route or create work items.';
