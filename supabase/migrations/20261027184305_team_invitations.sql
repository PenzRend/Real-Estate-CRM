-- Team invitations: an owner or admin invites a colleague by email into the
-- workspace. The link carries a random token; only its SHA-256 hash is stored.
-- The invite works only for the address it was made for.

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 320),
  role text not null default 'member' check (role in ('admin', 'member')),
  token_hash text not null unique check (char_length(token_hash) = 64),
  invited_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz
);
create index organization_invitations_org_idx on public.organization_invitations (organization_id, created_at desc);
create index organization_invitations_invited_by_idx on public.organization_invitations (invited_by);
create index organization_invitations_accepted_by_idx on public.organization_invitations (accepted_by);
-- One open invitation per address and workspace; a new one revokes the old first.
create unique index organization_invitations_open_email_idx on public.organization_invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;

create trigger prevent_org_change before update on public.organization_invitations
  for each row execute function private.prevent_org_change();

alter table public.organization_invitations enable row level security;
grant select, insert, update (token_hash, expires_at, revoked_at) on public.organization_invitations to authenticated;

create policy "owners and admins read invitations" on public.organization_invitations
  for select to authenticated using (private.has_org_role(organization_id, array['owner', 'admin']));
create policy "owners and admins invite" on public.organization_invitations
  for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin']) and invited_by = (select auth.uid()));
create policy "owners and admins renew or revoke invitations" on public.organization_invitations
  for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']));

-- Removing people: the owner removes anyone but themselves, an admin removes
-- members, and anyone but the owner can leave. The owner is never removed.
grant delete on public.organization_members to authenticated;
create policy "remove members or leave" on public.organization_members
  for delete to authenticated
  using (
    role <> 'owner'
    and (
      user_id = (select auth.uid())
      or private.has_org_role(organization_id, array['owner'])
      or (role = 'member' and private.has_org_role(organization_id, array['admin']))
    )
  );

-- What the invite page shows before sign-in. The hash is unguessable, so
-- knowing it is the permission; nothing else about the workspace is exposed.
create function public.invitation_preview(p_token_hash text)
returns table (organization_name text, invited_by_name text, email text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.name,
    coalesce(p.full_name, p.email),
    i.email,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at < now() then 'expired'
      else 'open'
    end
  from public.organization_invitations i
  join public.organizations o on o.id = i.organization_id
  left join public.profiles p on p.id = i.invited_by
  where i.token_hash = p_token_hash;
$$;

-- Joins the signed-in user to the invitation's workspace. Errors carry a
-- short code the app translates: invite_not_found, invite_closed,
-- invite_used, invite_wrong_email.
create function public.accept_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.organization_invitations;
  user_email text;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select * into inv from public.organization_invitations where token_hash = p_token_hash for update;
  if not found then
    raise exception 'invite_not_found';
  end if;
  if inv.accepted_at is not null then
    if inv.accepted_by = uid then
      return inv.organization_id;
    end if;
    raise exception 'invite_used';
  end if;
  if inv.revoked_at is not null or inv.expires_at < now() then
    raise exception 'invite_closed';
  end if;

  select lower(u.email) into user_email from auth.users u where u.id = uid;
  if user_email is distinct from inv.email then
    raise exception 'invite_wrong_email';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (inv.organization_id, uid, inv.role)
  on conflict (organization_id, user_id) do nothing;

  update public.organization_invitations set accepted_at = now(), accepted_by = uid where id = inv.id;
  -- A workspace with more than one person is a team, not someone's personal space.
  update public.organizations set is_personal = false where id = inv.organization_id;

  return inv.organization_id;
end;
$$;

revoke all on function public.invitation_preview(text), public.accept_invitation(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
