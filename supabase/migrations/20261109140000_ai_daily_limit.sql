-- A daily AI cap per workspace, next to the monthly one: the AI provider's
-- free tier is counted per day and shared by every workspace. Null means the
-- server default (AI_DAILY_LIMIT). Set by the platform admin only; members'
-- update grant on organizations covers the name only.
alter table public.organizations
  add column ai_daily_limit integer check (ai_daily_limit >= 0);

-- For the admin page: each workspace's AI calls since p_since (the start of today).
create function public.admin_workspace_calls_since(p_since timestamptz)
returns table (organization_id uuid, calls integer, ai_daily_limit integer)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id,
    (select count(*)::integer from public.ai_processing_logs l where l.organization_id = o.id and l.created_at >= p_since and l.status <> 'rejected'),
    o.ai_daily_limit
  from public.organizations o;
$$;
revoke all on function public.admin_workspace_calls_since(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_workspace_calls_since(timestamptz) to service_role;
