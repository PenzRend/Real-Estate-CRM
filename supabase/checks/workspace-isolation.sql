-- Workspace isolation check for a hosted Flavio database (dev or production).
--
-- Creates a temporary user (with their own workspace, through the normal
-- sign-up trigger), acts as that user, and tries to read and change another
-- workspace's data: every table in `public`, the photo storage, and the usual
-- write paths. It ALWAYS rolls back: the block ends with an error whose
-- message is the report, so nothing it created or changed is kept.
--
-- Run it in the Supabase SQL editor (or the MCP execute_sql tool) after
-- applying migrations. The database needs at least one existing workspace;
-- it is more thorough when that workspace has clients and listings.
-- Expected last line: "RESULT: 0 failures".

do $$
declare
  intruder uuid := gen_random_uuid();
  own_org uuid;
  victim_org uuid;
  victim_client uuid;
  own_client uuid;
  t text;
  n bigint;
  expected int;
  failures int := 0;
  report text := '';
begin
  select id into victim_org from public.organizations limit 1;
  if victim_org is null then
    raise exception 'No workspace to test against: sign up once, then run this again.';
  end if;
  select id into victim_client from public.clients where organization_id = victim_org limit 1;
  select count(*) into n from public.clients where organization_id = victim_org;
  report := report || format(E'\nTarget workspace has %s clients.', n);

  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (intruder, 'isolation-check-' || intruder || '@example.test', '{"full_name": "Isolation check"}', 'authenticated', 'authenticated');
  select organization_id into own_org from public.organization_members where user_id = intruder;

  -- From here on, everything runs as the signed-in intruder.
  perform set_config('request.jwt.claims', json_build_object('sub', intruder, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- Reads: only the intruder's own profile, workspace and membership.
  for t in
    select c.relname from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind = 'r' order by 1
  loop
    begin
      execute format('select count(*) from public.%I', t) into n;
    exception when insufficient_privilege then
      n := 0;
    end;
    expected := case when t in ('organizations', 'organization_members', 'profiles') then 1 else 0 end;
    if n <> expected then
      failures := failures + 1;
      report := report || format(E'\nFAIL read %s: sees %s rows, expected %s', t, n, expected);
    else
      report := report || format(E'\nok   read %s', t);
    end if;
  end loop;

  select count(*) into n from storage.objects;
  if n <> 0 then
    failures := failures + 1;
    report := report || format(E'\nFAIL read storage: sees %s files', n);
  else
    report := report || E'\nok   read storage';
  end if;

  -- Writes into the other workspace.
  begin
    insert into public.clients (organization_id, full_name, created_by) values (victim_org, 'Isolation check', intruder);
    failures := failures + 1;
    report := report || E'\nFAIL write: created a client in another workspace';
  exception when others then
    report := report || format(E'\nok   write: client in another workspace blocked (%s)', sqlstate);
  end;

  begin
    update public.clients set full_name = full_name where organization_id = victim_org;
    get diagnostics n = row_count;
    if n <> 0 then
      failures := failures + 1;
      report := report || format(E'\nFAIL write: updated %s clients in another workspace', n);
    else
      report := report || E'\nok   write: update in another workspace touched nothing';
    end if;
  exception when others then
    report := report || format(E'\nok   write: update in another workspace blocked (%s)', sqlstate);
  end;

  begin
    delete from public.clients where organization_id = victim_org;
    get diagnostics n = row_count;
    if n <> 0 then
      failures := failures + 1;
      report := report || format(E'\nFAIL write: deleted %s clients in another workspace', n);
    else
      report := report || E'\nok   write: delete in another workspace touched nothing';
    end if;
  exception when others then
    report := report || format(E'\nok   write: delete in another workspace blocked (%s)', sqlstate);
  end;

  -- Own workspace works, but can't point at or move into the other one.
  insert into public.clients (organization_id, full_name, created_by) values (own_org, 'Isolation check', intruder) returning id into own_client;
  report := report || E'\nok   write: client in own workspace';

  if victim_client is not null then
    begin
      insert into public.tasks (organization_id, title, client_id, created_by) values (own_org, 'Isolation check', victim_client, intruder);
      failures := failures + 1;
      report := report || E'\nFAIL write: linked a task to another workspace''s client';
    exception when others then
      report := report || format(E'\nok   write: link to another workspace''s client blocked (%s)', sqlstate);
    end;
  end if;

  begin
    update public.clients set organization_id = victim_org where id = own_client;
    get diagnostics n = row_count;
    if n <> 0 then
      failures := failures + 1;
      report := report || E'\nFAIL write: moved a client into another workspace';
    else
      report := report || E'\nok   write: moving a client to another workspace touched nothing';
    end if;
  exception when others then
    report := report || format(E'\nok   write: moving a client to another workspace blocked (%s)', sqlstate);
  end;

  raise exception '%', report || format(E'\nRESULT: %s failures (all changes rolled back)', failures);
end;
$$;
