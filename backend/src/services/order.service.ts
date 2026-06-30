import { supabase } from '../database/supabase';

export async function generateNextShortCode(bakeryId: number): Promise<string> {
    try {
        const { data } = await supabase
            .from('orders')
            .select('short_code')
            .eq('bakery_id', bakeryId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (!data || data.length === 0) return '#A-01';

        const lastCode = data[0].short_code; // Ej: #A-01
        const regex = /#([A-Z])-([0-9]{2})/;
        const match = lastCode.match(regex);

        if (!match) return '#A-01';

        let letter = match[1];
        let num = parseInt(match[2]);

        num++;
        if (num > 99) {
            num = 1;
            // Avanzar letra
            let charCode = letter.charCodeAt(0);
            charCode++;
            if (charCode > 90) charCode = 65; // Reset a 'A' si pasa de 'Z'
            letter = String.fromCharCode(charCode);
        }

        const nextNum = num.toString().padStart(2, '0');
        return `#${letter}-${nextNum}`;
    } catch (e) {
        return `#A-${Math.floor(Math.random() * 90) + 10}`; // Fallback random si algo falla
    }
}
