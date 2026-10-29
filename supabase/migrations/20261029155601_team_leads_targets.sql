-- Team work: who gets a new client (the agent who added it, or in turn among
-- the agents the owner picked), a heads-up for an agent who got one, and
-- monthly targets per agent.

alter table public.organizations
  add column lead_assignment text not null default 'creator' check (lead_assignment in ('creator', 'round_robin'));

alter table public.organization_members
  add column in_lead_rotation boolean not null default true,
  add column last_lead_at timestamptz;

-- Owners and admins choose who is in the rotation; nothing else of a membership changes this way.
grant update (in_lead_rotation) on public.organization_members to authenticated;
create policy "owners and admins set the lead rotation" on public.organization_members for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']));

-- When a client given to someone else was announced to them.
alter table public.clients add column lead_notified_at timestamptz;

-- A new client without an agent goes to the one who added it, or (in rotation
-- mode) to the agent in the rotation who got a client longest ago.
create function private.assign_new_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mode text;
  pick uuid;
begin
  if new.assigned_to is null then
    select lead_assignment into mode from public.organizations where id = new.organization_id;
    if mode = 'round_robin' then
      select m.user_id into pick
        from public.organization_members m
       where m.organization_id = new.organization_id and m.in_lead_rotation
       order by m.last_lead_at nulls first, m.created_at
       limit 1
       for update skip locked;
      if pick is not null then
        new.assigned_to := pick;
        update public.organization_members set last_lead_at = now() where organization_id = new.organization_id and user_id = pick;
      end if;
    end if;
    if new.assigned_to is null then
      new.assigned_to := new.created_by;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.assign_new_client() from public;
create trigger assign_new_client before insert on public.clients for each row execute function private.assign_new_client();

create table public.agent_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  commission numeric(14, 2) check (commission >= 0),
  deals integer check (deals >= 0),
  listings integer check (listings >= 0),
  viewings integer check (viewings >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, month)
);
create trigger set_updated_at before update on public.agent_targets for each row execute function private.set_updated_at();
create trigger prevent_org_change before update on public.agent_targets for each row execute function private.prevent_org_change();
revoke all on public.agent_targets from anon, authenticated;
grant select, insert, update, delete on public.agent_targets to authenticated;
alter table public.agent_targets enable row level security;
create policy "members read" on public.agent_targets for select to authenticated using (private.is_org_member(organization_id));
create policy "owners and admins write" on public.agent_targets for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin']) and private.is_member_or_null(organization_id, user_id));
create policy "owners and admins update" on public.agent_targets for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']) and private.is_member_or_null(organization_id, user_id));
create policy "owners and admins delete" on public.agent_targets for delete to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));
