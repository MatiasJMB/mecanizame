-- Fix recursive RLS policy on profiles (causa error 406)
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;

-- Recrear usando auth.jwt() en vez de subquery recursiva a la misma tabla
CREATE POLICY "profiles_select_admin" ON public.profiles 
FOR SELECT USING (
    auth.jwt() ->> 'email' = 'matias.moreno101@gmail.com'
);

-- Fix customers policies
DROP POLICY IF EXISTS "customers_bakery_owner_select" ON public.customers;
DROP POLICY IF EXISTS "customers_admin_all" ON public.customers;

CREATE POLICY "customers_admin_all" ON public.customers USING (
    auth.jwt() ->> 'email' = 'matias.moreno101@gmail.com'
);
