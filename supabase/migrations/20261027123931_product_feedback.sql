-- Feedback agents send from the app ("Visszajelzés"): bugs, ideas, anything.
-- Agents add and read their own; the product team reads all of it with the
-- service role (Supabase dashboard). Never deleted from the app.

create table public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'idea' check (kind in ('bug', 'idea', 'other')),
  message text not null check (char_length(message) between 1 and 5000),
  page text check (char_length(page) <= 500),
  user_agent text check (char_length(user_agent) <= 500),
  created_at timestamptz not null default now()
);

create index product_feedback_created_idx on public.product_feedback (created_at desc);
create index product_feedback_org_idx on public.product_feedback (organization_id);
create index product_feedback_user_idx on public.product_feedback (user_id);

grant select, insert on public.product_feedback to authenticated;
alter table public.product_feedback enable row level security;

create policy "own read" on public.product_feedback for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own insert" on public.product_feedback for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_org_member(organization_id));
