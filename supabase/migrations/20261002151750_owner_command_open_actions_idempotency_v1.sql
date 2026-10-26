
create unique index if not exists open_actions_owner_command_source_uidx
on public.open_actions (
  business_id,
  (metadata->>'owner_command_source_event_id')
)
where metadata ? 'owner_command_source_event_id';
