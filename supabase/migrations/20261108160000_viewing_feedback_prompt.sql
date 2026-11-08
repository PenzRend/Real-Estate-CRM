-- When the agent was asked "Hogy sikerült?" on their phone after a viewing
-- ended, so the prompt goes out once.
alter table public.viewings add column feedback_prompted_at timestamptz;
