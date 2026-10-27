-- Outlook / Microsoft 365 mailboxes next to Gmail. Only the allowed provider
-- values change; no data is touched.
alter table public.mailboxes drop constraint mailboxes_provider_check;
alter table public.mailboxes add constraint mailboxes_provider_check check (provider in ('gmail', 'outlook'));
