import { supabase } from '../database/supabase';
import { UserState, Cart } from '../types';

export async function clearBotSession(phone: string) {
    try {
        await supabase.from('bot_sessions').delete().eq('phone_number', phone);
    } catch (e) {
        console.error('Error clearing session:', e);
    }
}

export async function getSession(phone: string): Promise<{state: UserState | undefined, cart: Cart | undefined}> {
    try {
        const { data, error } = await supabase.from('bot_sessions').select('state, cart, updated_at').eq('phone_number', phone).single();
        
        if (error) {
            if (error.code !== 'PGRST116') { // PGRST116 is "no rows found", which is normal
                console.error(`[DB] ❌ Error real buscando sesión para ${phone}:`, error.message, error.details);
            } else {
                console.log(`[DB] 🔍 No se encontró sesión previa (nueva) para ${phone}`);
            }
            return { state: undefined, cart: { items: [], totalAmount: 0 } };
        }

        if (!data) return { state: undefined, cart: { items: [], totalAmount: 0 } };

        console.log(`[DB] ✅ Sesión RECUERDADA para ${phone}. Paso: ${data.state?.step}`);

        const updated = new Date(data.updated_at).getTime();
        if (Date.now() - updated > 2 * 60 * 60 * 1000) {
            console.log(`[DB] 🕒 Sesión expirada para ${phone}`);
            await clearBotSession(phone);
            return { state: undefined, cart: { items: [], totalAmount: 0 } };
        }

        return { 
            state: (data.state && typeof data.state === 'object' && Object.keys(data.state).length > 0) ? data.state as UserState : undefined, 
            cart: (data.cart as Cart) || { items: [], totalAmount: 0 }
        };
    } catch (e) {
        console.error(`[SESSION] ❌ Error en getSession para ${phone}:`, e);
        return { state: undefined, cart: { items: [], totalAmount: 0 } };
    }
}

export async function saveSession(phone: string, state?: UserState, cart?: Cart) {
    try {
        if (!state && (!cart || cart.items.length === 0)) {
            await clearBotSession(phone);
            return;
        }
        const { error } = await supabase.from('bot_sessions').upsert({
            phone_number: phone, 
            state: state || {}, 
            cart: cart || { items: [], totalAmount: 0 },
            updated_at: new Date().toISOString()
        }, { onConflict: 'phone_number' });

        if (error) {
            console.error(`[DB] ❌ Error GUARDANDO sesión para ${phone}:`, error.message, error.details);
        } else {
            console.log(`[DB] 💾 Sesión guardada con éxito para ${phone}`);
        }
    } catch (e) {
        console.error('[SESSION] ❌ Error fatal en saveSession:', e);
    }
}
