-- The platform admin dashboard (/admin). Totals across every workspace, read
-- through the service key only: none of these can be called by app users.
-- Counts and account facts only; no client's personal data leaves here.

-- Headline numbers.
create function public.admin_overview(p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with seen as (
    select u.id, greatest(u.last_sign_in_at, (select max(v.last_seen_at) from public.user_visits v where v.user_id = u.id)) as at
    from auth.users u
  )
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_confirmed', (select count(*) from auth.users where email_confirmed_at is not null),
    'signups_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'signups_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'active_1d', (select count(*) from seen where at > now() - interval '1 day'),
    'active_7d', (select count(*) from seen where at > now() - interval '7 days'),
    'active_30d', (select count(*) from seen where at > now() - interval '30 days'),
    'workspaces', (select count(*) from public.organizations),
    'teams', (select count(*) from public.organizations o where (select count(*) from public.organization_members m where m.organization_id = o.id) > 1),
    'ai_calls', (select count(*) from public.ai_processing_logs where created_at >= p_since and status <> 'rejected'),
    'ai_errors', (select count(*) from public.ai_processing_logs where created_at >= p_since and status = 'error'),
    'ai_tokens', (select coalesce(sum(coalesce(input_tokens, 0) + coalesce(output_tokens, 0)), 0) from public.ai_processing_logs where created_at >= p_since),
    'clients', (select count(*) from public.clients where archived_at is null),
    'properties', (select count(*) from public.properties where archived_at is null),
    'interactions', (select count(*) from public.interactions),
    'viewings', (select count(*) from public.viewings),
    'deals', (select count(*) from public.deals),
    'tasks_open', (select count(*) from public.tasks where status in ('todo', 'in_progress')),
    'created_month', (
      (select count(*) from public.clients where created_at >= p_since)
      + (select count(*) from public.properties where created_at >= p_since)
      + (select count(*) from public.interactions where created_at >= p_since)
      + (select count(*) from public.viewings where created_at >= p_since)
      + (select count(*) from public.tasks where created_at >= p_since)
    ),
    'mailboxes', (select count(*) from public.mailboxes where status = 'active'),
    'mailboxes_broken', (select count(*) from public.mailboxes where status <> 'active'),
    'push_devices', (select count(*) from public.push_subscriptions),
    'phone_keys', (select count(*) from public.phone_keys where revoked_at is null),
    'feedback_7d', (select count(*) from public.product_feedback where created_at > now() - interval '7 days'),
    'codes_open', (select count(*) from public.signup_codes where used_at is null and revoked_at is null and expires_at > now()),
    'codes_used', (select count(*) from public.signup_codes where used_at is not null)
  );
$$;

-- One row per day for the last p_days days (Budapest days).
create function public.admin_daily(p_days integer)
returns table (day date, signups integer, ai_calls integer, ai_errors integer, records integer)
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select generate_series(
      (now() at time zone 'Europe/Budapest')::date - (p_days - 1),
      (now() at time zone 'Europe/Budapest')::date,
      interval '1 day'
    )::date as day
  ),
  bounds as (select (min(day)::timestamp at time zone 'Europe/Budapest') as since from days),
  made as (
    select created_at from public.clients union all
    select created_at from public.properties union all
    select created_at from public.interactions union all
    select created_at from public.viewings union all
    select created_at from public.tasks
  )
  select
    d.day,
    (select count(*)::integer from auth.users u where (u.created_at at time zone 'Europe/Budapest')::date = d.day),
    (select count(*)::integer from public.ai_processing_logs l where l.created_at >= (select since from bounds) and (l.created_at at time zone 'Europe/Budapest')::date = d.day and l.status <> 'rejected'),
    (select count(*)::integer from public.ai_processing_logs l where l.created_at >= (select since from bounds) and (l.created_at at time zone 'Europe/Budapest')::date = d.day and l.status = 'error'),
    (select count(*)::integer from made m where m.created_at >= (select since from bounds) and (m.created_at at time zone 'Europe/Budapest')::date = d.day)
  from days d
  order by d.day;
$$;

-- Every account, with what it has done.
create function public.admin_users(p_since timestamptz)
returns table (
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  confirmed boolean,
  last_sign_in_at timestamptz,
  last_seen_at timestamptz,
  workspaces text,
  role text,
  ai_calls integer,
  clients integer,
  properties integer,
  interactions integer,
  viewings integer,
  mailboxes integer,
  push_devices integer,
  signup_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email::text,
    p.full_name,
    u.created_at,
    u.email_confirmed_at is not null,
    u.last_sign_in_at,
    (select max(v.last_seen_at) from public.user_visits v where v.user_id = u.id),
    (select string_agg(o.name, ', ' order by o.is_personal, o.name) from public.organization_members m join public.organizations o on o.id = m.organization_id where m.user_id = u.id),
    (select m.role from public.organization_members m join public.organizations o on o.id = m.organization_id where m.user_id = u.id order by o.is_personal limit 1),
    (select count(*)::integer from public.ai_processing_logs l where l.user_id = u.id and l.created_at >= p_since and l.status <> 'rejected'),
    (select count(*)::integer from public.clients c where c.created_by = u.id),
    (select count(*)::integer from public.properties x where x.created_by = u.id),
    (select count(*)::integer from public.interactions i where i.created_by = u.id),
    (select count(*)::integer from public.viewings w where w.created_by = u.id),
    (select count(*)::integer from public.mailboxes b where b.user_id = u.id and b.status = 'active'),
    (select count(*)::integer from public.push_subscriptions s where s.user_id = u.id),
    (select c.code from public.signup_codes c where c.used_by = u.id limit 1)
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc
  limit 1000;
$$;

-- Every workspace with its size, activity, AI use and stored files.
create function public.admin_workspaces(p_since timestamptz)
returns table (
  organization_id uuid,
  name text,
  is_personal boolean,
  owner_email text,
  members integer,
  created_at timestamptz,
  last_activity_at timestamptz,
  ai_monthly_limit integer,
  ai_calls integer,
  ai_tokens bigint,
  clients integer,
  properties integer,
  interactions integer,
  viewings integer,
  deals integer,
  tasks_open integer,
  mailboxes integer,
  storage_bytes bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    o.name,
    o.is_personal,
    (select p.email from public.organization_members m join public.profiles p on p.id = m.user_id where m.organization_id = o.id and m.role = 'owner' limit 1),
    (select count(*)::integer from public.organization_members m where m.organization_id = o.id),
    o.created_at,
    (select max(v.last_seen_at) from public.user_visits v where v.organization_id = o.id),
    o.ai_monthly_limit,
    (select count(*)::integer from public.ai_processing_logs l where l.organization_id = o.id and l.created_at >= p_since and l.status <> 'rejected'),
    (select coalesce(sum(coalesce(l.input_tokens, 0) + coalesce(l.output_tokens, 0)), 0)::bigint from public.ai_processing_logs l where l.organization_id = o.id and l.created_at >= p_since),
    (select count(*)::integer from public.clients c where c.organization_id = o.id and c.archived_at is null),
    (select count(*)::integer from public.properties x where x.organization_id = o.id and x.archived_at is null),
    (select count(*)::integer from public.interactions i where i.organization_id = o.id),
    (select count(*)::integer from public.viewings w where w.organization_id = o.id),
    (select count(*)::integer from public.deals d where d.organization_id = o.id),
    (select count(*)::integer from public.tasks t where t.organization_id = o.id and t.status in ('todo', 'in_progress')),
    (select count(*)::integer from public.mailboxes b where b.organization_id = o.id and b.status = 'active'),
    -- Files are stored under the workspace's id.
    (select coalesce(sum((s.metadata ->> 'size')::bigint), 0)::bigint from storage.objects s where s.name like o.id::text || '/%')
  from public.organizations o;
$$;

-- AI calls this month by feature, model and outcome.
create function public.admin_ai_breakdown(p_since timestamptz)
returns table (operation_type text, model text, status text, calls integer, input_tokens bigint, output_tokens bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select l.operation_type, coalesce(l.model, '—'), l.status, count(*)::integer,
    coalesce(sum(l.input_tokens), 0)::bigint, coalesce(sum(l.output_tokens), 0)::bigint
  from public.ai_processing_logs l
  where l.created_at >= p_since
  group by 1, 2, 3
  order by 4 desc;
$$;

-- What needs looking after: database and file sizes, mail sync, failed sends.
create function public.admin_system()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', (select coalesce(sum((metadata ->> 'size')::bigint), 0) from storage.objects),
    'storage_files', (select count(*) from storage.objects),
    'last_mail_sync', (select max(last_synced_at) from public.mailboxes where status = 'active'),
    'mailboxes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'email', b.email_address, 'provider', b.provider, 'status', b.status,
        'last_error', left(b.last_error, 300), 'last_synced_at', b.last_synced_at, 'owner', p.email
      ) order by b.status <> 'active' desc, b.last_synced_at nulls first)
      from public.mailboxes b left join public.profiles p on p.id = b.user_id
    ), '[]'::jsonb),
    'outbox', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) as n from public.email_outbox group by status) s),
    'outbox_failed', coalesce((
      select jsonb_agg(jsonb_build_object('subject', left(e.subject, 120), 'error', left(e.error, 300), 'at', e.updated_at, 'owner', p.email) order by e.updated_at desc)
      from (select * from public.email_outbox where status = 'failed' order by updated_at desc limit 20) e
      left join public.profiles p on p.id = e.user_id
    ), '[]'::jsonb),
    'reports_failed', (select count(*) from public.seller_reports where error is not null),
    'calendar_errors', coalesce((
      select jsonb_agg(jsonb_build_object('kind', c.kind, 'error', left(c.last_error, 300), 'owner', p.email))
      from public.calendar_subscriptions c left join public.profiles p on p.id = c.user_id
      where c.last_error is not null
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.admin_overview(timestamptz) from public, anon, authenticated;
revoke all on function public.admin_daily(integer) from public, anon, authenticated;
revoke all on function public.admin_users(timestamptz) from public, anon, authenticated;
revoke all on function public.admin_workspaces(timestamptz) from public, anon, authenticated;
revoke all on function public.admin_ai_breakdown(timestamptz) from public, anon, authenticated;
revoke all on function public.admin_system() from public, anon, authenticated;
grant execute on function public.admin_overview(timestamptz) to service_role;
grant execute on function public.admin_daily(integer) to service_role;
grant execute on function public.admin_users(timestamptz) to service_role;
grant execute on function public.admin_workspaces(timestamptz) to service_role;
grant execute on function public.admin_ai_breakdown(timestamptz) to service_role;
grant execute on function public.admin_system() to service_role;
