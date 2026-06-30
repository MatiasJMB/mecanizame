import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

export const supabase = createClient(
    process.env.SUPABASE_URL!, 
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!, 
    {
        realtime: {
            params: {
                events_per_second: 10,
            },
            timeout: 45000, // Aumentar timeout a 45 segundos para mayor estabilidad
        }
    }
);
