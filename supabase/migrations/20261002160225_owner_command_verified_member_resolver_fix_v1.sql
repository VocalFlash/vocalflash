
create or replace function public.vf_resolve_owner_member_by_sender_v1(
  p_sender_wa_id text,
  p_business_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_sender_digits text;
  v_count integer;
  v_member_id uuid;
  v_resolved_business_id uuid;
  v_auth_user_id uuid;
  v_business_ids jsonb;
begin
  v_sender_digits := regexp_replace(coalesce(p_sender_wa_id,''), '[^0-9]', '', 'g');

  if v_sender_digits !~ '^[1-9][0-9]{7,14}$' then
    return jsonb_build_object(
      'ok', false,
      'status', 'INVALID',
      'reason', 'SENDER_WA_ID_INVALID'
    );
  end if;

  with matches as (
    select
      m.id as member_id,
      m.business_id,
      m.auth_user_id
    from public.business_members m
    join auth.users u on u.id = m.auth_user_id
    where m.is_active = true
      and m.auth_user_id is not null
      and m.whatsapp_number is not null
      and u.phone is not null
      and u.phone_confirmed_at is not null
      and regexp_replace(u.phone, '[^0-9]', '', 'g') = v_sender_digits
      and regexp_replace(m.whatsapp_number, '[^0-9]', '', 'g') = v_sender_digits
      and (p_business_id is null or m.business_id = p_business_id)
  )
  select count(*)::int into v_count
  from matches;

  if v_count = 0 then
    return jsonb_build_object(
      'ok', false,
      'status', 'NOT_VERIFIED',
      'reason', 'NO_ACTIVE_VERIFIED_MEMBER_MATCH'
    );
  end if;

  if v_count > 1 then
    if p_business_id is null then
      with matches as (
        select m.business_id
        from public.business_members m
        join auth.users u on u.id = m.auth_user_id
        where m.is_active = true
          and m.auth_user_id is not null
          and m.whatsapp_number is not null
          and u.phone is not null
          and u.phone_confirmed_at is not null
          and regexp_replace(u.phone, '[^0-9]', '', 'g') = v_sender_digits
          and regexp_replace(m.whatsapp_number, '[^0-9]', '', 'g') = v_sender_digits
      ),
      businesses as (
        select distinct business_id from matches order by business_id
      )
      select jsonb_agg(to_jsonb(business_id)) into v_business_ids
      from businesses;

      return jsonb_build_object(
        'ok', false,
        'status', 'BUSINESS_CONTEXT_REQUIRED',
        'reason', 'MULTIPLE_ACTIVE_MEMBERSHIPS',
        'business_ids', coalesce(v_business_ids, '[]'::jsonb)
      );
    end if;

    return jsonb_build_object(
      'ok', false,
      'status', 'CONFIG_REQUIRED',
      'reason', 'MULTIPLE_MEMBER_MATCHES_IN_BUSINESS'
    );
  end if;

  select
    m.id,
    m.business_id,
    m.auth_user_id
  into
    v_member_id,
    v_resolved_business_id,
    v_auth_user_id
  from public.business_members m
  join auth.users u on u.id = m.auth_user_id
  where m.is_active = true
    and m.auth_user_id is not null
    and m.whatsapp_number is not null
    and u.phone is not null
    and u.phone_confirmed_at is not null
    and regexp_replace(u.phone, '[^0-9]', '', 'g') = v_sender_digits
    and regexp_replace(m.whatsapp_number, '[^0-9]', '', 'g') = v_sender_digits
    and (p_business_id is null or m.business_id = p_business_id)
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'status', 'RESOLVED',
    'member_id', v_member_id,
    'business_id', v_resolved_business_id,
    'auth_user_id', v_auth_user_id,
    'identity_basis', 'confirmed_auth_phone_matches_member_command_number'
  );
end;
$$;

revoke all on function public.vf_resolve_owner_member_by_sender_v1(text,uuid)
from public, anon, authenticated;

grant execute on function public.vf_resolve_owner_member_by_sender_v1(text,uuid)
to service_role;
