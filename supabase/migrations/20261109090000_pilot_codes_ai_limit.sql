-- Pilot access: a new account needs a sign-up code made by the platform
-- admin, unless the person was invited into a team. The check runs in the
-- sign-up trigger, so calling the auth API directly does not get around it.
-- Also a monthly AI cap per workspace, set only by the platform admin.

create table public.signup_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  -- Who the code is for, as the admin wrote it; optional address it is locked to.
  note text check (char_length(note) <= 200),
  email text check (email = lower(email) and char_length(email) <= 320),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 days',
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);
create index signup_codes_used_by_idx on public.signup_codes (used_by);

-- Server only (the admin page uses the service key): no access for app users.
alter table public.signup_codes enable row level security;
revoke all on public.signup_codes from anon, authenticated;

-- Whether a code would be accepted, for the sign-up form's message. Codes are
-- random, so answering this reveals nothing worth guessing for.
create function public.signup_code_status(p_code text, p_email text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when c.used_at is not null then 'used'
      when c.revoked_at is not null or c.expires_at < now() then 'expired'
      when c.email is not null and c.email <> lower(trim(p_email)) then 'other_email'
      else 'open'
    end
    from public.signup_codes c
    where c.code = upper(trim(p_code))
  ), 'unknown');
$$;
revoke all on function public.signup_code_status(text, text) from public;
grant execute on function public.signup_code_status(text, text) to anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
  display_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  given_code text := upper(nullif(trim(new.raw_user_meta_data ->> 'signup_code'), ''));
begin
  -- A team invitation for this address, or a user the admin invited from the
  -- Supabase dashboard, needs no code. Anyone else uses up a valid one.
  if not (
    new.invited_at is not null
    or exists (
      select 1 from public.organization_invitations i
      where i.email = lower(new.email) and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
    )
  ) then
    update public.signup_codes
    set used_at = now(), used_by = new.id
    where code = given_code
      and used_at is null and revoked_at is null and expires_at > now()
      and (email is null or email = lower(new.email));
    if not found then
      raise exception 'A valid sign-up code is required' using errcode = 'P0001';
    end if;
  end if;

  insert into public.profiles (id, full_name, email)
  values (new.id, display_name, new.email);

  insert into public.organizations (name, is_personal)
  values (coalesce(display_name, new.email), true)
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

-- Monthly AI calls allowed for the workspace; null means the server default
-- (AI_MONTHLY_LIMIT). Members can read it but not change it: their update
-- grant on organizations covers the name only.
alter table public.organizations
  add column ai_monthly_limit integer check (ai_monthly_limit >= 0);

create index ai_processing_logs_org_created_idx on public.ai_processing_logs (organization_id, created_at desc);

-- For the platform admin page (service key only): each workspace with its
-- owner and its AI calls and tokens since p_since.
create function public.admin_workspace_ai_usage(p_since timestamptz)
returns table (
  organization_id uuid,
  name text,
  is_personal boolean,
  owner_email text,
  members integer,
  ai_monthly_limit integer,
  calls integer,
  input_tokens bigint,
  output_tokens bigint,
  created_at timestamptz
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
    (select p.email from public.organization_members m join public.profiles p on p.id = m.user_id
      where m.organization_id = o.id and m.role = 'owner' limit 1),
    (select count(*)::integer from public.organization_members m where m.organization_id = o.id),
    o.ai_monthly_limit,
    count(l.id)::integer,
    coalesce(sum(l.input_tokens), 0)::bigint,
    coalesce(sum(l.output_tokens), 0)::bigint,
    o.created_at
  from public.organizations o
  left join public.ai_processing_logs l
    on l.organization_id = o.id and l.created_at >= p_since and l.status <> 'rejected'
  group by o.id;
$$;
revoke all on function public.admin_workspace_ai_usage(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_workspace_ai_usage(timestamptz) to service_role;
