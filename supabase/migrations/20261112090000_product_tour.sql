-- The short welcome walkthrough: shown once, until the user finishes or skips it.
alter table public.profiles add column tour_seen_at timestamptz;
grant update (tour_seen_at) on public.profiles to authenticated;
