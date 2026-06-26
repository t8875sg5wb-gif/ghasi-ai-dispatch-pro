-- Standardmäßiges PUBLIC-EXECUTE entfernen und gezielt neu vergeben
revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.primary_role(uuid) from public;
revoke all on function public.handle_new_user() from public;

-- Rollenhelfer werden in RLS-Policies angemeldeter Nutzer verwendet
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.primary_role(uuid) to authenticated;

-- Server-/Adminzugriff
grant execute on function public.has_role(uuid, public.app_role) to service_role;
grant execute on function public.primary_role(uuid) to service_role;
grant execute on function public.handle_new_user() to service_role;