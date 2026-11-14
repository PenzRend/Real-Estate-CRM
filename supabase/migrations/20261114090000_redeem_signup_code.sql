-- An invite code entered after sign-up, on the payment page: someone who
-- skipped the code field (or got the code later) still gets the 30 free days.
-- Only an owner or admin of a workspace that has never had a plan or a trial,
-- and only with a code that is open for their own address.

create function public.redeem_signup_code(p_org uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  mail text;
  status text;
begin
  if uid is null or not private.has_org_role(p_org, array['owner', 'admin']) then
    return 'not_allowed';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_org and o.billing_status = 'none') then
    return 'not_allowed';
  end if;

  select lower(u.email) into mail from auth.users u where u.id = uid;
  status := public.signup_code_status(p_code, mail);
  if status <> 'open' then
    return status;
  end if;

  update public.signup_codes
  set used_at = now(), used_by = uid
  where code = upper(trim(p_code))
    and used_at is null and revoked_at is null and expires_at > now()
    and (email is null or email = mail);
  if not found then
    return 'used';
  end if;

  update public.organizations
  set billing_status = 'trialing', trial_ends_at = now() + interval '30 days'
  where id = p_org;
  return 'ok';
end;
$$;

revoke all on function public.redeem_signup_code(uuid, text) from public;
grant execute on function public.redeem_signup_code(uuid, text) to authenticated;
