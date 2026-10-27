-- Supabase grants new public functions to anon by default; joining needs a signed-in user.
revoke execute on function public.accept_invitation(text) from anon;
