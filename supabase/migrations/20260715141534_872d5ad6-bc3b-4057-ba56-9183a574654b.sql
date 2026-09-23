
SELECT cron.schedule(
  'auto-check-mass-evolution-responses',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url := 'https://rivfqexositrxqtwmmpi.supabase.co/functions/v1/check-mass-campaign-responses',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdmZxZXhvc2l0cnhxdHdtbXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDk3MzUsImV4cCI6MjA4NzUyNTczNX0.fo-zxuRZd96NDDzddlEYMNa6nZFO1Wc86Qu91sNFa7s"}'::jsonb,
    body := '{}'::jsonb
  );$$
);

SELECT cron.schedule(
  'auto-check-meta-campaign-responses',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url := 'https://rivfqexositrxqtwmmpi.supabase.co/functions/v1/check-meta-campaign-responses',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdmZxZXhvc2l0cnhxdHdtbXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDk3MzUsImV4cCI6MjA4NzUyNTczNX0.fo-zxuRZd96NDDzddlEYMNa6nZFO1Wc86Qu91sNFa7s"}'::jsonb,
    body := '{}'::jsonb
  );$$
);
