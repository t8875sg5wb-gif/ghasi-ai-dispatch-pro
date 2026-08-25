CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('archive-mcp-audit-logs')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'archive-mcp-audit-logs');

SELECT cron.schedule(
  'archive-mcp-audit-logs',
  '20 3 * * *',
  $$
  SELECT public.archive_mcp_audit_logs(
    COALESCE((SELECT mcp_audit_retention_months FROM public.company_settings WHERE singleton = 1), 12)
  );
  $$
);