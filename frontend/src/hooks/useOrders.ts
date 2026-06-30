import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

export type Order = {
  id: string;
  short_code: string;
  status: 'PENDING' | 'READY' | 'DELIVERED' | 'EXPIRED' | 'REJECTED';
  total_amount: number;
  items_description?: string;
  bakery_id: number;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_real_phone?: string;
  cancellation_reason?: string;
  needs_modification_notify?: boolean;
  removed_items?: string;
  ready_at?: string;
};

export const useOrders = (bakeryId: number, soundEnabled: boolean = false) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFlashing, setIsFlashing] = useState(false);
  const [showNewOrderOverlay, setShowNewOrderOverlay] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const titleBlinkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalTitleRef = useRef(document.title);

  const soundRef = useRef(soundEnabled);
  const ordersRef = useRef<Order[]>([]);

  // Mantener refs sincronizados
  useEffect(() => {
    soundRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Solicitar permisos de notificación de escritorio al montar
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Inicializar audio de forma eficiente
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/bell.mp3?v=2');
    }
  }, []);

  // Función para hacer parpadear el título de la pestaña
  const startTitleBlink = () => {
    if (titleBlinkIntervalRef.current) return; // ya está parpadeando
    originalTitleRef.current = document.title;
    let visible = true;
    titleBlinkIntervalRef.current = setInterval(() => {
      document.title = visible ? '¡Nuevo pedido! · Ahora Pan' : originalTitleRef.current;
      visible = !visible;
    }, 600);
  };

  const stopTitleBlink = () => {
    if (titleBlinkIntervalRef.current) {
      clearInterval(titleBlinkIntervalRef.current);
      titleBlinkIntervalRef.current = null;
    }
    document.title = originalTitleRef.current;
  };

  const lastAlertTimeRef = useRef(0);

  // Función central que dispara TODAS las alertas de nuevo pedido
  const triggerNewOrderAlert = (orderCode?: string) => {
    const now = Date.now();
    // Evitar alertas duplicadas en una ventana de 3 segundos
    if (now - lastAlertTimeRef.current < 3000) return;
    lastAlertTimeRef.current = now;

    // Reproducir sonido
    if (soundRef.current && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log("Audio bloqueado o error de carga", e));
    }

    // 1) Pantalla: overlay verde
    setIsFlashing(true);
    setShowNewOrderOverlay(true);
    setTimeout(() => setIsFlashing(false), 3000); // El parpadeo del borde sigue siendo automático

    // 2) Parpadeo del título de la pestaña
    startTitleBlink();

    // 3) Notificación del sistema operativo
    if ('Notification' in window && Notification.permission === 'granted') {
      const notif = new Notification('¡Nuevo pedido recibido!', {
        body: orderCode
          ? `Pedido #${orderCode} acaba de entrar. ¡Prepárate!`
          : '¡Tienes un nuevo pedido esperando preparación!',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'new-order', // reemplaza la notif anterior si llegan varios seguidos
        requireInteraction: true, // no desaparece sola en escritorio
      });
      // Al hacer clic en la notificación → enfocar la ventana
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    }

    // 4) Intento de traer la ventana al frente (funciona si el navegador lo permite)
    try { window.focus(); } catch (_) {}
  };

  // 1. Cargador de órdenes (refactorizado para re-uso)
  const fetchOrders = async (isBackgroundSync = false) => {
    if (!bakeryId) {
      setLoading(false);
      return;
    }

    try {
      if (!isBackgroundSync) setLoading(true);
      
      const { data, error } = await supabase
        .from('orders')
        .select('*, customer_name, customer_phone, customer_real_phone')
        .eq('bakery_id', bakeryId)
        .in('status', ['PENDING', 'READY']) 
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      if (data) {
        const newOrders = data as Order[];
        
        // Si es un sync de fondo (cuando el usuario vuelve a la tab), 
        // chequear si hay órdenes nuevas para hacer sonar la campana
        if (isBackgroundSync) {
           const existingIds = new Set(ordersRef.current.map(o => o.id));
           const hasNewItems = newOrders.some(o => !existingIds.has(o.id) && o.status === 'PENDING');
           
           if (hasNewItems) {
               triggerNewOrderAlert();
            }
        }
        
        setOrders(newOrders);
      }
    } catch (err) {
      console.error("Error cargando pedidos:", err);
    } finally {
      if (!isBackgroundSync) setLoading(false);
    }
  };

  useEffect(() => {
    if (!bakeryId) {
       setLoading(false);
       return;
    }

    fetchOrders();

    // 2. Manejador de visibilidad (Auto-refresh al volver a la app/tab)
    // Esto soluciona el problema de datos estáticos en móviles (iOS/Android)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Dashboard visible: Sincronizando datos...');
        fetchOrders(true);
        
        // Re-suscribir si el canal se cerró por inactividad
        if (channel.state !== 'joined') {
           channel.subscribe();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Suscripción Realtime a Supabase
    const channel = supabase
      .channel(`public:orders:${bakeryId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `bakery_id=eq.${bakeryId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as Order;
            console.log('🆕 [REALTIME] Nuevo pedido recibido:', newOrder.short_code);
            setOrders((prev) => [...prev, newOrder]);
            
            triggerNewOrderAlert(newOrder.short_code);
          }
          
          if (payload.eventType === 'UPDATE') {
            const updatedOrder = payload.new as Order;
            console.log('🔄 [REALTIME] Actualización recibida:', updatedOrder.short_code || updatedOrder.id, updatedOrder.status);
            
            // Si la orden pasó a un estado inactivo, la sacamos de la pantalla
            if (updatedOrder.status === 'DELIVERED' || updatedOrder.status === 'EXPIRED' || updatedOrder.status === 'REJECTED') {
              setOrders((prev) => prev.filter(o => o.id !== updatedOrder.id));
            } else {
              setOrders((prev) => 
                prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o)
              );
            }
          }

          if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            console.log('🗑️ [REALTIME] Pedido eliminado:', deletedId);
            setOrders((prev) => prev.filter(o => o.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [bakeryId]);

  const updateOrderStatus = async (id: string, newStatus: Order['status'], extraData: Partial<Order> = {}) => {
    const nowISO = new Date().toISOString();
    const updatePayload: Partial<Order> = { ...extraData };
    
    if (newStatus === 'READY') {
      updatePayload.ready_at = nowISO;
    }

    // Optimistic UI update
    setOrders((prev) => prev.map(o => o.id === id ? { ...o, status: newStatus, ...updatePayload } : o));
    
    // Update real en BD
    // Filtramos campos que no existen en la BD (como needs_modification_notify o removed_items)
    const { removed_items, needs_modification_notify, ...dbData } = (updatePayload as any);
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, ...dbData })
      .eq('id', id);

    if (error) {
      console.error(`❌ Error persistiendo cambio de estado del pedido ${id}:`, error.message);
      // Revertir cambio optimista si falló la BD (forzando un refresh)
      fetchOrders(true);
      return; // 🛑 DETENEMOS LA EJECUCIÓN AQUÍ PARA NO ENVIAR EL WHATSAPP SI FALLÓ LA BD
    } else {
      console.log(`✅ Estado del pedido ${id} actualizado a ${newStatus} en base de datos.`);
      // No hacemos fetchOrders(true) aquí para evitar carreras de datos.
      // Realtime se encargará de sincronizar otros dispositivos si es necesario.
    }

    // Notificar al cliente vía backend API (directo, sin depender de Realtime)
    let apiStatus = newStatus;
    if (extraData.needs_modification_notify) {
      apiStatus = 'MODIFIED' as any;
    }

    const statusesToNotify = ['READY', 'DELIVERED', 'REJECTED', 'MODIFIED'];

    if (statusesToNotify.includes(apiStatus)) {
      try {
        await fetch('/api/notify-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            order_id: id, 
            new_status: apiStatus,
            removed_items: extraData.removed_items // Enviamos los productos removidos si existen
          })
        });
      } catch (e) {
        console.error('Error notificando al backend:', e);
      }
    }
  };

  const dismissNewOrderAlert = () => {
    setShowNewOrderOverlay(false);
    stopTitleBlink();
  };

  return { orders, updateOrderStatus, isFlashing, showNewOrderOverlay, dismissNewOrderAlert, loading };
}
