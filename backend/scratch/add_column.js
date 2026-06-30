
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function addColumn() {
    console.log('🚀 Intentando añadir columna real_phone a customers...');
    const { error } = await supabase.rpc('execute_sql', {
        sql: 'ALTER TABLE customers ADD COLUMN IF NOT EXISTS real_phone TEXT;'
    });

    if (error) {
        // Si no hay RPC 'execute_sql', fallará. Es común no tenerlo.
        console.error('❌ Error usando RPC:', error.message);
        console.log('⚠️ Probablemente necesites añadir la columna manualmente en el Dashboard de Supabase:');
        console.log('   ALTER TABLE customers ADD COLUMN real_phone TEXT;');
    } else {
        console.log('✅ Columna real_phone añadida exitosamente.');
    }
}

addColumn();
