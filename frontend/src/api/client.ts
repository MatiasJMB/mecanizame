import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('🚨 Faltan credenciales de Supabase en el archivo .env.local');
}

/** Cliente único de Supabase. Toda la app consume la base a través de la capa `api/`,
 *  que envuelve este cliente con funciones tipadas por dominio. */
export const supabase = createClient(supabaseUrl, supabaseKey);
