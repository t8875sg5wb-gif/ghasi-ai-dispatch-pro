REVOKE ALL ON FUNCTION public.prevent_payroll_run_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_payroll_run_item_immutability() FROM PUBLIC, anon, authenticated;