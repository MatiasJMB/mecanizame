import { supabase } from '../database/supabase';

let isRealtimeStarted = false;
let realtimeChannel: any = null;

export function initRealtimeSubscription(globalSock: any) {
    if (isRealtimeStarted) return;

    if (realtimeChannel) {
        console.log('🔄 Limpiando suscripción Realtime previa...');
        realtimeChannel.unsubscribe();
    }

    console.log('📡 Iniciando suscripción Realtime a Supabase (orders)...');

    realtimeChannel = supabase
        .channel('orders-realtime-v3') // Usar un nombre de canal fresco
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'orders' },
            async (payload) => {
                const newRecord = payload.new as any;
                if (!newRecord || !newRecord.id) return;

                console.log(`🔔 [EVENTO] Cambio detectado en orden: ${newRecord.id}`);

                const { data: order, error } = await supabase
                    .from('orders')
                    .select('*, bakeries(name)')
                    .eq('id', newRecord.id)
                    .single();

                if (error || !order) {
                    return;
                }

                const bakeryName = (order.bakeries as any)?.name || 'la panadería';

                if (order.status === 'READY' && newRecord.status === 'READY') {
                    const mensaje = [
                        `🔔 *¡Tu pedido está listo!*`,
                        ``,
                        `Tu código de retiro es: *${order.short_code}*`,
                        ``,
                        `📋 *Detalle del pedido:*`,
                        order.items_description,
                        ``,
                        `📍 Acércate a la caja de *${bakeryName}* para retirar y pagar.`,
                        ``,
                        `⏳ *Importante:* Tienes un tiempo limitado para retirarlo.`,
                    ].join('\n');

                    if (globalSock) {
                        try {
                            await globalSock.sendMessage(order.customer_phone, { text: mensaje });
                            console.log(`✨ WhatsApp READY enviado exitosamente (Realtime fallback).`);
                        } catch (e) { console.error(`❌ Error WhatsApp READY:`, e); }
                    }
                }
            }
        )
        .subscribe((status) => {
            console.log(`📡 Estado Realtime: ${status}`);
            if (status === 'SUBSCRIBED') {
                console.log('✅ Realtime conectado — escuchando cambios en orders.');
                isRealtimeStarted = true;
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error(`❌ Error en canal Realtime (${status}). Reintentando en 5s...`);
                isRealtimeStarted = false;
                setTimeout(() => initRealtimeSubscription(globalSock), 5000);
            }
        });
}
