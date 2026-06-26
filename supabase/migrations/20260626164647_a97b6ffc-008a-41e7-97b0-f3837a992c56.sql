-- anon darf keine SECURITY DEFINER Funktionen ausführen
revoke execute on function public.has_role(uuid, public.app_role) from anon;
revoke execute on function public.primary_role(uuid) from anon;
revoke execute on function public.handle_new_user() from anon;

-- handle_new_user läuft ausschließlich als Trigger – kein direkter Aufruf nötig
revoke execute on function public.handle_new_user() from authenticated;