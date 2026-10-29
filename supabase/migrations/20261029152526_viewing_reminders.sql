-- Viewing reminders: the day before, the client gets an email (from the
-- agent's mailbox) with the time, the address and two buttons: "I'll come" /
-- "I can't come". The buttons open a public page by a secret link; only the
-- link's SHA-256 is stored, and the page sees just this one viewing.

alter table public.viewings
  add column client_reminders boolean not null default true,
  add column reminder_sent_at timestamptz,
  add column response_token_hash text unique check (response_token_hash ~ '^[0-9a-f]{64}$'),
  add column client_response text check (client_response in ('confirmed', 'declined')),
  add column client_response_at timestamptz,
  add column client_response_note text check (char_length(client_response_note) <= 500);

-- What the client's page shows: the viewing, the listing's name and address, and who the agent is.
create function public.viewing_for_client(p_token_hash text)
returns table (
  starts_at timestamptz,
  duration_minutes integer,
  status text,
  location text,
  property_title text,
  property_address text,
  client_name text,
  agent_name text,
  client_response text
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.starts_at, v.duration_minutes, v.status, v.location, p.title,
         concat_ws(', ', nullif(p.address, ''), nullif(concat_ws(' ', p.postal_code, p.city), ''), nullif(p.district, '')),
         c.full_name, coalesce(nullif(pr.full_name, ''), o.name), v.client_response
  from public.viewings v
  join public.properties p on p.id = v.property_id
  join public.clients c on c.id = v.client_id
  join public.organizations o on o.id = v.organization_id
  left join public.profiles pr on pr.id = v.created_by
  where v.response_token_hash = p_token_hash
    and p_token_hash ~ '^[0-9a-f]{64}$';
$$;

-- The client's answer: recorded once per change, noted on the client's timeline.
-- Returns the agent to tell, or null when the link is unknown or the viewing is over.
create function public.respond_to_viewing(p_token_hash text, p_response text, p_note text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.viewings;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_response not in ('confirmed', 'declined') then
    return null;
  end if;
  select * into v from public.viewings where response_token_hash = p_token_hash;
  if not found or v.status <> 'scheduled' or v.starts_at < now() - interval '2 hours' then
    return null;
  end if;
  if v.client_response is not distinct from p_response then
    return v.created_by;
  end if;
  update public.viewings
     set client_response = p_response,
         client_response_at = now(),
         client_response_note = nullif(left(coalesce(p_note, ''), 500), '')
   where id = v.id;
  insert into public.interactions (organization_id, client_id, property_id, created_by, interaction_type, occurred_at, summary, notes, source)
  values (v.organization_id, v.client_id, v.property_id, v.created_by, 'note', now(),
          case when p_response = 'confirmed' then 'Visszaigazolta a megtekintést' else 'Jelezte, hogy nem tud jönni a megtekintésre' end,
          nullif(left(coalesce(p_note, ''), 500), ''), 'manual');
  return v.created_by;
end;
$$;

revoke all on function public.viewing_for_client(text) from public;
revoke all on function public.respond_to_viewing(text, text, text) from public;
grant execute on function public.viewing_for_client(text) to anon, authenticated;
grant execute on function public.respond_to_viewing(text, text, text) to anon, authenticated;
