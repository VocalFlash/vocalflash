
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

alter function vocalflash_internal.validate_work_event_link_revoke()
  set search_path = '';

revoke truncate on table public.work_events from service_role;
