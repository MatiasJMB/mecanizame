
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function addColumns() {
    console.log('🚀 Intentando añadir columnas real_phone...');
    
    // Intentar con un RPC si existe un helper de SQL (común en este proyecto para facilitar migraciones)
    const { error: err1 } = await supabase.rpc('execute_sql', {
        sql: 'ALTER TABLE customers ADD COLUMN IF NOT EXISTS real_phone TEXT;'
    });
    
    const { error: err2 } = await supabase.rpc('execute_sql', {
        sql: 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_real_phone TEXT;'
    });

    if (err1 || err2) {
        console.log('⚠️ No se pudieron añadir las columnas automáticamente.');
        console.log('   Sugerencia: Ejecuta esto en el SQL Editor de Supabase:');
        console.log('   ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS real_phone TEXT;');
        console.log('   ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_real_phone TEXT;');
    } else {
        console.log('✅ Columnas añadidas (si es que el RPC execute_sql está habilitado).');
    }
}

addColumns();
