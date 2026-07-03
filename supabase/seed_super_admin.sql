-- Provisión controlada del super-admin (fuera de migrations/; ejecutar a mano).
-- El trigger ya NO otorga super-admin por email: se asigna aquí, sobre una cuenta
-- que YA se registró. Requiere acceso directo a la DB (no alcanzable por signup).
--   docker exec -i supabase_db_taller-saas psql -U postgres < supabase/seed_super_admin.sql
update public.profiles p
   set is_super_admin = true
  from auth.users u
 where u.email = 'admin@test.cl'
   and u.id = p.id;

select email, is_super_admin from public.profiles where is_super_admin;
