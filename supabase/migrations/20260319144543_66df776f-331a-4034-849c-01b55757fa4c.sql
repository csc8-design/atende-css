
-- Enable pg_cron extension
create extension if not exists pg_cron with schema pg_catalog;

-- Function to delete messages older than 2 years
create or replace function public.cleanup_old_messages()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.messages
  where created_at < now() - interval '2 years';
end;
$$;

-- Schedule daily cleanup at 3:00 AM UTC
select cron.schedule(
  'cleanup-old-messages',
  '0 3 * * *',
  $$select public.cleanup_old_messages()$$
);
