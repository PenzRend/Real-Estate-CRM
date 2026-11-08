-- Two more moments an email rule can react to: a listing becomes active and
-- suits a buyer ("listing_match"), and an active listing gets cheaper
-- ("price_drop"). Only widens the allowed values.

alter table public.email_templates drop constraint email_templates_trigger_check;
alter table public.email_templates add constraint email_templates_trigger_check
  check (trigger in ('manual', 'client_created', 'viewing_booked', 'viewing_completed', 'deal_created', 'deal_won', 'no_contact', 'listing_match', 'price_drop'));
