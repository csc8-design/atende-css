
SELECT cron.schedule(
  'check-inactivity-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rivfqexositrxqtwmmpi.supabase.co/functions/v1/check-inactivity',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdmZxZXhvc2l0cnhxdHdtbXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDk3MzUsImV4cCI6MjA4NzUyNTczNX0.fo-zxuRZd96NDDzddlEYMNa6nZFO1Wc86Qu91sNFa7s"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
