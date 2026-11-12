-- Packages and payments. One plan to start, priced per agent; its price and
-- AI caps are edited on /admin (Stripe prices are made from them). A
-- workspace's access: a pilot (free until the admin ends it), a 30-day trial
-- from a sign-up code, or a paid Stripe subscription. Without a code, a new
-- account signs up but pays before using the app.

create table public.plans (
  id text primary key check (id ~ '^[a-z0-9-]{2,32}$'),
  name text not null check (char_length(name) between 1 and 60),
  -- Final prices in forints (the seller is VAT-exempt: alanyi adómentes).
  price_month_huf integer not null check (price_month_huf >= 0),
  price_year_huf integer not null check (price_year_huf >= 0),
  -- AI calls per agent; a workspace gets them times its seats.
  ai_daily_per_seat integer not null check (ai_daily_per_seat >= 0),
  ai_monthly_per_seat integer check (ai_monthly_per_seat >= 0),
  stripe_product_id text,
  stripe_price_month_id text,
  stripe_price_year_id text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.plans enable row level security;
-- The price list is public (the billing page, and later a pricing page).
grant select on public.plans to anon, authenticated;
create policy "anyone reads active plans" on public.plans for select to anon, authenticated using (active);

insert into public.plans (id, name, price_month_huf, price_year_huf, ai_daily_per_seat, ai_monthly_per_seat)
values ('flavio', 'Flavio', 9900, 99000, 100, 1500);

-- Billing state of a workspace. Members can read it (their update grant on
-- organizations covers the name only); the Stripe webhook and the admin write it.
alter table public.organizations
  add column billing_status text not null default 'none'
    check (billing_status in ('none', 'pilot', 'trialing', 'active', 'past_due', 'canceled')),
  add column trial_ends_at timestamptz,
  add column plan_id text references public.plans (id),
  add column billing_interval text check (billing_interval in ('month', 'year')),
  add column seats integer check (seats >= 1),
  add column current_period_end timestamptz,
  add column cancel_at_period_end boolean not null default false,
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique;
create index organizations_plan_id_idx on public.organizations (plan_id);

-- Everyone already here is a pilot until the admin decides otherwise.
update public.organizations set billing_status = 'pilot';

-- Paid invoices, for the admin to issue the Hungarian invoice by hand (until
-- invoicing is automated). Service key only.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  stripe_invoice_id text not null unique,
  stripe_invoice_number text,
  amount_huf numeric(12, 2) not null,
  paid_at timestamptz not null,
  period_start timestamptz,
  period_end timestamptz,
  description text,
  customer_email text,
  customer_name text,
  customer_address text,
  customer_tax_id text,
  receipt_url text,
  -- The admin's own invoice: its number and when it was issued.
  invoice_number text check (char_length(invoice_number) <= 60),
  invoiced_at timestamptz,
  created_at timestamptz not null default now()
);
create index payments_org_idx on public.payments (organization_id, paid_at desc);
alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;

-- Sign-up: a code is optional now. A valid one starts a 30-day free trial;
-- without one the account is made but must pay before using the app. A
-- mistyped code still stops the sign-up, so nobody loses their trial to a typo.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
  display_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  given_code text := upper(nullif(trim(new.raw_user_meta_data ->> 'signup_code'), ''));
  trial boolean := false;
begin
  if given_code is not null then
    update public.signup_codes
    set used_at = now(), used_by = new.id
    where code = given_code
      and used_at is null and revoked_at is null and expires_at > now()
      and (email is null or email = lower(new.email));
    if not found then
      raise exception 'A valid sign-up code is required' using errcode = 'P0001';
    end if;
    trial := true;
  end if;

  insert into public.profiles (id, full_name, email)
  values (new.id, display_name, new.email);

  insert into public.organizations (name, is_personal, billing_status, trial_ends_at)
  values (
    coalesce(display_name, new.email), true,
    case when trial then 'trialing' else 'none' end,
    case when trial then now() + interval '30 days' end
  )
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;
