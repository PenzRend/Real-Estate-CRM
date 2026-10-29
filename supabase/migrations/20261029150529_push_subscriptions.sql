-- Devices that receive Flavio's notifications (web push): a new inquiry, a
-- client writing. One row per browser or installed app; private to the user.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint text not null unique check (char_length(endpoint) <= 2000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  device text check (char_length(device) <= 200),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
alter table public.push_subscriptions enable row level security;
create policy "own read" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "own insert" on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own update" on public.push_subscriptions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own delete" on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));
