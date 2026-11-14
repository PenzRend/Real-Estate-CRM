-- The business's own costs, for the admin's Pénzügyek page: one-off ones
-- (a domain, an invoice) and monthly ones (hosting, the database) that count
-- every month from their start until they are stopped. Service key only.

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null,
  category text not null
    check (category in ('hosting', 'database', 'ai', 'email', 'domain', 'payment_fees', 'accounting', 'marketing', 'tools', 'other')),
  description text not null check (char_length(description) between 1 and 200),
  amount_huf numeric(12, 2) not null check (amount_huf >= 0),
  -- Counted every month from spent_on's month, until ends_on's month if set.
  monthly boolean not null default false,
  ends_on date check (ends_on is null or ends_on >= spent_on),
  created_at timestamptz not null default now()
);
create index expenses_spent_on_idx on public.expenses (spent_on);

alter table public.expenses enable row level security;
revoke all on public.expenses from anon, authenticated;
