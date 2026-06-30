import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { BellRing, ArrowRight } from 'lucide-react';

export default function OrderNotification() {
  const { bakeryId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notification, setNotification] = useState<{ code: string; items: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/bell.mp3?v=2');
    }
  }, []);

  useEffect(() => {
    if (!bakeryId) return;

    const channel = supabase
      .channel(`global-orders-${bakeryId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `bakery_id=eq.${bakeryId}` },
        (payload) => {
          const newOrder = payload.new as any;
          
          // Si estamos en el dashboard, no hacer nada (ya tiene su propia lógica de sonido y UI)
          if (location.pathname === '/') return;

          // Sonar campana
          if (audioRef.current) {
            audioRef.current.play().catch(() => {});
          }

          // Mostrar notificación
          setNotification({
            code: newOrder.short_code || '???',
            items: newOrder.items_description || 'Nuevo pedido',
          });

          // Auto-ocultar después de 15 segundos
          setTimeout(() => setNotification(null), 15000);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [bakeryId, location.pathname]);

  if (!notification) return null;

  return (
    <div className="fixed top-4 inset-x-0 mx-auto z-[9999] w-[90%] max-w-md animate-slideDown">
      <div className="bg-emerald-600 text-white rounded-2xl p-4 shadow-2xl shadow-emerald-900/50 border border-emerald-400/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <BellRing className="w-4 h-4 shrink-0" />
              <span className="font-black text-sm">¡Nuevo pedido!</span>
              <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">{notification.code}</span>
            </div>
            <p className="text-emerald-100 text-xs truncate">{notification.items}</p>
          </div>
          <button
            onClick={() => { setNotification(null); navigate('/'); }}
            className="bg-white text-emerald-700 font-black text-xs py-2 px-4 rounded-xl shrink-0 hover:bg-emerald-50 active:scale-95 transition-all flex items-center gap-1.5"
          >
            Ir al panel <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
