-- Rank, its rationale, the pending verdict and the evaluation clock become
-- server-written only (service role, via evaluateTier/acceptTier/declineTier).
-- Everything the app lets a lifter edit about themselves stays writable. A
-- column grant only bites once the table-wide grant is gone, hence
-- revoke-then-grant. SELECT and DELETE are untouched; RLS still scopes rows.
revoke insert, update on public.profile from anon, authenticated;

grant insert (user_id, display_name, username, sex, birth_year, height_cm, onboarded_at, reminder_hour)
  on public.profile to authenticated;
grant update (user_id, display_name, username, sex, birth_year, height_cm, onboarded_at, reminder_hour)
  on public.profile to authenticated;
