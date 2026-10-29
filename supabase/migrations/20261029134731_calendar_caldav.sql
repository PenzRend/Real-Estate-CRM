-- Calendars read over CalDAV (iCloud and other servers) next to iCal links.
-- For CalDAV, url_enc holds the calendar's address; the user name and the
-- (app) password are stored too, the password encrypted by the app server.
alter table public.calendar_subscriptions
  add column kind text not null default 'ics' check (kind in ('ics', 'caldav')),
  add column username text check (char_length(username) <= 320),
  add column secret_enc text,
  add constraint calendar_subscriptions_caldav_login check (kind = 'ics' or (username is not null and secret_enc is not null));
