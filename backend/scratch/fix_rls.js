const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('http://127.0.0.1:54341', 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz');

async function fixRLS() {
    // Use the management API to execute SQL
    const response = await fetch('http://127.0.0.1:54341/rest/v1/', {
        headers: {
            'apikey': 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz',
            'Authorization': 'Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
        }
    });
    console.log('PostgREST status:', response.status);

    // Use psql directly via the local database URL
    const { execSync } = require('child_process');
    
    const sql = `
    -- Drop the recursive admin policy on profiles
    DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
    
    -- Recreate using auth.jwt() instead of a subquery on the same table
    CREATE POLICY "profiles_select_admin" ON public.profiles 
    FOR SELECT USING (
        auth.jwt() ->> 'email' = 'matias.moreno101@gmail.com'
    );
    
    -- Also fix the customers policy that has a recursive subquery
    DROP POLICY IF EXISTS "customers_bakery_owner_select" ON public.customers;
    DROP POLICY IF EXISTS "customers_admin_all" ON public.customers;
    
    -- Recreate without recursion
    CREATE POLICY "customers_admin_all" ON public.customers USING (
        auth.jwt() ->> 'email' = 'matias.moreno101@gmail.com'
    );
    `;

    try {
        const result = execSync(
            `docker exec -i supabase_db_mi-plataforma-pan psql -U postgres -d postgres -c "${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
            { encoding: 'utf-8' }
        );
        console.log('SQL result:', result);
    } catch (e) {
        console.error('Docker exec failed, trying alternative...');
        // Try direct pg connection
        try {
            const result2 = execSync(
                `psql "postgresql://postgres:postgres@127.0.0.1:54332/postgres" -c "${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
                { encoding: 'utf-8' }
            );
            console.log('SQL result:', result2);
        } catch (e2) {
            console.error('psql also failed:', e2.message);
            console.log('Please run the SQL manually in Supabase Studio SQL Editor (http://127.0.0.1:54343)');
        }
    }
}

fixRLS();
