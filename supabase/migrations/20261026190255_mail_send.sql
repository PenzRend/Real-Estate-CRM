-- Sending replies from the CRM, through the user's own Gmail account.
-- The send permission is granted separately (only when the user asks for it);
-- can_send records whether Google granted it.

alter table public.mailboxes
  add column can_send boolean not null default false;

alter table public.emails
  -- When the user replied to this email from the CRM.
  add column replied_at timestamptz,
  -- Outgoing emails sent from the CRM (for the daily send limit).
  add column sent_from_crm boolean not null default false;

create index emails_sent_from_crm_idx on public.emails (user_id, created_at) where sent_from_crm;
