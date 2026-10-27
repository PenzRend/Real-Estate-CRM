-- GDPR erasure of one client, for the workspace owner and admins: the client
-- and everything about them leaves Flavio in one transaction. Conversations,
-- tasks, viewings, matches and listing links go by the foreign keys' cascades;
-- listings they own stay, without the owner. Emails to or from them are only
-- unlinked by the foreign key, so they are deleted here, in every member's
-- copy (each member can otherwise delete only their own emails). Gmail itself
-- keeps its messages: that is the mailbox owner's own account.
create function public.erase_client(p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.clients;
  address text;
  n_emails int;
  n_interactions int;
  n_tasks int;
  n_viewings int;
begin
  select * into c from public.clients where id = p_client_id;
  if not found or not private.has_org_role(c.organization_id, array['owner', 'admin']) then
    raise exception 'client_not_found';
  end if;
  address := nullif(lower(trim(c.email)), '');

  select count(*) into n_interactions from public.interactions where client_id = c.id;
  select count(*) into n_tasks from public.tasks where client_id = c.id;
  select count(*) into n_viewings from public.viewings where client_id = c.id;

  delete from public.emails e
  where e.organization_id = c.organization_id
    and (
      e.client_id = c.id
      or (address is not null and (lower(e.from_email) = address or lower(e.reply_to_email) = address or address = any (select lower(t) from unnest(e.to_emails) t)))
    );
  get diagnostics n_emails = row_count;

  delete from public.clients where id = c.id;

  return jsonb_build_object('emails', n_emails, 'interactions', n_interactions, 'tasks', n_tasks, 'viewings', n_viewings);
end;
$$;

revoke all on function public.erase_client(uuid) from public, anon;
grant execute on function public.erase_client(uuid) to authenticated;
