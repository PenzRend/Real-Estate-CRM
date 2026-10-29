-- Deals: from the buyer's offer to the commission, for one listing. Stages
-- follow a Hungarian sale: offer → deposit (foglaló) → sale contract at the
-- lawyer (adásvételi) → financing (mortgage, bank valuation) → handover
-- (birtokbaadás) → closed (commission paid). Shared within the workspace.

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  -- The agent the deal (and its commission) belongs to.
  assigned_to uuid references public.profiles (id) on delete set null default auth.uid(),
  property_id uuid not null,
  buyer_client_id uuid,
  seller_client_id uuid,
  stage text not null default 'offer'
    check (stage in ('offer', 'deposit', 'contract', 'financing', 'handover', 'closed')),
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  lost_reason text check (char_length(lost_reason) <= 500),
  agreed_price numeric(14, 2) check (agreed_price >= 0),
  currency text not null default 'HUF' check (currency in ('HUF', 'EUR')),
  deposit_amount numeric(14, 2) check (deposit_amount >= 0),
  deposit_due date,
  deposit_paid_on date,
  contract_on date,
  financing_deadline date,
  handover_on date,
  -- Commission: a percentage of the price, or a fixed amount (which wins).
  commission_percent numeric(5, 2) check (commission_percent between 0 and 100),
  commission_amount numeric(14, 2) check (commission_amount >= 0),
  commission_paid_on date,
  notes text check (char_length(notes) <= 10000),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  check ((status = 'open') = (closed_at is null)),
  foreign key (property_id, organization_id)
    references public.properties (id, organization_id) on delete cascade,
  foreign key (buyer_client_id, organization_id)
    references public.clients (id, organization_id) on delete set null (buyer_client_id),
  foreign key (seller_client_id, organization_id)
    references public.clients (id, organization_id) on delete set null (seller_client_id)
);
create index deals_org_status_idx on public.deals (organization_id, status, stage);
create index deals_property_idx on public.deals (property_id, organization_id);
create index deals_buyer_idx on public.deals (buyer_client_id, organization_id) where buyer_client_id is not null;
create index deals_seller_idx on public.deals (seller_client_id, organization_id) where seller_client_id is not null;
create index deals_assigned_idx on public.deals (assigned_to);

-- Offers and counter-offers during the negotiation.
create table public.deal_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  deal_id uuid not null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  amount numeric(14, 2) not null check (amount >= 0),
  made_by text not null check (made_by in ('buyer', 'seller')),
  made_on date not null default current_date,
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'countered')),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (deal_id, organization_id) references public.deals (id, organization_id) on delete cascade
);
create index deal_offers_deal_idx on public.deal_offers (deal_id, organization_id, made_on desc);

-- Who else is involved: the lawyer, the bank, the mortgage adviser…
create table public.deal_parties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  deal_id uuid not null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  role text not null check (role in ('lawyer', 'bank', 'mortgage_advisor', 'notary', 'valuer', 'other')),
  name text not null check (char_length(name) between 1 and 200),
  phone text check (char_length(phone) <= 50),
  email text check (char_length(email) <= 320),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (deal_id, organization_id) references public.deals (id, organization_id) on delete cascade
);
create index deal_parties_deal_idx on public.deal_parties (deal_id, organization_id);

-- A deal's key dates become tasks (one per milestone, kept in step with the date).
alter table public.tasks
  add column deal_id uuid,
  add column deal_milestone text check (deal_milestone in ('deposit', 'contract', 'financing', 'handover', 'commission')),
  add foreign key (deal_id, organization_id) references public.deals (id, organization_id) on delete cascade;
create unique index tasks_deal_milestone_idx on public.tasks (deal_id, deal_milestone) where deal_milestone is not null;
create index tasks_deal_idx on public.tasks (deal_id) where deal_id is not null;

do $$
declare
  t text;
begin
  foreach t in array array['deals', 'deal_offers', 'deal_parties'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t);
    execute format('create trigger prevent_org_change before update on public.%I for each row execute function private.prevent_org_change()', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members read" on public.%I for select to authenticated using (private.is_org_member(organization_id))', t);
    execute format(
      'create policy "members insert" on public.%I for insert to authenticated
         with check (private.is_org_member(organization_id) and created_by = (select auth.uid())%s)',
      t, case when t = 'deals' then ' and private.is_member_or_null(organization_id, assigned_to)' else '' end);
    execute format(
      'create policy "members update" on public.%I for update to authenticated
         using (private.is_org_member(organization_id))
         with check (private.is_org_member(organization_id)%s)',
      t, case when t = 'deals' then ' and private.is_member_or_null(organization_id, assigned_to)' else '' end);
  end loop;
end;
$$;

-- A deal itself is removed only by owners and admins (agents mark it lost);
-- offers and parties are everyday edits.
create policy "owners and admins delete" on public.deals for delete to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));
create policy "members delete" on public.deal_offers for delete to authenticated
  using (private.is_org_member(organization_id));
create policy "members delete" on public.deal_parties for delete to authenticated
  using (private.is_org_member(organization_id));
