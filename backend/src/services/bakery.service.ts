import { supabase } from '../database/supabase';

export function isBakeryOpen(businessHours: any): { isOpen: boolean; schedule?: string } {
    if (!businessHours) return { isOpen: true }; // Si no hay horario, asumimos abierto (retrocompatibilidad)

    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
    const day = now.getDay().toString(); // "0" (dom) a "6" (sab)
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const todaySchedule = businessHours[day];

    // Formatear horario para mostrar al cliente
    const daysMap: any = { "0": "Domingo", "1": "Lunes", "2": "Martes", "3": "Miércoles", "4": "Jueves", "5": "Viernes", "6": "Sábado" };
    let scheduleStr = "";
    Object.keys(businessHours).sort().forEach(d => {
        const s = businessHours[d];
        scheduleStr += `\n• *${daysMap[d]}*: ${s.closed ? 'Cerrado' : `${s.open} - ${s.close}`}`;
    });

    if (!todaySchedule || todaySchedule.closed) {
        return { isOpen: false, schedule: scheduleStr };
    }

    if (currentTime >= todaySchedule.open && currentTime <= todaySchedule.close) {
        return { isOpen: true, schedule: scheduleStr };
    }

    return { isOpen: false, schedule: scheduleStr };
}

export async function incrementStrikes(bakeryId: number, phone: string) {
    try {
        console.log(`⚠️ Incrementando strike para ${phone} en panadería ${bakeryId}`);
        // Intentar obtener el registro actual de bakery_customers
        const { data } = await supabase
            .from('bakery_customers')
            .select('strikes')
            .eq('bakery_id', bakeryId)
            .eq('customer_phone', phone)
            .single();

        const currentStrikes = data?.strikes || 0;
        const newStrikes = currentStrikes + 1;

        await supabase
            .from('bakery_customers')
            .upsert({
                bakery_id: bakeryId,
                customer_phone: phone,
                strikes: newStrikes
            }, { onConflict: 'bakery_id,customer_phone' });

        return newStrikes;
    } catch (e) {
        console.error('Error incrementando strikes:', e);
        return 0;
    }
}
