-- The two-argument version goes; the app passes p_alerts now.
drop function public.claim_apns_device(text, text);
revoke execute on function public.claim_apns_device(text, text, boolean) from public, anon;
grant execute on function public.claim_apns_device(text, text, boolean) to authenticated;
