-- Initial MVP schema: workspaces, profiles, clients, properties,
-- interactions, tasks, AI processing log. See docs/PLAN.md §3–4.
--
-- Authorization model: every business row has organization_id; a user can
-- touch a row only if they are a member of that organization. Child rows use
-- composite foreign keys (x_id, organization_id) so they can never reference
-- a row in another organization.

create extension if not exists pg_trgm with schema extensions;

-- Helpers live in a schema that is not exposed through the API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Workspaces and users
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  is_personal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 200),
  email text not null,
  timezone text not null default 'Europe/Budapest',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index organization_members_user_id_idx on public.organization_members (user_id);

-- Membership checks. SECURITY DEFINER so policies on organization_members
-- itself do not recurse.
create function private.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id and m.user_id = (select auth.uid())
  );
$$;

create function private.has_org_role(org_id uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and m.role = any (roles)
  );
$$;

-- True when p_user_id is null or is a member of p_org_id. Used for assigned_to.
create function private.is_member_or_null(p_org_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is null or exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org_id and m.user_id = p_user_id
  );
$$;

revoke all on function private.is_org_member(uuid), private.has_org_role(uuid, text[]),
  private.is_member_or_null(uuid, uuid) from public, anon;
grant execute on function private.is_org_member(uuid), private.has_org_role(uuid, text[]),
  private.is_member_or_null(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Generic triggers
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function private.prevent_org_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- On sign-up: profile + personal workspace + owner membership.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
  display_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
begin
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  assigned_to uuid references public.profiles (id) on delete set null,
  full_name text not null check (char_length(full_name) between 1 and 200),
  email text check (char_length(email) <= 320),
  phone text check (char_length(phone) <= 50),
  client_type text not null default 'buyer'
    check (client_type in ('buyer', 'seller', 'owner', 'investor', 'tenant', 'other')),
  status text not null default 'new_lead'
    check (status in ('new_lead', 'contacted', 'qualified', 'active', 'negotiation',
                      'converted', 'lost', 'archived')),
  notes text,
  -- Requirements (explicit columns: they are filtered and matched on)
  budget_min numeric(14, 2) check (budget_min >= 0),
  budget_max numeric(14, 2) check (budget_max >= 0),
  budget_currency text not null default 'HUF' check (budget_currency in ('HUF', 'EUR')),
  preferred_locations text[] not null default '{}',
  preferred_property_types text[] not null default '{}'
    check (preferred_property_types <@ array['apartment', 'house', 'plot', 'commercial', 'other']),
  min_rooms numeric(4, 1) check (min_rooms >= 0),
  min_bedrooms smallint check (min_bedrooms >= 0),
  min_area_sqm numeric(8, 2) check (min_area_sqm >= 0),
  max_area_sqm numeric(8, 2) check (max_area_sqm >= 0),
  preferred_condition text,
  desired_move_date date,
  other_requirements text,
  lead_source text,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, organization_id),
  check (budget_min is null or budget_max is null or budget_min <= budget_max),
  check (min_area_sqm is null or max_area_sqm is null or min_area_sqm <= max_area_sqm)
);
create index clients_org_status_idx on public.clients (organization_id, status) where archived_at is null;
create index clients_org_follow_up_idx on public.clients (organization_id, next_follow_up_at) where archived_at is null;
create index clients_assigned_to_idx on public.clients (assigned_to);
create index clients_full_name_trgm_idx on public.clients using gin (full_name extensions.gin_trgm_ops);
create index clients_email_trgm_idx on public.clients using gin (email extensions.gin_trgm_ops);
create index clients_phone_trgm_idx on public.clients using gin (phone extensions.gin_trgm_ops);
create index clients_locations_idx on public.clients using gin (preferred_locations);

-- ---------------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------------

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  assigned_to uuid references public.profiles (id) on delete set null,
  owner_client_id uuid,
  title text not null check (char_length(title) between 1 and 300),
  reference_number text check (char_length(reference_number) <= 100),
  property_type text not null default 'apartment'
    check (property_type in ('apartment', 'house', 'plot', 'commercial', 'other')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'reserved', 'under_negotiation', 'sold', 'rented', 'inactive')),
  listing_type text not null default 'sale' check (listing_type in ('sale', 'rent')),
  country text not null default 'HU',
  city text,
  district text,
  address text,
  postal_code text,
  price numeric(14, 2) check (price >= 0),
  currency text not null default 'HUF' check (currency in ('HUF', 'EUR')),
  area_sqm numeric(8, 2) check (area_sqm >= 0),
  room_count numeric(4, 1) check (room_count >= 0),
  bedroom_count smallint check (bedroom_count >= 0),
  bathroom_count smallint check (bathroom_count >= 0),
  floor text,
  building_type text,
  condition text,
  has_balcony boolean,
  has_garden boolean,
  has_parking boolean,
  energy_rating text,
  description text,
  internal_notes text,
  listing_source text,
  features jsonb not null default '{}' check (jsonb_typeof(features) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, organization_id),
  unique (organization_id, reference_number),
  foreign key (owner_client_id, organization_id)
    references public.clients (id, organization_id) on delete set null (owner_client_id)
);
create index properties_org_status_idx on public.properties (organization_id, status) where archived_at is null;
create index properties_org_city_district_idx on public.properties (organization_id, city, district);
create index properties_org_price_idx on public.properties (organization_id, price);
create index properties_owner_client_idx on public.properties (owner_client_id);
create index properties_title_trgm_idx on public.properties using gin (title extensions.gin_trgm_ops);

-- Client ↔ property relationship (interested, viewed, offered, …).
create table public.property_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null,
  client_id uuid not null,
  relation text not null default 'interested'
    check (relation in ('interested', 'viewed', 'offered', 'rejected')),
  notes text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, client_id),
  foreign key (property_id, organization_id)
    references public.properties (id, organization_id) on delete cascade,
  foreign key (client_id, organization_id)
    references public.clients (id, organization_id) on delete cascade
);
create index property_clients_client_idx on public.property_clients (client_id);

-- ---------------------------------------------------------------------------
-- Interactions (timeline)
-- ---------------------------------------------------------------------------

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid,
  property_id uuid,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  interaction_type text not null
    check (interaction_type in ('call', 'email', 'meeting', 'viewing', 'note', 'other')),
  occurred_at timestamptz not null default now(),
  summary text check (char_length(summary) <= 1000),
  notes text check (char_length(notes) <= 20000),
  outcome text check (char_length(outcome) <= 2000),
  follow_up_required boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'ai_assisted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  check (client_id is not null or property_id is not null),
  foreign key (client_id, organization_id)
    references public.clients (id, organization_id) on delete cascade,
  foreign key (property_id, organization_id)
    references public.properties (id, organization_id) on delete set null (property_id)
);
create index interactions_client_occurred_idx on public.interactions (client_id, occurred_at desc);
create index interactions_property_occurred_idx on public.interactions (property_id, occurred_at desc);
create index interactions_org_occurred_idx on public.interactions (organization_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  assigned_to uuid references public.profiles (id) on delete set null,
  client_id uuid,
  property_id uuid,
  interaction_id uuid,
  title text not null check (char_length(title) between 1 and 300),
  description text check (char_length(description) <= 5000),
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'completed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  due_at timestamptz,
  completed_at timestamptz,
  source text not null default 'manual' check (source in ('manual', 'ai_suggestion')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'completed') = (completed_at is not null)),
  foreign key (client_id, organization_id)
    references public.clients (id, organization_id) on delete cascade,
  foreign key (property_id, organization_id)
    references public.properties (id, organization_id) on delete set null (property_id),
  foreign key (interaction_id, organization_id)
    references public.interactions (id, organization_id) on delete set null (interaction_id)
);
create index tasks_org_open_due_idx on public.tasks (organization_id, due_at)
  where status in ('todo', 'in_progress');
create index tasks_client_idx on public.tasks (client_id);
create index tasks_assigned_to_idx on public.tasks (assigned_to);

-- ---------------------------------------------------------------------------
-- AI processing log (metadata only — never note content)
-- ---------------------------------------------------------------------------

create table public.ai_processing_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null default auth.uid(),
  operation_type text not null
    check (operation_type in ('extract_interaction', 'client_summary', 'next_actions', 'assistant')),
  related_entity_type text check (related_entity_type in ('client', 'property', 'interaction')),
  related_entity_id uuid,
  status text not null check (status in ('success', 'error', 'rejected')),
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create index ai_processing_logs_user_created_idx on public.ai_processing_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array['clients', 'properties', 'property_clients', 'interactions', 'tasks'] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
    execute format(
      'create trigger prevent_org_change before update on public.%I
         for each row execute function private.prevent_org_change()', t);
  end loop;
end;
$$;

create trigger prevent_org_change before update on public.organization_members
  for each row execute function private.prevent_org_change();

-- ---------------------------------------------------------------------------
-- Grants: nothing for anon; explicit privileges for authenticated, then RLS.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

grant select, update (name) on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select, update (full_name, timezone) on public.profiles to authenticated;
grant select, insert, update, delete on
  public.clients, public.properties, public.property_clients,
  public.interactions, public.tasks
  to authenticated;
grant select on public.ai_processing_logs to authenticated;
-- ai_processing_logs inserts happen from server code as the user:
grant insert on public.ai_processing_logs to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.properties enable row level security;
alter table public.property_clients enable row level security;
alter table public.interactions enable row level security;
alter table public.tasks enable row level security;
alter table public.ai_processing_logs enable row level security;

create policy "members read their organizations" on public.organizations
  for select to authenticated using (private.is_org_member(id));
create policy "owners and admins update their organizations" on public.organizations
  for update to authenticated
  using (private.has_org_role(id, array['owner', 'admin']))
  with check (private.has_org_role(id, array['owner', 'admin']));

create policy "members read memberships of their organizations" on public.organization_members
  for select to authenticated using (private.is_org_member(organization_id));

create policy "users read own profile and fellow members" on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or exists (
      select 1 from public.organization_members m
      where m.user_id = profiles.id and private.is_org_member(m.organization_id)
    )
  );
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Business tables: same four policies each.
do $$
declare
  t text;
  has_assignee boolean;
begin
  foreach t in array array['clients', 'properties', 'property_clients', 'interactions', 'tasks'] loop
    has_assignee := t in ('clients', 'properties', 'tasks');

    execute format(
      'create policy "members read" on public.%I for select to authenticated
         using (private.is_org_member(organization_id))', t);

    execute format(
      'create policy "members insert" on public.%I for insert to authenticated
         with check (private.is_org_member(organization_id)
                     and created_by = (select auth.uid())%s)',
      t, case when has_assignee then ' and private.is_member_or_null(organization_id, assigned_to)' else '' end);

    execute format(
      'create policy "members update" on public.%I for update to authenticated
         using (private.is_org_member(organization_id))
         with check (private.is_org_member(organization_id)%s)',
      t, case when has_assignee then ' and private.is_member_or_null(organization_id, assigned_to)' else '' end);

    execute format(
      'create policy "owners and admins delete" on public.%I for delete to authenticated
         using (private.has_org_role(organization_id, array[''owner'', ''admin'']))', t);
  end loop;
end;
$$;

create policy "members read own org AI logs" on public.ai_processing_logs
  for select to authenticated using (private.is_org_member(organization_id));
create policy "members insert own AI logs" on public.ai_processing_logs
  for insert to authenticated
  with check (private.is_org_member(organization_id) and user_id = (select auth.uid()));
