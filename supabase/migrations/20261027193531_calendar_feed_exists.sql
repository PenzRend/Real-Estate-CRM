-- Tells an unknown (or replaced) subscription link from a feed with no viewings yet.
create function public.calendar_feed_exists(p_token_hash text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.calendar_feeds f
    join public.organization_members m on m.organization_id = f.organization_id and m.user_id = f.user_id
    where f.token_hash = p_token_hash
  );
$$;

revoke all on function public.calendar_feed_exists(text) from public;
grant execute on function public.calendar_feed_exists(text) to anon, authenticated;
