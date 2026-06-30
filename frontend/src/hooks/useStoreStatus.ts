import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export type StoreTone = 'open' | 'closing' | 'closed' | 'loading';

export type StoreStatus = {
  isOpen: boolean;
  label: string;
  tone: StoreTone;
};

/**
 * Calcula el estado de atención del local (abierto / por cerrar / cerrado)
 * en base a los horarios configurados y el ajuste global de "cierre próximo".
 * Compartido entre el sidebar persistente y el Dashboard para evitar duplicar
 * la lógica.
 */
export function useStoreStatus(): StoreStatus {
  const { businessHours } = useAuth();
  const [now, setNow] = useState(() => new Date());
  const [closingSoonMinutes, setClosingSoonMinutes] = useState(15);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'closing_soon_minutes')
          .maybeSingle();
        if (active && data && data.value !== undefined) {
          const val = parseInt(String(data.value), 10);
          if (!Number.isNaN(val)) setClosingSoonMinutes(val);
        }
      } catch {
        /* usa el valor por defecto */
      }
    })();
    return () => { active = false; };
  }, []);

  if (!businessHours) {
    return { isOpen: false, label: 'Cargando…', tone: 'loading' };
  }

  const day = now.getDay();
  const schedule = businessHours[day.toString()];

  if (!schedule || schedule.closed) {
    return { isOpen: false, label: 'Cerrado hoy', tone: 'closed' };
  }

  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = schedule.open.split(':').map(Number);
  const [closeH, closeM] = schedule.close.split(':').map(Number);
  const openTime = openH * 60 + openM;
  const closeTime = closeH * 60 + closeM;

  if (currentTime >= openTime && currentTime < closeTime) {
    const remaining = closeTime - currentTime;
    const threshold = closingSoonMinutes > 0 ? closingSoonMinutes : 15;
    if (remaining > 0 && remaining <= threshold) {
      return { isOpen: true, label: `Cierra ${schedule.close}`, tone: 'closing' };
    }
    return { isOpen: true, label: 'Abierto ahora', tone: 'open' };
  }

  return { isOpen: false, label: `Abre ${schedule.open}`, tone: 'closed' };
}
